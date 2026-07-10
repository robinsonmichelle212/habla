import { getLevelBarometer } from '@/lib/level-progress';
import { overallLessonScore, type LessonHistoryEntry } from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type ScoreHistoryPeriodDays = 7 | 14 | 30;
export type ScoreHistoryPeriod = ScoreHistoryPeriodDays | 'custom';

export type ScoreHistoryPoint = {
  date: string;
  score: number;
  isPersonalBest: boolean;
  lessonType: string;
};

export type ScoreHistoryThreshold = {
  value: number;
  label: string;
};

export type ScoreHistoryStats = {
  average: number | null;
  highest: { score: number; date: string } | null;
  lowest: { score: number; date: string } | null;
  sessionsCompleted: number;
  startScore: number | null;
  endScore: number | null;
  change: number | null;
  changeDirection: 'up' | 'down' | 'steady';
  trendLabel: string;
};

export type ScoreHistoryData = {
  points: ScoreHistoryPoint[];
  stats: ScoreHistoryStats;
  threshold: ScoreHistoryThreshold | null;
  periodStart: string;
  periodEnd: string;
};

export function parseDateKey(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function addDaysToDateKey(date: string, days: number): string {
  const d = parseDateKey(date);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function formatScoreHistoryDate(date: string): string {
  return parseDateKey(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function resolvePeriodRange(
  period: ScoreHistoryPeriod,
  customStart?: string,
  customEnd?: string,
  today: string = formatLocalDate(),
): { start: string; end: string } {
  if (period === 'custom' && customStart && customEnd) {
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { start, end };
  }

  const days = period === 'custom' ? 7 : period;
  return {
    start: addDaysToDateKey(today, -(days - 1)),
    end: today,
  };
}

function scoredLessonsInRange(
  lessons: LessonHistoryEntry[],
  start: string,
  end: string,
): LessonHistoryEntry[] {
  return lessons
    .filter((e) => !e.placeholder && e.overallScore != null && e.date >= start && e.date <= end)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return overallLessonScore(a) - overallLessonScore(b);
    });
}

function linearTrendSlope(points: ScoreHistoryPoint[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += points[i].score;
    sumXY += i * points[i].score;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function trendLabelFromSlope(slope: number): string {
  if (slope > 0.4) return 'Trending up ↗';
  if (slope < -0.4) return 'Trending down ↘';
  return 'Holding steady →';
}

function resolveChangeDirection(change: number | null): 'up' | 'down' | 'steady' {
  if (change == null) return 'steady';
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'steady';
}

export function buildScoreHistory(
  lessons: LessonHistoryEntry[],
  period: ScoreHistoryPeriod,
  customStart?: string,
  customEnd?: string,
  today: string = formatLocalDate(),
): ScoreHistoryData {
  const { start, end } = resolvePeriodRange(period, customStart, customEnd, today);
  const inRange = scoredLessonsInRange(lessons, start, end);

  const bestInPeriod =
    inRange.length > 0
      ? Math.max(...inRange.map((e) => overallLessonScore(e)))
      : null;

  const points: ScoreHistoryPoint[] = inRange.map((e) => ({
    date: e.date,
    score: overallLessonScore(e),
    isPersonalBest: bestInPeriod != null && overallLessonScore(e) === bestInPeriod,
    lessonType: e.lessonType,
  }));

  const scores = points.map((p) => p.score);
  const average =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : null;

  const highest =
    points.length > 0
      ? points.reduce((best, p) => (p.score > best.score ? p : best), points[0])
      : null;

  const lowest =
    points.length > 0
      ? points.reduce((worst, p) => (p.score < worst.score ? p : worst), points[0])
      : null;

  const startScore = points[0]?.score ?? null;
  const endScore = points[points.length - 1]?.score ?? null;
  const change =
    startScore != null && endScore != null ? Math.round(endScore - startScore) : null;

  const barometer = getLevelBarometer(lessons);
  const threshold =
    barometer?.nextBandThreshold != null && barometer.nextBand
      ? {
          value: barometer.nextBandThreshold,
          label: `${barometer.nextBand.label} threshold`,
        }
      : null;

  return {
    points,
    stats: {
      average,
      highest: highest ? { score: highest.score, date: highest.date } : null,
      lowest: lowest ? { score: lowest.score, date: lowest.date } : null,
      sessionsCompleted: points.length,
      startScore,
      endScore,
      change,
      changeDirection: resolveChangeDirection(change),
      trendLabel: trendLabelFromSlope(linearTrendSlope(points)),
    },
    threshold,
    periodStart: start,
    periodEnd: end,
  };
}
