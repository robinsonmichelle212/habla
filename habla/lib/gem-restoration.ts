import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLessonHistory } from '@/lib/practice-storage';

const TOTAL_GEMS_KEY = 'totalGems';
const GEM_RESTORATION_APPLIED_KEY = 'gemRestorationApplied';
const RESTORED_GEMS = 127;

/**
 * One-time safety migration for users whose gems were wiped by onboarding.
 * Runs once per install/profile and never again after first execution.
 */
export async function runOneTimeGemRestoration(): Promise<void> {
  const alreadyApplied = await AsyncStorage.getItem(GEM_RESTORATION_APPLIED_KEY);
  if (alreadyApplied === 'true') return;

  try {
    const [rawGems, lessonHistory] = await Promise.all([
      AsyncStorage.getItem(TOTAL_GEMS_KEY),
      getLessonHistory(),
    ]);

    const parsedGems = rawGems == null ? 0 : Number.parseInt(rawGems, 10);
    const gems = Number.isFinite(parsedGems) && parsedGems > 0 ? parsedGems : 0;
    const hasLessonHistory = lessonHistory.length > 0;

    if (hasLessonHistory && gems === 0) {
      await AsyncStorage.setItem(TOTAL_GEMS_KEY, String(RESTORED_GEMS));
    }
  } finally {
    await AsyncStorage.setItem(GEM_RESTORATION_APPLIED_KEY, 'true');
  }
}
