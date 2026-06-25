import AsyncStorage from '@react-native-async-storage/async-storage';

import type { VerbConjugationEntry } from '@/lib/conjugation-data';
import { enrichVerbEnglishForms, normalizeSearchVerb } from '@/lib/conjugation-data';

const CACHE_KEY = 'conjugationLookupCache';

type CacheStore = Record<string, VerbConjugationEntry>;

async function readCache(): Promise<CacheStore> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: CacheStore): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function getCachedConjugation(verb: string): Promise<VerbConjugationEntry | null> {
  const key = normalizeSearchVerb(verb);
  if (!key) return null;
  const cache = await readCache();
  const entry = cache[key];
  if (!entry) return null;
  return enrichVerbEnglishForms(entry);
}

export async function cacheConjugation(verb: string, entry: VerbConjugationEntry): Promise<void> {
  const key = normalizeSearchVerb(verb);
  if (!key) return;
  const cache = await readCache();
  cache[key] = enrichVerbEnglishForms(entry);
  await writeCache(cache);
}
