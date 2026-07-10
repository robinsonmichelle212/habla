import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SafeSummaryPayload } from '@/lib/summary-safe-data';

const LAST_SUMMARY_KEY = 'lastSummary';

export type StoredLastSummary = SafeSummaryPayload & {
  savedAt: number;
};

export async function saveLastSummary(payload: SafeSummaryPayload): Promise<void> {
  const stored: StoredLastSummary = {
    ...payload,
    savedAt: Date.now(),
  };
  await AsyncStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(stored));
}

export async function getLastSummary(): Promise<StoredLastSummary | null> {
  const raw = await AsyncStorage.getItem(LAST_SUMMARY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredLastSummary;
    if (!parsed || typeof parsed !== 'object' || !parsed.analysis) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function hasLastSummary(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LAST_SUMMARY_KEY);
  return !!raw;
}
