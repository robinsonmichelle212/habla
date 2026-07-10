import { calculateLessonGems } from '@/lib/gems';
import type { LessonAnalysis, LessonBreakdown, LessonSessionState } from '@/lib/lesson-session';
import {
  isOverallScorePending,
  resolveSummaryAnalysis,
} from '@/lib/lesson-summary-fallback';

export function safeNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function safeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return items.length > 0 ? items : fallback;
}

function defaultBreakdown(): LessonBreakdown {
  return {
    grammar: { score: 0, topic: 'Grammar', details: [], mistakes: [] },
    vocabulary: { score: 0, topic: 'Vocabulary', details: [] },
    fluency: { score: 0, details: [] },
    writing: { score: 0, details: [] },
  };
}

export function normalizeBreakdown(raw?: Partial<LessonBreakdown> | null): LessonBreakdown {
  const base = defaultBreakdown();
  if (!raw) return base;

  return {
    ...base,
    grammar: {
      ...base.grammar,
      ...raw.grammar,
      score: safeNumber(raw.grammar?.score, 0),
      topic: raw.grammar?.topic ?? base.grammar.topic,
      details: Array.isArray(raw.grammar?.details) ? raw.grammar.details : [],
      mistakes: Array.isArray(raw.grammar?.mistakes) ? raw.grammar.mistakes : [],
    },
    vocabulary: {
      ...base.vocabulary,
      ...raw.vocabulary,
      score: safeNumber(raw.vocabulary?.score, 0),
      topic: raw.vocabulary?.topic ?? base.vocabulary.topic,
      details: Array.isArray(raw.vocabulary?.details) ? raw.vocabulary.details : [],
    },
    fluency: {
      ...base.fluency,
      ...raw.fluency,
      score: safeNumber(raw.fluency?.score, 0),
      details: Array.isArray(raw.fluency?.details) ? raw.fluency.details : [],
    },
    writing: {
      ...base.writing,
      ...raw.writing,
      score: safeNumber(raw.writing?.score, 0),
      details: Array.isArray(raw.writing?.details) ? raw.writing.details : [],
    },
    structure: raw.structure
      ? {
          ...raw.structure,
          score: safeNumber(raw.structure.score, 0),
          topic: raw.structure.topic ?? 'Structure',
          details: Array.isArray(raw.structure.details) ? raw.structure.details : [],
        }
      : undefined,
    reading: raw.reading
      ? {
          ...raw.reading,
          score: safeNumber(raw.reading.score, 0),
          topic: raw.reading.topic ?? 'Reading',
          textType: raw.reading.textType ?? '',
          details: Array.isArray(raw.reading.details) ? raw.reading.details : [],
        }
      : undefined,
  };
}

/** Ensure every field the summary screen reads has a safe fallback. */
export function normalizeSummaryAnalysis(analysis: LessonAnalysis | null | undefined): LessonAnalysis {
  if (!analysis) {
    return {
      strongAreas: ['Good effort today'],
      weakAreas: ['Keep practising'],
      focusAreas: ['Daily practice'],
      correctnessScore: 0,
      overallScore: 0,
      encouragingMessage: '¡Buen trabajo! / Great work completing your lesson.',
      breakdown: defaultBreakdown(),
    };
  }

  return {
    strongAreas: safeStringArray(analysis.strongAreas, ['Good effort today']),
    weakAreas: safeStringArray(analysis.weakAreas, ['Keep practising']),
    focusAreas: safeStringArray(analysis.focusAreas, ['Daily practice']),
    correctnessScore: safeNumber(analysis.correctnessScore, 0),
    overallScore: safeNumber(
      analysis.overallScore ?? analysis.correctnessScore,
      0,
    ),
    encouragingMessage:
      typeof analysis.encouragingMessage === 'string'
        ? analysis.encouragingMessage
        : '¡Buen trabajo! / Great work completing your lesson.',
    breakdown: normalizeBreakdown(analysis.breakdown),
  };
}

export type SafeSummaryPayload = {
  session: LessonSessionState;
  analysis: LessonAnalysis;
  scorePending: boolean;
  overallScore: number;
  gemsEarnedEstimate: number;
  xpEarned: number;
};

export function buildSafeSummaryPayload(session: LessonSessionState): SafeSummaryPayload {
  let rawAnalysis: LessonAnalysis | null = null;
  try {
    rawAnalysis = resolveSummaryAnalysis(session);
  } catch (err) {
    console.error('[Habla] resolveSummaryAnalysis failed:', err);
  }

  const analysis = normalizeSummaryAnalysis(rawAnalysis);
  const scorePending = isOverallScorePending(session, rawAnalysis);
  const overallScore = scorePending ? 0 : safeNumber(analysis.overallScore, 0);
  const gemsEarnedEstimate = scorePending ? 2 : calculateLessonGems(overallScore) || 2;
  const xpEarned = overallScore > 0 ? overallScore : 50;

  return {
    session,
    analysis,
    scorePending,
    overallScore,
    gemsEarnedEstimate,
    xpEarned,
  };
}

export function logSummaryData(payload: SafeSummaryPayload): void {
  const summaryData = {
    analysis: payload.analysis,
    strongAreas: payload.analysis.strongAreas,
    weakAreas: payload.analysis.weakAreas,
    overallScore: payload.overallScore,
    xpEarned: payload.xpEarned,
    gemsEarned: payload.gemsEarnedEstimate,
    speaking: payload.session.speakingEvaluation,
    writing: payload.session.writingEvaluation,
  };
  console.log('Summary data received:', summaryData);
  console.log('Strong areas:', summaryData?.strongAreas);
  console.log('Weak areas:', summaryData?.weakAreas);
  console.log('XP earned:', summaryData?.xpEarned);
}

export type FallbackScoreLines = {
  overall: string;
  grammar: string;
  vocabulary: string;
  fluency: string;
  writing: string;
};

export function buildFallbackScoreLines(payload: SafeSummaryPayload): FallbackScoreLines {
  const { analysis, session, scorePending } = payload;
  const writing = session.writingEvaluation;
  const speaking = session.speakingEvaluation;
  const breakdown = analysis.breakdown;

  const fmt = (label: string, value: number | null | undefined, pending = false) => {
    if (pending || value == null) return `${label}: Pending ⏳`;
    return `${label}: ${safeNumber(value)}%`;
  };

  const speakingPending =
    scorePending || speaking?.pendingEvaluation || speaking?.combinedScore == null;
  const writingPending = scorePending || writing?.pendingEvaluation;

  return {
    overall: fmt('Overall', scorePending ? null : analysis.overallScore, scorePending),
    grammar: fmt(
      'Grammar',
      writingPending ? null : (writing?.grammarScore ?? breakdown.grammar.score),
      writingPending,
    ),
    vocabulary: fmt(
      'Vocabulary',
      writingPending ? null : (writing?.vocabularyScore ?? breakdown.vocabulary.score),
      writingPending,
    ),
    fluency: fmt(
      'Fluency',
      speakingPending ? null : (speaking?.combinedScore ?? breakdown.fluency.score),
      speakingPending,
    ),
    writing: fmt(
      'Writing',
      writingPending
        ? null
        : (breakdown.writing.score ||
            (writing
              ? safeNumber(
                  (writing.grammarScore + writing.vocabularyScore + writing.fluencyScore) / 3,
                )
              : 0)),
      writingPending,
    ),
  };
}
