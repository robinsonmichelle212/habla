import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuickFireQuestion } from '@/lib/claude';
import type { PracticeDrillKind } from '@/lib/practice-drill-selection';

const CACHE_KEY = 'practiceQuestionsCache';

type CachedPracticeSet = {
  drillKind: PracticeDrillKind;
  grammarWeek: number | null;
  questions: QuickFireQuestion[];
  savedAt: number;
};

export async function cachePracticeQuestions(
  drillKind: PracticeDrillKind,
  grammarWeek: number | null,
  questions: QuickFireQuestion[],
): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  let list: CachedPracticeSet[] = [];
  try {
    list = raw ? (JSON.parse(raw) as CachedPracticeSet[]) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }

  const filtered = list.filter(
    (item) => !(item.drillKind === drillKind && item.grammarWeek === grammarWeek),
  );
  filtered.unshift({ drillKind, grammarWeek, questions, savedAt: Date.now() });
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filtered.slice(0, 8)));
}

export async function getCachedPracticeQuestions(
  drillKind: PracticeDrillKind,
  grammarWeek: number | null,
): Promise<QuickFireQuestion[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as CachedPracticeSet[];
    const match = list.find(
      (item) => item.drillKind === drillKind && item.grammarWeek === grammarWeek,
    );
    return match?.questions ?? null;
  } catch {
    return null;
  }
}
