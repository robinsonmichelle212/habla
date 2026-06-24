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

/** Gems for hitting a streak milestone (7, 14, or 30 days). */
export function gemsForStreakMilestone(day: number): number {
  if (day === 7) return 5;
  if (day === 14) return 15;
  if (day === 30) return 50;
  return 0;
}

/** Full lesson completed: +3, perfect 100%: +4, streak milestone gems stack on top. */
export function calculateLessonGems(overallScore: number, streakMilestoneDay?: number | null): number {
  let total = 3;
  if (overallScore >= 100) total += 4;
  if (streakMilestoneDay != null) {
    total += gemsForStreakMilestone(streakMilestoneDay);
  }
  return total;
}

/** Practice drill: 5+/10 → +2, below 5 → +1, perfect round → +4. */
export function gemsForPracticeDrill(correctCount: number, totalQuestions = 10): number {
  let total = correctCount >= 5 ? 2 : 1;
  if (correctCount >= totalQuestions) total += 4;
  return total;
}
