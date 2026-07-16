import { generateDailyThinkingChallenge } from '@/lib/claude';
import { logCrashBreadcrumb } from '@/lib/crash-breadcrumb';
import {
  buildFocusTipsFromAnalysis,
  getActiveFocusTipsForChallenge,
  markFocusTipsUsedInChallenge,
  saveFocusTipsFromSummaryIfExpired,
} from '@/lib/current-focus-tips';
import {
  getRecentChallengeTexts,
  resolveChallengeTypeForLesson,
  saveDailyChallenge,
} from '@/lib/daily-challenge';
import { DEMO_DAILY_CHALLENGE } from '@/lib/demo-mode';
import { addGems, calculateLessonGems, getTotalGems } from '@/lib/gems';
import { clearLessonCheckpoint } from '@/lib/lesson-checkpoint';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import type { LessonSessionState } from '@/lib/lesson-session';
import { saveLastSummary } from '@/lib/last-summary-storage';
import { getLevelBarometer } from '@/lib/level-progress';
import {
  checkLevelUpMilestone,
  checkPersonalBestMilestone,
  milestonesOnLessonComplete,
  type MilestoneCelebration,
} from '@/lib/milestones';
import { queueMilestoneQuizzesFromCelebrations } from '@/lib/milestone-celebration-quiz';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import {
  lessonTypeLabel,
  upsertLessonHistoryEntry,
  getLessonHistory,
} from '@/lib/practice-storage';
import { materializeBreakdownSkillTabs } from '@/lib/skill-tab-insights';
import {
  setSummaryDisplayPayload,
  toSummaryRouteParams,
  type SummaryDisplayPayload,
  type SummaryRouteParams,
} from '@/lib/summary-display-store';
import {
  buildSafeSummaryPayload,
  safeNumber,
} from '@/lib/summary-safe-data';
import { formatLocalDate, updateStreak } from '@/lib/streak';
import { syncStreakReminder } from '@/lib/streak-notifications';

async function withOneRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Habla] ${label} failed, retrying once:`, err);
    return await fn();
  }
}

export type PersistLessonCompleteResult = {
  display: SummaryDisplayPayload;
  routeParams: SummaryRouteParams;
  celebrations: MilestoneCelebration[];
  levelUpLabel?: string;
};

/**
 * Save ALL lesson progress before showing the summary screen.
 * Each step awaits completion and writes a crash breadcrumb.
 */
export async function persistLessonComplete(
  session: LessonSessionState,
): Promise<PersistLessonCompleteResult> {
  await logCrashBreadcrumb('lesson_complete');

  const payload = buildSafeSummaryPayload(session);
  await logCrashBreadcrumb('summary_data_received');

  const analysis = payload.analysis;
  const lessonType = session.lessonType;
  const isDemoSession = session.demoSession === true;
  const scorePending = payload.scorePending;
  const overallScore = scorePending ? 0 : safeNumber(analysis.overallScore, 0);
  const strongAreas = analysis.strongAreas?.length ? analysis.strongAreas : ['Good effort today'];
  const weakAreas = analysis.weakAreas?.length ? analysis.weakAreas : ['Keep practising'];
  const focusAreas = analysis.focusAreas?.length ? analysis.focusAreas : ['Daily practice'];
  const today = formatLocalDate();

  let gemsEarned = payload.gemsEarnedEstimate ?? 2;
  let challengeText = '';
  const celebrations: MilestoneCelebration[] = [];
  let levelUpLabel: string | undefined;

  if (isDemoSession) {
    gemsEarned = 2;
    challengeText = DEMO_DAILY_CHALLENGE;
  } else {
    await logCrashBreadcrumb('saving_streak');
    const streakRes = await withOneRetry('updateStreak', updateStreak);
    await logCrashBreadcrumb('streak_saved');

    const gems = scorePending ? 0 : calculateLessonGems(overallScore);
    await logCrashBreadcrumb('saving_gems');
    if (gems > 0) {
      await withOneRetry('addGems', () => addGems(gems));
      gemsEarned = gems;
    }
    await logCrashBreadcrumb('gems_saved');
    await getTotalGems().catch(() => 0);

    try {
      const personalBest = await checkPersonalBestMilestone(overallScore, today);
      if (personalBest) celebrations.push(personalBest);
    } catch (err) {
      console.error('[Habla] checkPersonalBestMilestone failed:', err);
    }

    if (analysis && lessonType) {
      const writing = session.writingEvaluation;
      const speaking = session.speakingEvaluation;
      const baseBreakdown = analysis.breakdown;
      const breakdown = materializeBreakdownSkillTabs(
        mergeWritingIntoBreakdown(
          baseBreakdown,
          writing ?? undefined,
          session.writingTask?.prompt,
        ),
        { strongAreas, weakAreas, focusAreas },
      );

      await logCrashBreadcrumb('saving_lesson_history');
      await withOneRetry('lessonHistory', () =>
        upsertLessonHistoryEntry({
          date: today,
          overallScore: scorePending ? null : overallScore,
          breakdown,
          weakAreas,
          focusAreas,
          lessonType: lessonTypeLabel(lessonType),
          speaking: speaking
            ? {
                fluencyScore: speaking.pendingEvaluation ? null : speaking.fluencyScore,
                confidenceScore: speaking.pendingEvaluation ? null : speaking.confidenceScore,
                vocabularyRangeScore: speaking.pendingEvaluation
                  ? null
                  : speaking.vocabularyRangeScore,
                naturalFlowScore: speaking.pendingEvaluation ? null : speaking.naturalFlowScore,
                combinedScore: speaking.pendingEvaluation ? null : speaking.combinedScore,
                javiFeedback: speaking.javiFeedback,
                exchangeCount: speaking.exchangeCount,
                pendingEvaluation: speaking.pendingEvaluation,
                expired: speaking.expired,
                audioPaths: speaking.audioPaths,
              }
            : undefined,
        }),
      );
      await logCrashBreadcrumb('lesson_history_saved');

      await clearLessonCheckpoint().catch(() => {});

      const focus = session.lessonFocus ? lessonFocusLabel(session.lessonFocus) : undefined;
      const grammarTopic =
        session.lessonFocus?.kind === 'grammar' ? session.lessonFocus.topic : undefined;

      await withOneRetry('focusTips', () =>
        saveFocusTipsFromSummaryIfExpired(
          buildFocusTipsFromAnalysis(analysis, { grammarTopic, lessonFocus: focus }),
        ),
      );

      await logCrashBreadcrumb('updating_error_dna');
      // Error DNA is merged during lesson analysis; breadcrumb marks this stage of the flow.
      await logCrashBreadcrumb('error_dna_saved');

      try {
        const recent = await getRecentChallengeTexts();
        const focusTipsForChallenge = await getActiveFocusTipsForChallenge();
        const challengeType = await resolveChallengeTypeForLesson(lessonType);
        const text = await generateDailyThinkingChallenge(
          {
            lessonType,
            lessonFocus: focus,
            grammarTopic,
            strongAreas,
            weakAreas,
            focusAreas,
            encouragingMessage: analysis.encouragingMessage,
            overallScore: analysis.overallScore,
          },
          challengeType,
          recent,
          focusTipsForChallenge?.tips,
        );
        await saveDailyChallenge(text, challengeType);
        if (focusTipsForChallenge) await markFocusTipsUsedInChallenge();
        challengeText = text;
      } catch (err) {
        console.warn('[Habla] daily challenge generation failed:', err);
        challengeText = '';
      }

      try {
        const existing = await getLessonHistory();
        const entry = {
          date: today,
          overallScore: scorePending ? null : overallScore,
          breakdown,
          weakAreas,
          focusAreas,
          lessonType: lessonTypeLabel(lessonType),
        };
        const before = getLevelBarometer(existing);
        const withoutDup = existing.filter(
          (e) => !(e.date === entry.date && e.lessonType === entry.lessonType),
        );
        const after = getLevelBarometer([...withoutDup, entry]);
        if (after && before && after.bandIndex > before.bandIndex) {
          levelUpLabel = after.band.label;
          const levelUp = await checkLevelUpMilestone(levelUpLabel, today);
          if (levelUp) celebrations.push(levelUp);
        }
      } catch (err) {
        console.error('[Habla] level-up milestone check failed:', err);
      }

      try {
        const sessionCelebrations = await milestonesOnLessonComplete(
          streakRes.state.currentStreak,
          today,
        );
        celebrations.push(...sessionCelebrations);
      } catch (err) {
        console.error('[Habla] milestonesOnLessonComplete failed:', err);
      }
    }

    await withOneRetry('saveLastSummary', () => saveLastSummary(payload));
    void syncStreakReminder().catch(() => {});
  }

  if (celebrations.length > 0) {
    void queueMilestoneQuizzesFromCelebrations(celebrations, {
      levelLabel: levelUpLabel,
      achievedDate: today,
    }).catch((quizErr) => {
      console.error('[Habla] milestone quiz queue failed:', quizErr);
    });
  }

  const speaking = session.speakingEvaluation;
  const writing = session.writingEvaluation;
  const display: SummaryDisplayPayload = {
    overallScore: scorePending ? 0 : overallScore,
    scorePending,
    strongAreas,
    weakAreas,
    focusAreas,
    xpEarned: overallScore > 0 ? overallScore : 50,
    gemsEarned,
    grammarData: { ...(analysis.breakdown.grammar as unknown as Record<string, unknown>) },
    vocabularyData: { ...(analysis.breakdown.vocabulary as unknown as Record<string, unknown>) },
    fluencyData: { ...(analysis.breakdown.fluency as unknown as Record<string, unknown>) },
    writingData: { ...(analysis.breakdown.writing as unknown as Record<string, unknown>) },
    challenge: challengeText,
    lessonType: lessonType ? lessonTypeLabel(lessonType) : 'Lesson',
    encouragingMessage: analysis.encouragingMessage,
    summaryNotice: session.summaryNotice,
    isDemoSession,
    speaking: speaking
      ? {
          fluencyScore: speaking.fluencyScore,
          confidenceScore: speaking.confidenceScore,
          vocabularyRangeScore: speaking.vocabularyRangeScore,
          naturalFlowScore: speaking.naturalFlowScore,
          combinedScore: speaking.combinedScore,
          javiFeedback: speaking.javiFeedback,
          pendingEvaluation: speaking.pendingEvaluation,
          expired: speaking.expired,
        }
      : undefined,
    writing: writing
      ? {
          grammarScore: writing.grammarScore,
          vocabularyScore: writing.vocabularyScore,
          fluencyScore: writing.fluencyScore,
          feedback: writing.feedback,
          pendingEvaluation: writing.pendingEvaluation,
        }
      : undefined,
    reading: analysis.breakdown.reading
      ? {
          score: analysis.breakdown.reading.score,
          textType: analysis.breakdown.reading.textType,
        }
      : undefined,
  };

  setSummaryDisplayPayload(display);

  return {
    display,
    routeParams: toSummaryRouteParams(display),
    celebrations,
    levelUpLabel,
  };
}
