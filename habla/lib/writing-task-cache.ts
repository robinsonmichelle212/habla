import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'writingTaskCache';

type CachedWritingTask = {
  cacheKey: string;
  prompt: string;
  savedAt: number;
};

function buildCacheKey(parts: {
  lessonType: string;
  focusKey: string;
}): string {
  return `${parts.lessonType}:${parts.focusKey}`;
}

export async function cacheWritingTask(
  lessonType: string,
  focusKey: string,
  prompt: string,
): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  let list: CachedWritingTask[] = [];
  try {
    list = raw ? (JSON.parse(raw) as CachedWritingTask[]) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }

  const cacheKey = buildCacheKey({ lessonType, focusKey });
  const filtered = list.filter((item) => item.cacheKey !== cacheKey);
  filtered.unshift({ cacheKey, prompt, savedAt: Date.now() });
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filtered.slice(0, 12)));
}

export async function getCachedWritingTask(
  lessonType: string,
  focusKey: string,
): Promise<string | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as CachedWritingTask[];
    const cacheKey = buildCacheKey({ lessonType, focusKey });
    return list.find((item) => item.cacheKey === cacheKey)?.prompt ?? null;
  } catch {
    return null;
  }
}
