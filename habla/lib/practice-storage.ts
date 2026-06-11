import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'lessonHistory';

export type LessonHistoryEntry = {
  date: string; // YYYY-MM-DD
  weakAreas: string[];
  focusAreas: string[];
  scores: {
    grammar: number;
    vocabulary: number;
    fluency: number;
  };
};

export type PriorityWeakArea = {
  label: string;
  frequency: number;
};

function toStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v).trim()).filter(Boolean);
}

function toScore(input: unknown): number {
  const n = typeof input === 'number' && Number.isFinite(input) ? input : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeLessonHistory(raw: unknown): LessonHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const obj = item as Partial<LessonHistoryEntry>;
      return {
        date: typeof obj?.date === 'string' ? obj.date : '',
        weakAreas: toStringList(obj?.weakAreas),
        focusAreas: toStringList(obj?.focusAreas),
        scores: {
          grammar: toScore(obj?.scores?.grammar),
          vocabulary: toScore(obj?.scores?.vocabulary),
          fluency: toScore(obj?.scores?.fluency),
        },
      };
    })
    .filter((entry) => !!entry.date);
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

/** Overall session score: average of grammar, vocabulary, and fluency (0–100). */
export function overallLessonScore(entry: LessonHistoryEntry): number {
  const { grammar, vocabulary, fluency } = entry.scores;
  return Math.round((grammar + vocabulary + fluency) / 3);
}

/** Most recent lesson completed today, or null if none today. */
export function getTodaysLessonScore(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): number | null {
  const todays = history.filter((e) => e.date === today);
  if (!todays.length) return null;
  return overallLessonScore(todays[todays.length - 1]);
}

/** Highest overall score among lessons in the last 7 calendar days (including today). */
export function getTopScoreThisWeek(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): number | null {
  const week = history.filter((e) => isWithinLastCalendarDays(e.date, today, 7));
  if (!week.length) return null;
  return Math.max(...week.map(overallLessonScore));
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

