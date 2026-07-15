import type { LessonBreakdown } from '@/lib/lesson-session';
import type { WritingEvaluation } from '@/lib/lesson-session';

function safeScore(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Merge writing evaluation fields into the breakdown.writing section for history storage. */
export function mergeWritingIntoBreakdown(
  breakdown: LessonBreakdown,
  writing: WritingEvaluation | undefined,
  writingPrompt?: string,
): LessonBreakdown {
  if (!writing) return breakdown;

  const existingWriting = breakdown.writing ?? {
    score: 0,
    details: [] as string[],
  };

  const w = Math.round(
    (safeScore(writing.grammarScore) +
      safeScore(writing.vocabularyScore) +
      safeScore(writing.fluencyScore)) /
      3,
  );

  return {
    ...breakdown,
    writing: {
      ...existingWriting,
      score: safeScore(existingWriting.score) || w,
      originalText: writing.originalText,
      correctedText: writing.correctedText,
      corrections: writing.corrections,
      accentIssues: writing.accentIssues ?? [],
      structuralFeedback: writing.structuralFeedback ?? [],
      writingPrompt: writingPrompt ?? existingWriting.writingPrompt,
      details: (existingWriting.details ?? []).length
        ? (existingWriting.details ?? [])
        : [writing.feedback].filter(Boolean),
    },
  };
}
