import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { overallLessonScore } from '@/lib/practice-storage';

export const LEVEL_BANDS = [
  { id: 'b1-beginner', label: 'B1 Beginner', min: 0, max: 60 },
  { id: 'b1-developing', label: 'B1 Developing', min: 60, max: 70 },
  { id: 'b1-confident', label: 'B1 Confident', min: 70, max: 85 },
  { id: 'b1-strong', label: 'B1 Strong', min: 85, max: 90 },
  { id: 'b2-emerging', label: 'B2 Emerging', min: 90, max: 93 },
  { id: 'b2-developing', label: 'B2 Developing', min: 93, max: 97 },
  { id: 'b2-confident', label: 'B2 Confident', min: 97, max: 100 },
] as const;

export type LevelBandId = (typeof LEVEL_BANDS)[number]['id'];

export type LevelBand = (typeof LEVEL_BANDS)[number];

export type LevelBarometer = {
  band: LevelBand;
  bandIndex: number;
  averageScore: number;
  progressInBand: number;
  nextBand: LevelBand | null;
  nextBandThreshold: number | null;
  message: string;
};

export type SkillSnapshot = {
  skill: 'Grammar' | 'Vocabulary' | 'Fluency' | 'Writing' | 'Structure';
  average: number;
  status: 'strong' | 'needs-work' | 'weak';
};

export type NextLevelRequirements = {
  currentAverage: number;
  targetAverage: number;
  gap: number;
  estimatedSessions: number | null;
  skillsToImprove: SkillSnapshot[];
};

const RECENT_SESSION_COUNT = 10;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getRecentAverageScore(history: LessonHistoryEntry[]): number | null {
  const recent = history.filter((e) => !e.placeholder).slice(-RECENT_SESSION_COUNT);
  if (!recent.length) return null;
  return clampScore(
    recent.reduce((sum, e) => sum + overallLessonScore(e), 0) / recent.length,
  );
}

export function getBandForScore(avg: number): { band: LevelBand; index: number } {
  const score = clampScore(avg);
  for (let i = LEVEL_BANDS.length - 1; i >= 0; i--) {
    const band = LEVEL_BANDS[i];
    if (score >= band.min) {
      return { band, index: i };
    }
  }
  return { band: LEVEL_BANDS[0], index: 0 };
}

export function getProgressInBand(avg: number, band: LevelBand): number {
  const score = clampScore(avg);
  const range = band.max - band.min;
  if (range <= 0) return 100;
  const position = score - band.min;
  return clampScore(Math.round((position / range) * 100));
}

export function getLevelBarometer(history: LessonHistoryEntry[]): LevelBarometer | null {
  const averageScore = getRecentAverageScore(history);
  if (averageScore == null) return null;

  const { band, index } = getBandForScore(averageScore);
  const nextBand = index < LEVEL_BANDS.length - 1 ? LEVEL_BANDS[index + 1] : null;
  const progressInBand = getProgressInBand(averageScore, band);
  const nextBandThreshold = nextBand?.min ?? null;

  let message: string;
  if (nextBand && nextBandThreshold != null) {
    message = `You are ${progressInBand}% through ${band.label}. Reach ${nextBandThreshold}% average to unlock ${nextBand.label}.`;
  } else {
    message = `You are at the top band — ${band.label}. Keep practising to stay sharp!`;
  }

  return {
    band,
    bandIndex: index,
    averageScore,
    progressInBand,
    nextBand,
    nextBandThreshold,
    message,
  };
}

/** B1→B2 label from average score across the last 10 sessions. */
export function getProgressionLevel(history: LessonHistoryEntry[]): string | null {
  const barometer = getLevelBarometer(history);
  return barometer?.band.label ?? null;
}

function skillStatus(avg: number): SkillSnapshot['status'] {
  if (avg >= 80) return 'strong';
  if (avg >= 65) return 'needs-work';
  return 'weak';
}

export function getSkillSnapshots(history: LessonHistoryEntry[]): SkillSnapshot[] {
  const recent = history.filter((e) => !e.placeholder).slice(-RECENT_SESSION_COUNT);
  if (!recent.length) return [];

  const sums = { grammar: 0, vocabulary: 0, fluency: 0, writing: 0, structure: 0 };
  let structureCount = 0;
  for (const entry of recent) {
    sums.grammar += entry.breakdown.grammar.score;
    sums.vocabulary += entry.breakdown.vocabulary.score;
    sums.fluency += entry.breakdown.fluency.score;
    sums.writing += entry.breakdown.writing.score;
    if (entry.breakdown.structure) {
      sums.structure += entry.breakdown.structure.score;
      structureCount += 1;
    }
  }
  const n = recent.length;
  const skills: SkillSnapshot[] = [
    { skill: 'Grammar', average: clampScore(sums.grammar / n), status: 'needs-work' },
    { skill: 'Vocabulary', average: clampScore(sums.vocabulary / n), status: 'needs-work' },
    { skill: 'Fluency', average: clampScore(sums.fluency / n), status: 'needs-work' },
    { skill: 'Writing', average: clampScore(sums.writing / n), status: 'needs-work' },
  ];
  if (structureCount > 0) {
    skills.push({
      skill: 'Structure',
      average: clampScore(sums.structure / structureCount),
      status: 'needs-work',
    });
  }
  return skills.map((s) => ({ ...s, status: skillStatus(s.average) }));
}

/** Sessions needed at recent improvement rate to reach next band. */
export function getNextLevelRequirements(history: LessonHistoryEntry[]): NextLevelRequirements | null {
  const barometer = getLevelBarometer(history);
  if (!barometer) return null;

  const currentAverage = barometer.averageScore;
  const targetAverage = barometer.nextBandThreshold ?? currentAverage;
  const gap = Math.max(0, targetAverage - currentAverage);

  let estimatedSessions: number | null = null;
  if (gap > 0 && history.length >= 2) {
    const recent = history.filter((e) => !e.placeholder).slice(-RECENT_SESSION_COUNT);
    const scores = recent.map((e) => overallLessonScore(e));
    let totalDelta = 0;
    for (let i = 1; i < scores.length; i++) {
      totalDelta += scores[i] - scores[i - 1];
    }
    const avgImprovement = totalDelta / Math.max(1, scores.length - 1);
    if (avgImprovement > 0.5) {
      estimatedSessions = Math.ceil(gap / avgImprovement);
    }
  }

  const skills = getSkillSnapshots(history)
    .filter((s) => s.status !== 'strong')
    .sort((a, b) => a.average - b.average);

  return {
    currentAverage,
    targetAverage,
    gap,
    estimatedSessions,
    skillsToImprove: skills.length ? skills : getSkillSnapshots(history).sort((a, b) => a.average - b.average),
  };
}

/** Estimate sessions to reach a target average at the current improvement pace. */
export function estimateSessionsToReachScore(
  currentAverage: number,
  targetAverage: number,
  history: LessonHistoryEntry[],
): number | null {
  const gap = Math.max(0, targetAverage - currentAverage);
  if (gap <= 0) return 0;
  if (history.length < 2) return null;

  const recent = history.filter((e) => !e.placeholder).slice(-RECENT_SESSION_COUNT);
  const scores = recent.map((e) => overallLessonScore(e));
  let totalDelta = 0;
  for (let i = 1; i < scores.length; i++) {
    totalDelta += scores[i] - scores[i - 1];
  }
  const avgImprovement = totalDelta / Math.max(1, scores.length - 1);
  if (avgImprovement <= 0.5) return null;
  return Math.ceil(gap / avgImprovement);
}

export function getRecentLessonScores(history: LessonHistoryEntry[], count = 5): number[] {
  return history
    .filter((e) => !e.placeholder)
    .slice(-count)
    .map((e) => overallLessonScore(e));
}

export type ScoreTrendDirection = 'up' | 'down' | 'steady' | 'insufficient';

export function getScoreTrend(scores: number[]): {
  direction: ScoreTrendDirection;
  message: string;
} {
  if (scores.length < 2) {
    return {
      direction: 'insufficient',
      message: 'Complete more lessons to see your trend',
    };
  }
  const mid = Math.floor(scores.length / 2);
  const earlier = scores.slice(0, mid);
  const later = scores.slice(mid);
  const avgEarlier = earlier.reduce((sum, s) => sum + s, 0) / earlier.length;
  const avgLater = later.reduce((sum, s) => sum + s, 0) / later.length;
  const delta = avgLater - avgEarlier;

  if (delta >= 3) {
    return { direction: 'up', message: 'Trending up ↗ — keep going' };
  }
  if (delta <= -3) {
    return { direction: 'down', message: 'Trending down ↘ — review weak areas in practice' };
  }
  return {
    direction: 'steady',
    message: 'Scores vary — consistency will move you forward',
  };
}

export function shortBandLabel(label: string): { tier: string; name: string } {
  if (label.startsWith('B1 ')) return { tier: 'B1', name: label.slice(3) };
  if (label.startsWith('B2 ')) return { tier: 'B2', name: label.slice(3) };
  return { tier: '', name: label };
}

export function averageScoreForTopic(
  history: LessonHistoryEntry[],
  topic: string,
  field: 'grammar' | 'vocabulary',
): number | null {
  const key = topic.trim().toLowerCase();
  const matching = history.filter((e) => {
    if (e.placeholder) return false;
    const t =
      field === 'grammar'
        ? e.breakdown.grammar.topic
        : e.breakdown.vocabulary.topic;
    return t.trim().toLowerCase() === key;
  });
  if (!matching.length) return null;
  return clampScore(
    matching.reduce((sum, e) => sum + overallLessonScore(e), 0) / matching.length,
  );
}
