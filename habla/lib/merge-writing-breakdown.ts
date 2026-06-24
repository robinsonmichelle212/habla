import type { LessonBreakdown } from '@/lib/lesson-session';
import type { WritingEvaluation } from '@/lib/lesson-session';

/** Merge writing evaluation fields into the breakdown.writing section for history storage. */
export function mergeWritingIntoBreakdown(
  breakdown: LessonBreakdown,
  writing: WritingEvaluation | undefined,
  writingPrompt?: string,
): LessonBreakdown {
  if (!writing) return breakdown;

  const w = Math.round(
    (writing.grammarScore + writing.vocabularyScore + writing.fluencyScore) / 3,
  );

  return {
    ...breakdown,
    writing: {
      ...breakdown.writing,
      score: breakdown.writing.score || w,
      originalText: writing.originalText,
      correctedText: writing.correctedText,
      corrections: writing.corrections,
      accentIssues: writing.accentIssues ?? [],
      structuralFeedback: writing.structuralFeedback ?? [],
      writingPrompt: writingPrompt ?? breakdown.writing.writingPrompt,
      details: breakdown.writing.details.length
        ? breakdown.writing.details
        : [writing.feedback].filter(Boolean),
    },
  };
}
