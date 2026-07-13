import type { LessonType } from '@/lib/claude';
import { buildOfflineLessonAnalysis } from '@/lib/offline-lesson';
import type {
  LessonAnalysis,
  LessonSessionState,
  SpeakingEvaluation,
  WritingEvaluation,
} from '@/lib/lesson-session';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { normalizeSummaryAnalysis } from '@/lib/summary-safe-data';

export function buildPendingSpeakingEvaluation(
  exchangeCount: number,
  note = 'Pending evaluation when back online.',
): SpeakingEvaluation {
  return {
    fluencyScore: null,
    confidenceScore: null,
    vocabularyRangeScore: null,
    naturalFlowScore: null,
    combinedScore: null,
    score: null,
    javiFeedback: note,
    feedback: note,
    exchangeCount,
    pendingEvaluation: true,
  };
}

export function buildFallbackLessonAnalysis(params: {
  lessonType: LessonType;
  lessonFocus: LessonFocusContext;
  writing: WritingEvaluation;
  writingPrompt: string;
  speaking?: SpeakingEvaluation | null;
}): LessonAnalysis {
  const speaking = params.speaking;
  if (!speaking || speaking.pendingEvaluation === true || speaking.combinedScore == null) {
    return buildOfflineLessonAnalysis(
      params.lessonType,
      params.lessonFocus,
      params.writing,
      params.writingPrompt,
      true,
    );
  }

  const writingAvg = params.writing.pendingEvaluation
    ? 0
    : Math.round(
        (params.writing.grammarScore +
          params.writing.vocabularyScore +
          params.writing.fluencyScore) /
          3,
      );
  const speakingScore = Math.round(speaking.combinedScore ?? 0);
  const overallScore = Math.round(writingAvg * 0.4 + speakingScore * 0.6);
  const topic = lessonFocusLabel(params.lessonFocus);

  const baseBreakdown = {
    grammar: {
      score: params.writing.pendingEvaluation ? 0 : params.writing.grammarScore,
      topic,
      details: [],
      didWell: ['Completed grammar practice in the lesson'],
      workOn: ['Review grammar points that felt uncertain'],
      focusThisWeek: [`Practise ${topic} in three new sentences`],
      mistakes: [],
    },
    vocabulary: {
      score: params.writing.pendingEvaluation ? 0 : params.writing.vocabularyScore,
      topic: 'Vocabulary',
      details: [],
      didWell: ['Used lesson vocabulary during practice'],
      workOn: ['Strengthen words that needed hesitation'],
      focusThisWeek: ['Review today\'s vocabulary before your next lesson'],
    },
    fluency: {
      score: speakingScore,
      details: [],
      didWell: ['Completed the speaking exchanges'],
      workOn: ['Keep answers flowing with fewer pauses'],
      focusThisWeek: ['Say one answer aloud without stopping mid-sentence'],
      description: speaking.javiFeedback,
    },
    writing: {
      score: writingAvg,
      details: [],
      didWell: ['Finished the writing section'],
      workOn: ['Check accents and verb endings in writing'],
      focusThisWeek: ['Rewrite one sentence from today more accurately'],
    },
  };

  return {
    strongAreas: ['Lesson completed'],
    weakAreas: [],
    focusAreas: [topic],
    correctnessScore: writingAvg,
    overallScore,
    encouragingMessage: '¡Buen trabajo! / Great work completing your lesson.',
    breakdown: mergeWritingIntoBreakdown(baseBreakdown, params.writing, params.writingPrompt),
  };
}

/** Build a displayable analysis from whatever the session captured. */
export function resolveSummaryAnalysis(session: LessonSessionState): LessonAnalysis | null {
  if (session.analysis) return normalizeSummaryAnalysis(session.analysis);
  if (!session.lessonType || !session.lessonFocus || !session.writingEvaluation) {
    return null;
  }
  return normalizeSummaryAnalysis(
    buildFallbackLessonAnalysis({
      lessonType: session.lessonType,
      lessonFocus: session.lessonFocus,
      writing: session.writingEvaluation,
      writingPrompt: session.writingTask?.prompt ?? '',
      speaking: session.speakingEvaluation,
    }),
  );
}

export function isOverallScorePending(session: LessonSessionState, analysis: LessonAnalysis | null): boolean {
  if (session.writingEvaluation?.pendingEvaluation) return true;
  if (session.speakingEvaluation?.pendingEvaluation) return true;
  if (session.speakingEvaluation && session.speakingEvaluation.combinedScore == null) return true;
  if (!analysis) return true;
  return false;
}
