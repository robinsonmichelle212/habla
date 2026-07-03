import AsyncStorage from '@react-native-async-storage/async-storage';

const TOTAL_GEMS_KEY = 'totalGems';

export async function getTotalGems(): Promise<number> {
  const raw = await AsyncStorage.getItem(TOTAL_GEMS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function addGems(amount: number): Promise<number> {
  const add = Math.max(0, Math.trunc(amount));
  if (add === 0) return getTotalGems();
  const current = await getTotalGems();
  const next = current + add;
  await AsyncStorage.setItem(TOTAL_GEMS_KEY, String(next));
  return next;
}

export async function deductGems(amount: number): Promise<{ success: boolean; total: number }> {
  const cost = Math.max(0, Math.trunc(amount));
  const current = await getTotalGems();
  if (cost > current) {
    return { success: false, total: current };
  }
  const next = current - cost;
  await AsyncStorage.setItem(TOTAL_GEMS_KEY, String(next));
  return { success: true, total: next };
}

/** Gems for completing speaking while offline (processed later). */
export const OFFLINE_SPEAKING_ATTEMPT_GEMS = 2;

/** Full lesson completed: +3, perfect 100%: +4. */
export function calculateLessonGems(overallScore: number): number {
  let total = 3;
  if (overallScore >= 100) total += 4;
  return total;
}

/** Practice drill gems: 100% → 4, 5–9 → 2, below 5 → 1. */
export function gemsForPracticeDrill(correctCount: number, totalQuestions = 10): number {
  if (correctCount >= totalQuestions) return 4;
  if (correctCount >= 5) return 2;
  return 1;
}

export function practiceDrillEncouragement(correctCount: number, totalQuestions = 10): string {
  if (correctCount >= totalQuestions) return 'Perfect! 🌟 +4 💎';
  if (correctCount >= 5) return 'Nice work! 💪 +2 💎';
  return "Don't worry — showing up is what counts. +1 💎 — Javi will keep drilling these with you 🔥";
}
