import AsyncStorage from '@react-native-async-storage/async-storage';
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

