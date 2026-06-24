import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'lessonHistory';

export type ScoreBreakdownSection = {
  score: number;
  topic?: string;
  details: string[];
};

export type LessonBreakdown = {
  grammar: ScoreBreakdownSection & { topic: string };
  vocabulary: ScoreBreakdownSection & { topic: string };
  fluency: ScoreBreakdownSection;
  writing: ScoreBreakdownSection;
};

export type LessonHistoryEntry = {
  date: string; // YYYY-MM-DD
  overallScore: number;
  breakdown: LessonBreakdown;
  weakAreas: string[];
  focusAreas: string[];
  lessonType: string;
  /** @deprecated legacy flat scores — kept for old entries */
  scores?: {
    grammar: number;
    vocabulary: number;
    fluency: number;
  };
};

export type PriorityWeakArea = {
  label: string;
  frequency: number;
};

export type WeekChartDay = {
  date: string;
  dayLabel: string;
  score: number | null;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v).trim()).filter(Boolean);
}

function toScore(input: unknown): number {
  const n = typeof input === 'number' && Number.isFinite(input) ? input : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeSection(
  raw: unknown,
  fallbackScore: number,
  fallbackTopic?: string,
): ScoreBreakdownSection & { topic?: string } {
  const obj = (raw ?? {}) as Partial<ScoreBreakdownSection>;
  return {
    score: toScore(obj.score ?? fallbackScore),
    topic: typeof obj.topic === 'string' ? obj.topic : fallbackTopic,
    details: toStringList(obj.details),
  };
}

function normalizeBreakdown(
  raw: unknown,
  legacyScores?: { grammar: number; vocabulary: number; fluency: number },
): LessonBreakdown {
  const obj = (raw ?? {}) as Partial<LessonBreakdown>;
  const g = legacyScores?.grammar ?? 0;
  const v = legacyScores?.vocabulary ?? 0;
  const f = legacyScores?.fluency ?? 0;
  const w = Math.round((g + v + f) / 3);

  const grammar = normalizeSection(obj.grammar, g, 'Grammar');
  const vocabulary = normalizeSection(obj.vocabulary, v, 'Vocabulary');
  const fluency = normalizeSection(obj.fluency, f);
  const writing = normalizeSection(obj.writing, w);

  return {
    grammar: { ...grammar, topic: grammar.topic ?? 'Grammar' },
    vocabulary: { ...vocabulary, topic: vocabulary.topic ?? 'Vocabulary' },
    fluency: { score: fluency.score, details: fluency.details },
    writing: { score: writing.score, details: writing.details },
  };
}

function normalizeLessonHistory(raw: unknown): LessonHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const obj = item as Partial<LessonHistoryEntry>;
      const legacyScores = obj.scores
        ? {
            grammar: toScore(obj.scores.grammar),
            vocabulary: toScore(obj.scores.vocabulary),
            fluency: toScore(obj.scores.fluency),
          }
        : undefined;

      const breakdown = normalizeBreakdown(obj.breakdown, legacyScores);
      const overallScore =
        obj.overallScore != null
          ? toScore(obj.overallScore)
          : Math.round(
              (breakdown.grammar.score +
                breakdown.vocabulary.score +
                breakdown.fluency.score +
                breakdown.writing.score) /
                4,
            );

      return {
        date: typeof obj?.date === 'string' ? obj.date : '',
        overallScore,
        breakdown,
        weakAreas: toStringList(obj?.weakAreas),
        focusAreas: toStringList(obj?.focusAreas),
        lessonType: typeof obj?.lessonType === 'string' ? obj.lessonType : 'Lesson',
        scores: legacyScores,
      };
    })
    .filter((entry) => !!entry.date);
}

export function lessonTypeLabel(lessonType: LessonType): string {
  switch (lessonType) {
    case 'Grammar':
      return 'Grammar';
    case 'Vocab':
      return 'Vocabulary';
    case 'Your Day':
      return 'Your Day';
  }
}

export function scoreBarColor(score: number): string {
  if (score >= 90) return '#34D399';
  if (score >= 75) return '#FBBF24';
  return '#F87171';
}

/** Overall session score (0–100). */
export function overallLessonScore(entry: LessonHistoryEntry): number {
  return entry.overallScore;
}

export async function getLessonHistory(): Promise<LessonHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizeLessonHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function appendLessonHistory(entry: LessonHistoryEntry): Promise<void> {
  const current = await getLessonHistory();
  const next = [...current, entry].slice(-10);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isWithinLastCalendarDays(dateStr: string, today: string, dayCount: number): boolean {
  const entry = parseLocalDate(dateStr);
  const end = parseLocalDate(today);
  const diff = Math.floor((end.getTime() - entry.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 && diff < dayCount;
}

/** Most recent lesson completed today, or null if none today. */
export function getTodaysLessonEntry(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): LessonHistoryEntry | null {
  const todays = history.filter((e) => e.date === today);
  if (!todays.length) return null;
  return todays[todays.length - 1];
}

export function getTodaysLessonScore(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): number | null {
  const entry = getTodaysLessonEntry(history, today);
  return entry ? overallLessonScore(entry) : null;
}

/** Highest-scoring lesson in the last 7 calendar days. */
export function getBestLessonThisWeek(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): LessonHistoryEntry | null {
  const week = history.filter((e) => isWithinLastCalendarDays(e.date, today, 7));
  if (!week.length) return null;
  return week.reduce((best, e) =>
    overallLessonScore(e) > overallLessonScore(best) ? e : best,
  );
}

export function getTopScoreThisWeek(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): number | null {
  const best = getBestLessonThisWeek(history, today);
  return best ? overallLessonScore(best) : null;
}

/** Last 7 calendar days ending today — best score per day for the mini chart. */
export function getWeekScoreChart(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): WeekChartDay[] {
  const end = parseLocalDate(today);
  const days: WeekChartDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const date = formatLocalDate(d);
    const lessons = history.filter((e) => e.date === date);
    const score = lessons.length
      ? Math.max(...lessons.map((e) => overallLessonScore(e)))
      : null;
    days.push({
      date,
      dayLabel: DAY_LABELS[d.getDay()],
      score,
    });
  }

  return days;
}

/** B1→B2 label from average score across the last 10 sessions. */
export function getProgressionLevel(history: LessonHistoryEntry[]): string | null {
  const recent = history.slice(-10);
  if (!recent.length) return null;
  const avg = recent.reduce((sum, e) => sum + overallLessonScore(e), 0) / recent.length;
  if (avg < 60) return 'B1 Beginner';
  if (avg < 70) return 'B1 Developing';
  if (avg < 80) return 'B1 Confident';
  if (avg < 90) return 'B1 Strong';
  return 'B2 Emerging';
}

export function buildPriorityWeakAreas(lessons: LessonHistoryEntry[]): PriorityWeakArea[] {
  const counts = new Map<string, { label: string; frequency: number }>();
  for (const lesson of lessons) {
    for (const area of lesson.weakAreas) {
      const key = area.trim().toLowerCase();
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.frequency += 1;
      } else {
        counts.set(key, { label: area.trim(), frequency: 1 });
      }
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.frequency - a.frequency);
}
