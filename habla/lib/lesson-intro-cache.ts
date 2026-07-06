import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonKindId } from '@/lib/claude';

const CACHE_KEY = 'lessonIntroCache';
const MAX_ENTRIES = 3;

export type CachedLessonIntro = {
  lessonKind: LessonKindId;
  weekNumber: number | null;
  spanish: string;
  translation: string;
  savedAt: number;
};

export async function cacheLessonIntro(entry: Omit<CachedLessonIntro, 'savedAt'>): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  let list: CachedLessonIntro[] = [];
  try {
    list = raw ? (JSON.parse(raw) as CachedLessonIntro[]) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }

  const filtered = list.filter(
    (item) => !(item.lessonKind === entry.lessonKind && item.weekNumber === entry.weekNumber),
  );
  const next = [{ ...entry, savedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

export async function getCachedLessonIntro(
  lessonKind: LessonKindId,
  weekNumber: number | null,
): Promise<CachedLessonIntro | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as CachedLessonIntro[];
    if (!Array.isArray(list)) return null;
    return (
      list.find((item) => item.lessonKind === lessonKind && item.weekNumber === weekNumber) ?? null
    );
  } catch {
    return null;
  }
}
