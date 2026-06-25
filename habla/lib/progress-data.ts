import {
  getBandForScore,
  getLevelBarometer,
  getNextLevelRequirements,
  LEVEL_BANDS,
  type LevelBand,
} from '@/lib/level-progress';
import {
  overallLessonScore,
  type DrillHistoryEntry,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { formatLocalDate, type StreakState } from '@/lib/streak';

export type ProgressDateRange = '7d' | '30d' | 'all';

export const SKILL_COLORS = {
  grammar: '#60A5FA',
  vocabulary: '#34D399',
  fluency: '#FBBF24',
  writing: '#FF7A59',
} as const;

export const GAP_BREAK_DAYS = 2;
export const ROLLING_LEVEL_WINDOW = 10;

export type ScoreTrendPoint = {
  date: string;
  score: number;
  isPersonalBest: boolean;
};

export type SkillTrendSeries = {
  key: keyof typeof SKILL_COLORS;
  label: string;
  color: string;
  segments: ScoreTrendPoint[][];
};

export type LevelStep = {
  date: string;
  band: LevelBand;
  bandIndex: number;
  isCurrent: boolean;
};

export type ActivityLevel = 'none' | 'drill' | 'lesson' | 'both';

export type HeatmapCell = {
  date: string;
  dayOfWeek: number;
  activity: ActivityLevel;
};

export type HeatmapWeek = {
  weekStart: string;
  days: HeatmapCell[];
};

export type StreakBar = {
  label: string;
  length: number;
  isCurrent: boolean;
  isLongest: boolean;
};

export type ProgressSummary = {
  totalSessions: number;
  averageScore: number | null;
  personalBest: number | null;
  currentStreak: number;
  longestStreak: number;
  daysSinceFirstLesson: number | null;
  estimatedLevelUpDate: string | null;
  trendDirection: 'up' | 'down' | 'flat' | null;
  trendLabel: string;
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: string, b: string): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatProgressDate(dateStr: string): string {
  return formatShortDate(dateStr);
}

export function filterByDateRange<T extends { date: string }>(
  items: T[],
  range: ProgressDateRange,
  today: string = formatLocalDate(),
): T[] {
  if (range === 'all') return items;
  const dayCount = range === '7d' ? 7 : 30;
  return items.filter((item) => daysBetween(item.date, today) >= 0 && daysBetween(item.date, today) < dayCount);
}

export function splitIntoSegments<T extends { date: string }>(
  points: T[],
  gapDays = GAP_BREAK_DAYS,
): T[][] {
  if (!points.length) return [];
  const segments: T[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const gap = daysBetween(prev.date, curr.date);
    if (gap > gapDays) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1].push(curr);
    }
  }
  return segments;
}

export function buildOverallScoreTrend(
  history: LessonHistoryEntry[],
  range: ProgressDateRange,
): { segments: ScoreTrendPoint[][]; personalBest: number | null; trendDirection: ProgressSummary['trendDirection'] } {
  const filtered = filterByDateRange(history, range);
  const personalBest =
    filtered.length > 0 ? Math.max(...filtered.map((e) => overallLessonScore(e))) : null;

  const points: ScoreTrendPoint[] = filtered.map((entry) => ({
    date: entry.date,
    score: overallLessonScore(entry),
    isPersonalBest: personalBest != null && overallLessonScore(entry) === personalBest,
  }));

  const segments = splitIntoSegments(points).map((segment) =>
    segment.map((p) => ({
      ...p,
      isPersonalBest: personalBest != null && p.score === personalBest,
    })),
  );

  let trendDirection: ProgressSummary['trendDirection'] = null;
  if (points.length >= 2) {
    const first = points[0].score;
    const last = points[points.length - 1].score;
    const delta = last - first;
    if (delta > 2) trendDirection = 'up';
    else if (delta < -2) trendDirection = 'down';
    else trendDirection = 'flat';
  }

  return { segments, personalBest, trendDirection };
}

export function buildSkillTrends(
  history: LessonHistoryEntry[],
  range: ProgressDateRange,
): SkillTrendSeries[] {
  const filtered = filterByDateRange(history, range);
  const skills: { key: keyof typeof SKILL_COLORS; label: string; field: keyof LessonHistoryEntry['breakdown'] }[] = [
    { key: 'grammar', label: 'Grammar', field: 'grammar' },
    { key: 'vocabulary', label: 'Vocabulary', field: 'vocabulary' },
    { key: 'fluency', label: 'Fluency', field: 'fluency' },
    { key: 'writing', label: 'Writing', field: 'writing' },
  ];

  return skills.map(({ key, label, field }) => {
    const points: ScoreTrendPoint[] = filtered.map((entry) => ({
      date: entry.date,
      score: entry.breakdown[field].score,
      isPersonalBest: false,
    }));
    return {
      key,
      label,
      color: SKILL_COLORS[key],
      segments: splitIntoSegments(points),
    };
  });
}

export function buildLevelProgression(
  history: LessonHistoryEntry[],
  range: ProgressDateRange,
): LevelStep[] {
  const filtered = filterByDateRange(history, range);
  const steps: LevelStep[] = [];
  let lastBandIndex = -1;

  filtered.forEach((entry, index) => {
    const window = filtered.slice(Math.max(0, index + 1 - ROLLING_LEVEL_WINDOW), index + 1);
    const avg = Math.round(
      window.reduce((sum, e) => sum + overallLessonScore(e), 0) / window.length,
    );
    const { band, index: bandIndex } = getBandForScore(avg);
    if (bandIndex !== lastBandIndex) {
      steps.push({
        date: entry.date,
        band,
        bandIndex,
        isCurrent: false,
      });
      lastBandIndex = bandIndex;
    }
  });

  const barometer = getLevelBarometer(history);
  if (steps.length && barometer) {
    steps[steps.length - 1].isCurrent = true;
  }

  return steps;
}

export function getDayActivity(
  date: string,
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
): ActivityLevel {
  const hasLesson = lessons.some((l) => l.date === date);
  const hasDrill = drills.some((d) => d.date === date);
  if (hasLesson && hasDrill) return 'both';
  if (hasLesson) return 'lesson';
  if (hasDrill) return 'drill';
  return 'none';
}

function startOfWeekMonday(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

export function buildActivityHeatmap(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  weeksVisible = 12,
): HeatmapWeek[] {
  const allDates = [...lessons.map((l) => l.date), ...drills.map((d) => d.date)].filter(Boolean);
  if (!allDates.length) return [];

  const today = formatLocalDate();
  const earliest = allDates.reduce((min, d) => (d < min ? d : min), allDates[0]);
  const startMonday = startOfWeekMonday(earliest);
  const endMonday = startOfWeekMonday(today);

  const weeks: HeatmapWeek[] = [];
  let cursor = startMonday;
  while (cursor <= endMonday) {
    const days: HeatmapCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      days.push({
        date,
        dayOfWeek: i,
        activity: getDayActivity(date, lessons, drills),
      });
    }
    weeks.push({ weekStart: cursor, days });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

export function chunkHeatmapWeeks(weeks: HeatmapWeek[], chunkSize = 12): HeatmapWeek[][] {
  const chunks: HeatmapWeek[][] = [];
  for (let i = 0; i < weeks.length; i += chunkSize) {
    chunks.push(weeks.slice(i, i + chunkSize));
  }
  return chunks;
}

export function buildStreakHistory(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  streak: StreakState,
  today: string = formatLocalDate(),
): StreakBar[] {
  const activityDates = new Set<string>();
  for (const l of lessons) activityDates.add(l.date);
  for (const d of drills) activityDates.add(d.date);

  const sorted = [...activityDates].sort();
  if (!sorted.length) return [];

  const periods: { start: string; end: string; length: number }[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const date = sorted[i];
    if (daysBetween(end, date) === 1) {
      end = date;
    } else {
      periods.push({ start, end, length: daysBetween(start, end) + 1 });
      start = date;
      end = date;
    }
  }
  periods.push({ start, end, length: daysBetween(start, end) + 1 });

  const longest = Math.max(...periods.map((p) => p.length), streak.longestStreak);

  return periods.map((period, index) => {
    const isCurrent =
      streak.currentStreak > 0 &&
      index === periods.length - 1 &&
      daysBetween(period.end, today) <= 1;
    return {
      label: formatShortDate(period.start),
      length: period.length,
      isCurrent,
      isLongest: period.length === longest && longest > 0,
    };
  });
}

export function buildProgressSummary(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  streak: StreakState,
  today: string = formatLocalDate(),
): ProgressSummary {
  const totalSessions = lessons.length + drills.length;
  const scores = lessons.map((e) => overallLessonScore(e));
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const personalBest = scores.length ? Math.max(...scores) : null;

  const firstLessonDate = lessons.length ? lessons[0].date : null;
  const daysSinceFirstLesson =
    firstLessonDate != null ? daysBetween(firstLessonDate, today) + 1 : null;

  const nextReq = getNextLevelRequirements(lessons);
  let estimatedLevelUpDate: string | null = null;
  if (nextReq?.estimatedSessions != null && nextReq.estimatedSessions > 0) {
    estimatedLevelUpDate = addDays(today, nextReq.estimatedSessions);
  }

  const { trendDirection } = buildOverallScoreTrend(lessons, 'all');
  let trendLabel = 'Complete more lessons to see your trend';
  if (trendDirection === 'up') trendLabel = 'Trending up — keep going!';
  else if (trendDirection === 'down') trendLabel = 'Trending down — a practice drill can help';
  else if (trendDirection === 'flat') trendLabel = 'Holding steady — consistency wins';

  return {
    totalSessions,
    averageScore,
    personalBest,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    daysSinceFirstLesson,
    estimatedLevelUpDate,
    trendDirection,
    trendLabel,
  };
}

export function trendArrow(direction: ProgressSummary['trendDirection']): string {
  if (direction === 'up') return '↗';
  if (direction === 'down') return '↘';
  if (direction === 'flat') return '→';
  return '';
}

export function levelBandShortLabel(label: string): string {
  return label.replace('B1 ', '').replace('B2 ', 'B2·');
}
