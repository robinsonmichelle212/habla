import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { isStreakSessionLesson } from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type ScoreHistoryPeriodDays = 7 | 14 | 30;
export type ScoreHistoryPeriod = ScoreHistoryPeriodDays | 'custom';

export type SkillKey = 'grammar' | 'vocabulary' | 'fluency' | 'writing';

export const SKILL_KEYS: SkillKey[] = ['grammar', 'vocabulary', 'fluency', 'writing'];

export const SKILL_LABELS: Record<SkillKey, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  fluency: 'Fluency',
  writing: 'Writing',
};

export const SKILL_COLORS: Record<SkillKey, string> = {
  grammar: '#4A90D9',
  vocabulary: '#27AE60',
  fluency: '#F39C12',
  writing: '#E74C3C',
};

export type SkillDataPoint = {
  date: string;
  score: number;
  lessonType: string;
};

export type SkillSeries = {
  skill: SkillKey;
  label: string;
  color: string;
  points: SkillDataPoint[];
};

export type SkillStat = {
  best: { score: number; date: string } | null;
  average: number | null;
  start: number | null;
  end: number | null;
  change: number | null;
  changeDirection: 'up' | 'down' | 'steady';
  trendArrow: '↗' | '↘' | '→';
};

export type ScoreHistoryData = {
  series: SkillSeries[];
  skills: Record<SkillKey, SkillStat>;
  focusSkill: SkillKey | null;
  sessionsInPeriod: number;
  periodStart: string;
  periodEnd: string;
  hasAnyData: boolean;
};

/** @deprecated Overall score chart — use SkillSeries instead */
export type ScoreHistoryPoint = {
  date: string;
  score: number;
  isPersonalBest: boolean;
  lessonType: string;
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

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function skillScore(entry: LessonHistoryEntry, skill: SkillKey): number | null {
  const section = entry.breakdown[skill];
  if (!section || typeof section.score !== 'number' || !Number.isFinite(section.score)) {
    return null;
  }
  return clampScore(section.score);
}

function hasAnySkillScore(entry: LessonHistoryEntry): boolean {
  return SKILL_KEYS.some((skill) => skillScore(entry, skill) != null);
}

function lessonsInRange(
  lessons: LessonHistoryEntry[],
  start: string,
  end: string,
): LessonHistoryEntry[] {
  return lessons
    .filter(
      (e) =>
        !e.placeholder &&
        !isStreakSessionLesson(e) &&
        e.date >= start &&
        e.date <= end &&
        hasAnySkillScore(e),
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
    });
}

function buildSkillPoints(lessons: LessonHistoryEntry[], skill: SkillKey): SkillDataPoint[] {
  const points: SkillDataPoint[] = [];
  for (const entry of lessons) {
    const score = skillScore(entry, skill);
    if (score == null) continue;
    points.push({ date: entry.date, score, lessonType: entry.lessonType });
  }
  return points;
}

function resolveChangeDirection(change: number | null): SkillStat['changeDirection'] {
  if (change == null) return 'steady';
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'steady';
}

function trendArrowFromPoints(points: SkillDataPoint[]): SkillStat['trendArrow'] {
  const recent = points.slice(-5);
  if (recent.length < 2) return '→';
  const mid = Math.floor(recent.length / 2);
  const earlier = recent.slice(0, mid);
  const later = recent.slice(mid);
  const avgEarlier = earlier.reduce((sum, p) => sum + p.score, 0) / earlier.length;
  const avgLater = later.reduce((sum, p) => sum + p.score, 0) / later.length;
  const delta = avgLater - avgEarlier;
  if (delta >= 3) return '↗';
  if (delta <= -3) return '↘';
  return '→';
}

function buildSkillStat(points: SkillDataPoint[]): SkillStat {
  if (!points.length) {
    return {
      best: null,
      average: null,
      start: null,
      end: null,
      change: null,
      changeDirection: 'steady',
      trendArrow: '→',
    };
  }

  const best = points.reduce(
    (acc, p) => (p.score > acc.score ? p : acc),
    points[0],
  );
  const average = clampScore(points.reduce((sum, p) => sum + p.score, 0) / points.length);
  const start = points[0].score;
  const end = points[points.length - 1].score;
  const change = end - start;

  return {
    best: { score: best.score, date: best.date },
    average,
    start,
    end,
    change,
    changeDirection: resolveChangeDirection(change),
    trendArrow: trendArrowFromPoints(points),
  };
}

export function drillParamForSkill(skill: SkillKey): string {
  return skill;
}

export function buildScoreHistory(
  lessons: LessonHistoryEntry[],
  period: ScoreHistoryPeriod,
  customStart?: string,
  customEnd?: string,
  today: string = formatLocalDate(),
): ScoreHistoryData {
  const { start, end } = resolvePeriodRange(period, customStart, customEnd, today);
  const inRange = lessonsInRange(lessons, start, end);

  const series: SkillSeries[] = SKILL_KEYS.map((skill) => ({
    skill,
    label: SKILL_LABELS[skill],
    color: SKILL_COLORS[skill],
    points: buildSkillPoints(inRange, skill),
  }));

  const skills = {} as Record<SkillKey, SkillStat>;
  for (const skill of SKILL_KEYS) {
    skills[skill] = buildSkillStat(series.find((s) => s.skill === skill)?.points ?? []);
  }

  const withAverage = SKILL_KEYS.filter((k) => skills[k].average != null);
  let focusSkill: SkillKey | null = null;
  if (withAverage.length) {
    focusSkill = withAverage.reduce((lowest, key) =>
      (skills[key].average ?? 100) < (skills[lowest].average ?? 100) ? key : lowest,
    );
  }

  const sessionDates = new Set(inRange.map((e) => e.date));

  return {
    series,
    skills,
    focusSkill,
    sessionsInPeriod: sessionDates.size,
    periodStart: start,
    periodEnd: end,
    hasAnyData: series.some((s) => s.points.length > 0),
  };
}
