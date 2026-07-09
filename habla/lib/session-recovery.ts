import type { LessonType } from '@/lib/claude';
import type { LessonAnalysis, SpeakingEvaluation, WritingEvaluation } from '@/lib/lesson-session';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { clearLessonCheckpoint, getLessonCheckpoint } from '@/lib/lesson-checkpoint';
import {
  getPendingLessonSummaries,
  type PendingLessonSummary,
} from '@/lib/offline-lesson';
import { getPendingAudioTasks } from '@/lib/pending-audio-storage';
import { getPendingWritingTasks } from '@/lib/pending-writing-storage';
import {
  getLessonHistory,
  hasLessonHistoryFor,
  repairMissingSessionPlaceholders,
  speakingEvaluationToHistoryRecord,
  upsertLessonHistoryEntry,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { formatLocalDate, getStreakState, updateStreak } from '@/lib/streak';

export type SessionRecoveryResult = {
  checkpointsRecovered: number;
  summariesRecovered: number;
  audioRecovered: number;
  writingRecovered: number;
  placeholdersRepaired: number;
  streakUpdated: boolean;
};

function writingAverage(writing: WritingEvaluation): number | null {
  if (writing.pendingEvaluation) return null;
  return Math.round(
    (writing.grammarScore + writing.vocabularyScore + writing.fluencyScore) / 3,
  );
}

function buildRecoveredLessonAnalysis(
  focusLabel: string,
  writing: WritingEvaluation,
  writingPrompt: string,
  speaking: SpeakingEvaluation,
): LessonAnalysis {
  const writingPending = writing.pendingEvaluation === true;
  const speakingPending = speaking.pendingEvaluation === true;
  const writingAvg = writingAverage(writing);
  const speakingScore =
    speakingPending || speaking.combinedScore == null
      ? null
      : Math.round(speaking.combinedScore);

  let overallScore: number | null = null;
  if (writingAvg != null && speakingScore != null) {
    overallScore = Math.round(writingAvg * 0.4 + speakingScore * 0.6);
  } else if (writingAvg != null) {
    overallScore = writingAvg;
  } else if (speakingScore != null) {
    overallScore = speakingScore;
  }

  const baseBreakdown = {
    grammar: {
      score: writingPending ? 0 : writing.grammarScore,
      topic: focusLabel,
      details: writingPending ? ['Writing evaluation pending'] : [],
      mistakes: [],
    },
    vocabulary: {
      score: writingPending ? 0 : writing.vocabularyScore,
      topic: 'Vocabulary',
      details: [],
    },
    fluency: {
      score: speakingScore ?? 0,
      details: speakingPending ? ['Speaking evaluation pending'] : [],
      description: speakingPending
        ? 'Speaking will be scored once your recordings are processed.'
        : speaking.javiFeedback || undefined,
    },
    writing: {
      score: writingAvg ?? 0,
      details: writingPending ? ['Evaluation pending when back online'] : [],
    },
  };

  const weakAreas: string[] = [];
  if (writingPending) weakAreas.push('Writing evaluation pending');
  if (speakingPending) weakAreas.push('Speaking evaluation pending');

  return {
    strongAreas: weakAreas.length ? [] : ['Session recovered successfully'],
    weakAreas,
    focusAreas: [focusLabel],
    correctnessScore: writingAvg ?? speakingScore ?? 0,
    overallScore: overallScore ?? 0,
    encouragingMessage:
      writingPending || speakingPending
        ? 'Lesson saved. Full feedback coming when back online.'
        : '¡Buen trabajo! / Great work completing your lesson.',
    breakdown: mergeWritingIntoBreakdown(baseBreakdown, writing, writingPrompt),
  };
}

function buildHistoryEntry(params: {
  date: string;
  lessonType: string;
  focusLabel: string;
  writing: WritingEvaluation;
  writingPrompt: string;
  speaking: SpeakingEvaluation;
}): LessonHistoryEntry {
  const analysis = buildRecoveredLessonAnalysis(
    params.focusLabel,
    params.writing,
    params.writingPrompt,
    params.speaking,
  );
  const pending = params.writing.pendingEvaluation || params.speaking.pendingEvaluation;

  return {
    date: params.date,
    overallScore: pending ? null : analysis.overallScore,
    breakdown: analysis.breakdown,
    weakAreas: analysis.weakAreas,
    focusAreas: analysis.focusAreas,
    lessonType: params.lessonType,
    speaking: speakingEvaluationToHistoryRecord(params.speaking),
  };
}

async function materializeEntry(entry: LessonHistoryEntry): Promise<boolean> {
  const result = await upsertLessonHistoryEntry(entry);
  return result === 'created' || result === 'updated';
}

async function recoverCheckpoint(): Promise<number> {
  const checkpoint = await getLessonCheckpoint();
  if (!checkpoint) return 0;

  const exists = await hasLessonHistoryFor(checkpoint.lessonDate, checkpoint.lessonType);
  if (exists) {
    await clearLessonCheckpoint();
    return 0;
  }

  const saved = await materializeEntry(
    buildHistoryEntry({
      date: checkpoint.lessonDate,
      lessonType: checkpoint.lessonType,
      focusLabel: checkpoint.lessonFocusLabel,
      writing: checkpoint.writingEvaluation,
      writingPrompt: checkpoint.writingPrompt,
      speaking: checkpoint.speakingEvaluation,
    }),
  );

  if (saved) {
    await clearLessonCheckpoint();
    return 1;
  }
  return 0;
}

async function recoverPendingSummaries(): Promise<number> {
  const summaries = await getPendingLessonSummaries();
  let recovered = 0;

  for (const summary of summaries) {
    const exists = await hasLessonHistoryFor(summary.lessonDate, summary.lessonType);
    if (exists) continue;

    const saved = await materializeEntry(
      buildHistoryEntry({
        date: summary.lessonDate,
        lessonType: summary.lessonType,
        focusLabel: summary.lessonFocusLabel,
        writing: summary.writingEvaluation,
        writingPrompt: summary.writingPrompt,
        speaking: summary.speakingEvaluation,
      }),
    );
    if (saved) recovered += 1;
  }

  return recovered;
}

async function recoverPendingAudioWithoutHistory(): Promise<number> {
  const tasks = await getPendingAudioTasks();
  let recovered = 0;

  for (const task of tasks) {
    if (task.processed || task.expired) continue;
    const exists = await hasLessonHistoryFor(task.lessonDate, task.lessonType);
    if (exists) continue;

    const writing: WritingEvaluation = {
      originalText: '',
      correctedText: '',
      grammarScore: task.writingScores.grammarScore,
      vocabularyScore: task.writingScores.vocabularyScore,
      fluencyScore: task.writingScores.fluencyScore,
      structureScore: task.writingScores.structureScore,
      feedback: 'Recovered from offline speaking session.',
      corrections: [],
      pendingEvaluation: false,
    };

    const speaking: SpeakingEvaluation = {
      fluencyScore: null,
      confidenceScore: null,
      vocabularyRangeScore: null,
      naturalFlowScore: null,
      combinedScore: null,
      score: null,
      javiFeedback: 'Pending evaluation when back online.',
      feedback: 'Pending evaluation when back online.',
      exchangeCount: task.speakingConversation.filter((t) => t.role === 'user').length,
      pendingEvaluation: true,
      audioPaths: task.audioPaths,
      pendingTaskId: task.id,
    };

    const saved = await materializeEntry(
      buildHistoryEntry({
        date: task.lessonDate,
        lessonType: task.lessonType,
        focusLabel: task.lessonFocusLabel,
        writing,
        writingPrompt: task.writingPrompt,
        speaking,
      }),
    );
    if (saved) recovered += 1;
  }

  return recovered;
}

async function recoverPendingWritingWithoutHistory(): Promise<number> {
  const tasks = await getPendingWritingTasks();
  let recovered = 0;

  for (const task of tasks) {
    if (task.evaluated) continue;
    const exists = await hasLessonHistoryFor(task.lessonDate, task.lessonType);
    if (exists) continue;

    const writing: WritingEvaluation = {
      originalText: task.writtenResponse,
      correctedText: task.writtenResponse,
      grammarScore: 0,
      vocabularyScore: 0,
      fluencyScore: 0,
      feedback: 'Saved locally — Javi will mark this when you\'re back online',
      corrections: [],
      pendingEvaluation: true,
      pendingTaskId: task.id,
    };

    const speaking: SpeakingEvaluation = {
      fluencyScore: null,
      confidenceScore: null,
      vocabularyRangeScore: null,
      naturalFlowScore: null,
      combinedScore: null,
      score: null,
      javiFeedback: '',
      exchangeCount: 0,
      pendingEvaluation: false,
    };

    const saved = await materializeEntry(
      buildHistoryEntry({
        date: task.lessonDate,
        lessonType: task.lessonType,
        focusLabel: task.lessonFocusLabel,
        writing,
        writingPrompt: task.writingPrompt,
        speaking,
      }),
    );
    if (saved) recovered += 1;
  }

  return recovered;
}

async function ensureStreakForRecoveredSessions(dates: Iterable<string>): Promise<boolean> {
  const today = formatLocalDate();
  if (![...dates].includes(today)) return false;

  const streak = await getStreakState();
  const todayCompleted = streak.last7Days.find((d) => d.date === today)?.completed;
  if (todayCompleted) return false;

  await updateStreak();
  return true;
}

/** Pick up lesson sessions that finished offline or stalled before summary/history save. */
export async function recoverUnregisteredSessions(): Promise<SessionRecoveryResult> {
  const today = formatLocalDate();
  const historyBefore = await getLessonHistory();
  const hadTodayBefore = historyBefore.some((e) => e.date === today);

  const checkpointsRecovered = await recoverCheckpoint();
  const summariesRecovered = await recoverPendingSummaries();
  const audioRecovered = await recoverPendingAudioWithoutHistory();
  const writingRecovered = await recoverPendingWritingWithoutHistory();
  const placeholdersRepaired = await repairMissingSessionPlaceholders();

  const historyAfter = await getLessonHistory();
  const hasTodayAfter = historyAfter.some((e) => e.date === today);
  const recoveredDates: string[] = [];
  if (!hadTodayBefore && hasTodayAfter) {
    recoveredDates.push(today);
  }
  const streakUpdated = await ensureStreakForRecoveredSessions(recoveredDates);

  return {
    checkpointsRecovered,
    summariesRecovered,
    audioRecovered,
    writingRecovered,
    placeholdersRepaired,
    streakUpdated,
  };
}

export async function persistLessonProgress(params: {
  date: string;
  lessonType: string;
  focusLabel: string;
  writing: WritingEvaluation;
  writingPrompt: string;
  speaking: SpeakingEvaluation;
}): Promise<boolean> {
  return materializeEntry(buildHistoryEntry(params));
}

export function buildHistoryEntryFromPendingSummary(summary: PendingLessonSummary): LessonHistoryEntry {
  return buildHistoryEntry({
    date: summary.lessonDate,
    lessonType: summary.lessonType,
    focusLabel: summary.lessonFocusLabel,
    writing: summary.writingEvaluation,
    writingPrompt: summary.writingPrompt,
    speaking: summary.speakingEvaluation,
  });
}

export function buildHistoryEntryFromAnalysis(params: {
  date: string;
  lessonType: string;
  analysis: LessonAnalysis;
  speaking?: SpeakingEvaluation;
  writingPending?: boolean;
}): LessonHistoryEntry {
  const pending = params.writingPending || params.speaking?.pendingEvaluation;
  return {
    date: params.date,
    overallScore: pending ? null : params.analysis.overallScore,
    breakdown: params.analysis.breakdown,
    weakAreas: params.analysis.weakAreas,
    focusAreas: params.analysis.focusAreas,
    lessonType: params.lessonType,
    speaking: params.speaking ? speakingEvaluationToHistoryRecord(params.speaking) : undefined,
  };
}
