import AsyncStorage from '@react-native-async-storage/async-storage';

import { isStreakSessionLesson, overallLessonScore } from '@/lib/practice-storage';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { getLessonHistory } from '@/lib/practice-storage';

export const HIGHEST_LEVEL_KEY = 'highestLevelAchieved';
export const LEVEL_RESTORATION_KEY = 'levelRestorationApplied';

/** Score thresholds — label derived from recent average via calculateLevelFromScore. */
export const LEVEL_BANDS = [
  { id: 'b1-beginner', label: 'B1 Beginner', min: 0, max: 59 },
  { id: 'b1-developing', label: 'B1 Developing', min: 60, max: 69 },
  { id: 'b1-confident', label: 'B1 Confident', min: 70, max: 79 },
  { id: 'b1-strong', label: 'B1 Strong', min: 80, max: 84 },
  { id: 'b2-emerging', label: 'B2 Emerging', min: 85, max: 89 },
  { id: 'b2-developing', label: 'B2 Developing', min: 90, max: 94 },
  { id: 'b2-confident', label: 'B2 Confident', min: 95, max: 100 },
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
const CONFIDENT_FLOOR_LABEL = 'B1 Confident';

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getRecentAverageScore(history: LessonHistoryEntry[]): number | null {
  const recent = history.filter((e) => !e.placeholder && !isStreakSessionLesson(e)).slice(-RECENT_SESSION_COUNT);

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

/** Map a single session score to its level label. */
export function calculateLevelFromScore(score: number): string {
  return getBandForScore(score).band.label;
}

export function getLevelRank(level: string | null | undefined): number {
  if (!level) return -1;
  const trimmed = level.trim();
  const index = LEVEL_BANDS.findIndex((b) => b.id === trimmed || b.label === trimmed);
  return index;
}

export function levelLabelFromStored(level: string | null | undefined): string {
  const rank = getLevelRank(level);
  return rank >= 0 ? LEVEL_BANDS[rank].label : 'B1 Beginner';
}

export function levelIdFromStored(level: string | null | undefined): LevelBandId {
  const rank = getLevelRank(level);
  return rank >= 0 ? LEVEL_BANDS[rank].id : 'b1-beginner';
}

export function parseStoredLevel(raw: string | null | undefined): LevelBand | null {
  const rank = getLevelRank(raw);
  return rank >= 0 ? LEVEL_BANDS[rank] : null;
}

export function getProgressInBand(avg: number, band: LevelBand): number {
  const score = clampScore(avg);
  const range = band.max - band.min + 1;
  if (range <= 0) return 100;
  const position = score - band.min;
  return clampScore(Math.round((position / range) * 100));
}

function buildBarometer(averageScore: number, bandIndex: number): LevelBarometer {
  const index = Math.max(0, Math.min(LEVEL_BANDS.length - 1, bandIndex));
  const band = LEVEL_BANDS[index];
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

export function getLevelBarometer(
  history: LessonHistoryEntry[],
  highestLevel?: string | null,
): LevelBarometer | null {
  const averageScore = getRecentAverageScore(history);
  if (averageScore == null) return null;

  const calculated = getBandForScore(averageScore);
  const highestRank = getLevelRank(highestLevel);
  const displayIndex = Math.max(calculated.index, highestRank >= 0 ? highestRank : calculated.index);
  return buildBarometer(averageScore, displayIndex);
}

export async function getHighestLevelAchieved(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(HIGHEST_LEVEL_KEY);
  } catch {
    return null;
  }
}

export async function recordHighestLevelIfNeeded(level: string): Promise<void> {
  const highestEver = await getHighestLevelAchieved();
  const levelRank = getLevelRank(level);
  if (levelRank > getLevelRank(highestEver)) {
    await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, LEVEL_BANDS[levelRank].id);
  }
}

function collectRealLessonScores(history: LessonHistoryEntry[]): number[] {
  return history
    .filter((lesson) => !lesson.placeholder && !isStreakSessionLesson(lesson) && lesson.overallScore != null)
    .map((lesson) => overallLessonScore(lesson))
    .filter((score) => score > 0);
}

function levelIdFromAverageScore(avg: number): LevelBandId {
  return getBandForScore(avg).band.id;
}

/**
 * Correct an incorrectly stored B2+ level using full score history.
 * Runs on app open; clears the one-time restoration flag so history can be rebuilt.
 */
export async function correctHighestLevelFromHistory(): Promise<void> {
  try {
    const storedRaw = await getHighestLevelAchieved();
    const storedRank = getLevelRank(storedRaw);
    const b2MinRank = getLevelRank('B2 Emerging');

    const history = await getLessonHistory();
    const realScores = collectRealLessonScores(history);
    const hasLessonHistory = realScores.length > 0;

    let correctId: LevelBandId = 'b1-confident';
    if (hasLessonHistory) {
      const avgScore = realScores.reduce((sum, score) => sum + score, 0) / realScores.length;
      correctId = levelIdFromAverageScore(avgScore);
      const confidentRank = getLevelRank(CONFIDENT_FLOOR_LABEL);
      if (getLevelRank(correctId) < confidentRank) {
        correctId = 'b1-confident';
      }
    }

    const correctRank = getLevelRank(correctId);
    if (storedRank >= b2MinRank || storedRank > correctRank) {
      await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, correctId);
      console.log(
        '[Habla] Level corrected from',
        storedRaw,
        'to',
        levelLabelFromStored(correctId),
        hasLessonHistory
          ? `based on avg: ${Math.round(realScores.reduce((sum, score) => sum + score, 0) / realScores.length)}`
          : '',
      );
    }

    await AsyncStorage.removeItem(LEVEL_RESTORATION_KEY);
  } catch (err) {
    console.warn('[Habla] correctHighestLevelFromHistory failed:', err);
  }
}

/**
 * One-time migration: rebuild highestLevelAchieved from full lesson history.
 * Floors to at least B1 Confident when the user has lesson history.
 */
export async function restoreLevelFromHistory(): Promise<void> {
  try {
    const applied = await AsyncStorage.getItem(LEVEL_RESTORATION_KEY);
    if (applied) return;

    const history = await getLessonHistory();
    const realScores = collectRealLessonScores(history);
    let highestRank = -1;
    let highestLevel = 'B1 Developing';
    let highestId: LevelBandId = 'b1-developing';

    for (const score of realScores) {
      const band = getBandForScore(score);
      if (band.index > highestRank) {
        highestRank = band.index;
        highestLevel = band.band.label;
        highestId = band.band.id;
      }
    }

    if (realScores.length > 0) {
      const avgScore = realScores.reduce((sum, score) => sum + score, 0) / realScores.length;
      const avgBand = getBandForScore(avgScore);
      if (avgBand.index > highestRank) {
        highestRank = avgBand.index;
        highestLevel = avgBand.band.label;
        highestId = avgBand.band.id;
      }

      const b2MinRank = getLevelRank('B2 Emerging');
      if (avgScore < 85 && highestRank >= b2MinRank) {
        const b1StrongRank = getLevelRank('B1 Strong');
        if (highestRank > b1StrongRank) {
          highestRank = b1StrongRank;
          highestLevel = 'B1 Strong';
          highestId = 'b1-strong';
        }
      }
    }

    const storedHighest = await getHighestLevelAchieved();
    const storedRank = getLevelRank(storedHighest);
    if (storedRank > highestRank) {
      highestRank = storedRank;
      highestLevel = levelLabelFromStored(storedHighest);
      highestId = levelIdFromStored(storedHighest);
    }

    const hasLessonHistory = realScores.length > 0;

    const confidentRank = getLevelRank(CONFIDENT_FLOOR_LABEL);
    if (hasLessonHistory && highestRank < confidentRank) {
      highestRank = confidentRank;
      highestLevel = CONFIDENT_FLOOR_LABEL;
      highestId = 'b1-confident';
    }

    await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, highestId);
    await AsyncStorage.setItem(LEVEL_RESTORATION_KEY, 'true');
    console.log('[Habla] Level restored to:', highestLevel);
  } catch (err) {
    console.warn('[Habla] restoreLevelFromHistory failed:', err);
  }
}

/**
 * Returns the displayed level — never below historical best.
 * Updates highestLevelAchieved when the calculated level is a new peak.
 */
export async function getCurrentLevel(recentAverage: number): Promise<string> {
  const calculated = getBandForScore(recentAverage);
  const calculatedLabel = calculated.band.label;
  const highestRaw = await getHighestLevelAchieved();
  const highestLabel = levelLabelFromStored(highestRaw);

  const calculatedRank = getLevelRank(calculatedLabel);
  const highestRank = getLevelRank(highestLabel);

  if (calculatedRank >= highestRank) {
    await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, calculated.band.id);
    return calculatedLabel;
  }

  return highestLabel;
}

/** Floors displayed band to highest ever achieved; progress reflects position within displayed band. */
export async function resolveLevelBarometer(
  history: LessonHistoryEntry[],
): Promise<LevelBarometer | null> {
  await restoreLevelFromHistory();

  const averageScore = getRecentAverageScore(history);
  if (averageScore == null) return null;

  const displayLabel = await getCurrentLevel(averageScore);
  const displayIndex = getLevelRank(displayLabel);
  return buildBarometer(averageScore, displayIndex >= 0 ? displayIndex : 0);
}

/** B1→B2 label from recent average, floored to historical best. */
export async function getProgressionLevel(history: LessonHistoryEntry[]): Promise<string | null> {
  const barometer = await resolveLevelBarometer(history);
  return barometer?.band.label ?? null;
}

function skillStatus(avg: number): SkillSnapshot['status'] {
  if (avg >= 80) return 'strong';
  if (avg >= 65) return 'needs-work';
  return 'weak';
}

export function getSkillSnapshots(history: LessonHistoryEntry[]): SkillSnapshot[] {
  const recent = history.filter((e) => !e.placeholder && !isStreakSessionLesson(e)).slice(-RECENT_SESSION_COUNT);

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
export function getNextLevelRequirements(
  history: LessonHistoryEntry[],
  barometerOverride?: LevelBarometer | null,
): NextLevelRequirements | null {
  const barometer = barometerOverride ?? getLevelBarometer(history);
  if (!barometer) return null;

  const currentAverage = barometer.averageScore;
  const targetAverage = barometer.nextBandThreshold ?? currentAverage;
  const gap = Math.max(0, targetAverage - currentAverage);

  let estimatedSessions: number | null = null;
  if (gap > 0 && history.length >= 2) {
    const recent = history.filter((e) => !e.placeholder && !isStreakSessionLesson(e)).slice(-RECENT_SESSION_COUNT);

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

  const recent = history.filter((e) => !e.placeholder && !isStreakSessionLesson(e)).slice(-RECENT_SESSION_COUNT);

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
    .filter((e) => !e.placeholder && !isStreakSessionLesson(e))
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
    if (e.placeholder || isStreakSessionLesson(e)) return false;
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
