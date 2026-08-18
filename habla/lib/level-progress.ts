import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONFIRMED_LEVEL_KEY } from '@/lib/onboarding-storage';
import {
  getLessonHistory,
  isStreakSessionLesson,
  overallLessonScore,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';

export const HIGHEST_LEVEL_KEY = 'highestLevelAchieved';
export const LEVEL_RESTORATION_KEY = 'levelRestorationApplied';
export const LEVEL_LAST_UPDATED_KEY = 'levelLastUpdated';
const LEVEL_DIAGNOSIS_APPLIED_KEY = 'levelDiagnosisApplied';

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

  const highestRank = getLevelRank(highestLevel);
  const index = highestRank >= 0 ? highestRank : getBandForScore(averageScore).index;
  return buildBarometer(averageScore, index);
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

function parseLessonHistoryRaw(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getRealLessonsFromRaw(history: any[]): any[] {
  return history.filter(
    (l) =>
      l?.overallScore &&
      !l?.spark &&
      !l?.placeholder &&
      !l?.demo &&
      l?.type !== 'streak_session' &&
      l?.type !== 'spark',
  );
}

export async function diagnoseLevelData(): Promise<void> {
  const historyRaw = await AsyncStorage.getItem('lessonHistory');
  const history = parseLessonHistoryRaw(historyRaw);
  const highest = await AsyncStorage.getItem(HIGHEST_LEVEL_KEY);
  const restored = await AsyncStorage.getItem(LEVEL_RESTORATION_KEY);
  const currentWeek = await AsyncStorage.getItem('grammarCurriculumWeek');

  const realLessons = getRealLessonsFromRaw(history);
  const scores = realLessons.map((l) => Number(l.overallScore)).filter((s) => Number.isFinite(s));
  const last10 = scores.slice(-10);
  const last5 = scores.slice(-5);

  const avg10 = last10.length > 0 ? last10.reduce((a, b) => a + b, 0) / last10.length : 0;
  const avg5 = last5.length > 0 ? last5.reduce((a, b) => a + b, 0) / last5.length : 0;
  const avgAll = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  console.log('=== LEVEL DIAGNOSIS ===');
  console.log('Stored highestLevel:', highest);
  console.log('Restoration applied:', restored);
  console.log('Current curriculum week:', currentWeek);
  console.log('Total real lessons:', realLessons.length);
  console.log('All scores:', scores);
  console.log('Last 5 scores:', last5);
  console.log('Last 10 scores:', last10);
  console.log('Average all time:', `${avgAll.toFixed(1)}%`);
  console.log('Average last 10:', `${avg10.toFixed(1)}%`);
  console.log('Average last 5:', `${avg5.toFixed(1)}%`);
  console.log('======================');
}

export async function surgicalLevelFix(): Promise<void> {
  const historyRaw = await AsyncStorage.getItem('lessonHistory');
  const history = parseLessonHistoryRaw(historyRaw);
  const realScores = history
    .filter(
      (l) =>
        l?.overallScore &&
        !l?.spark &&
        !l?.placeholder &&
        !l?.demo &&
        l?.type !== 'streak_session' &&
        l?.type !== 'spark' &&
        Number(l?.overallScore) > 0,
    )
    .map((l) => Number(l.overallScore))
    .filter((s) => Number.isFinite(s));

  if (realScores.length === 0) {
    await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, 'B1 Confident');
    await AsyncStorage.setItem(LEVEL_LAST_UPDATED_KEY, new Date().toISOString());
    return;
  }

  const recentScores = realScores.slice(-10);
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

  console.log('Surgical fix — using average:', `${avg.toFixed(1)}%`);

  let correctLevel: string;
  if (avg >= 95) correctLevel = 'B2 Confident';
  else if (avg >= 90) correctLevel = 'B2 Developing';
  else if (avg >= 85) correctLevel = 'B2 Emerging';
  else if (avg >= 80) correctLevel = 'B1 Strong';
  else if (avg >= 70) correctLevel = 'B1 Confident';
  else if (avg >= 60) correctLevel = 'B1 Developing';
  else correctLevel = 'B1 Beginner';

  console.log('Surgical fix — setting level to:', correctLevel);

  await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, correctLevel);
  await AsyncStorage.removeItem(LEVEL_RESTORATION_KEY);
  await AsyncStorage.setItem(LEVEL_LAST_UPDATED_KEY, new Date().toISOString());
}

export async function runLevelDiagnosisAndFixOnce(): Promise<void> {
  const applied = await AsyncStorage.getItem(LEVEL_DIAGNOSIS_APPLIED_KEY);
  if (applied) return;
  await diagnoseLevelData();
  await surgicalLevelFix();
  await AsyncStorage.setItem(LEVEL_DIAGNOSIS_APPLIED_KEY, 'true');
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
 * User-facing level — always from storage, never from recent scores.
 * Priority: highestLevelAchieved → confirmedLevel → B1 Confident.
 */
export async function getDisplayLevel(): Promise<string> {
  const highest = await getHighestLevelAchieved();
  if (getLevelRank(highest) >= 0) return levelLabelFromStored(highest);
  try {
    const confirmed = await AsyncStorage.getItem(CONFIRMED_LEVEL_KEY);
    if (getLevelRank(confirmed) >= 0) return levelLabelFromStored(confirmed);
  } catch {
    // ignore
  }
  return CONFIDENT_FLOOR_LABEL;
}

/**
 * Upgrade storage only when recent average is a new peak.
 * Never writes a lower level.
 */
export async function getCurrentLevel(recentAverage: number): Promise<string> {
  const calculated = getBandForScore(recentAverage);
  const displayLabel = await getDisplayLevel();
  const highestRank = getLevelRank(displayLabel);

  if (calculated.index > highestRank) {
    await AsyncStorage.setItem(HIGHEST_LEVEL_KEY, calculated.band.label);
    await AsyncStorage.setItem(LEVEL_LAST_UPDATED_KEY, new Date().toISOString());
    return calculated.band.label;
  }

  return displayLabel;
}

/** Display band from stored highest; recent average only upgrades, never lowers. */
export async function resolveLevelBarometer(
  history: LessonHistoryEntry[],
): Promise<LevelBarometer | null> {
  const averageScore = getRecentAverageScore(history);

  if (averageScore != null) {
    await getCurrentLevel(averageScore);
  }

  const resolvedLabel = await getDisplayLevel();
  const displayIndex = getLevelRank(resolvedLabel);
  const index = displayIndex >= 0 ? displayIndex : getLevelRank(CONFIDENT_FLOOR_LABEL);
  const scoreForBar = averageScore ?? LEVEL_BANDS[index].min;
  return buildBarometer(scoreForBar, index);
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
