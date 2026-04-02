import AsyncStorage from '@react-native-async-storage/async-storage';

export type StreakMilestone = 3 | 7 | 14 | 30 | 50 | 100;

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null; // YYYY-MM-DD
  totalSessionsCompleted: number;
  freezes: number;
  totalStars: number;
  /** Last 7 days, oldest -> newest. Each entry is a YYYY-MM-DD date. */
  last7Days: { date: string; completed: boolean }[];
};

export type StreakUpdateResult = {
  state: StreakState;
  usedFreeze: boolean;
  earnedFreeze: boolean;
  milestone?: { day: StreakMilestone; starsAwarded: number };
  message?: string;
};

const STORAGE_KEY = 'habla.streak.v1';

const MILESTONES: StreakMilestone[] = [3, 7, 14, 30, 50, 100];

function clampInt(n: unknown, fallback: number) {
  const x = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fallback;
  return x;
}

export function formatLocalDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(dateStr: string): Date {
  // Interpret YYYY-MM-DD as local date (avoid timezone surprises).
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  const ms = db.getTime() - da.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function getDefaultLast7Days(today: string): { date: string; completed: boolean }[] {
  const t = parseDate(today);
  const items: { date: string; completed: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    items.push({ date: formatLocalDate(d), completed: false });
  }
  return items;
}

function normalizeLast7Days(
  existing: unknown,
  today: string,
): { date: string; completed: boolean }[] {
  const base = Array.isArray(existing)
    ? (existing as any[])
        .filter((x) => x && typeof x.date === 'string' && typeof x.completed === 'boolean')
        .map((x) => ({ date: String(x.date), completed: Boolean(x.completed) }))
    : [];

  // Ensure we have exactly the last 7 calendar dates up to today.
  const expected = getDefaultLast7Days(today);
  const byDate = new Map(base.map((x) => [x.date, x.completed]));
  return expected.map((e) => ({ date: e.date, completed: byDate.get(e.date) ?? false }));
}

function starsForMilestone(day: StreakMilestone): number {
  if (day === 3) return 1;
  if (day === 7) return 2;
  if (day === 30) return 3;
  if (day === 100) return 4;
  return 0;
}

export async function getStreakState(): Promise<StreakState> {
  const today = formatLocalDate();
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: null,
      totalSessionsCompleted: 0,
      freezes: 0,
      totalStars: 0,
      last7Days: getDefaultLast7Days(today),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    const lastSessionDate =
      typeof parsed.lastSessionDate === 'string' ? parsed.lastSessionDate : null;

    return {
      currentStreak: Math.max(0, clampInt(parsed.currentStreak, 0)),
      longestStreak: Math.max(0, clampInt(parsed.longestStreak, 0)),
      lastSessionDate,
      totalSessionsCompleted: Math.max(0, clampInt(parsed.totalSessionsCompleted, 0)),
      freezes: Math.max(0, clampInt((parsed as any).freezes, 0)),
      totalStars: Math.max(0, clampInt((parsed as any).totalStars, 0)),
      last7Days: normalizeLast7Days((parsed as any).last7Days, today),
    };
  } catch {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: null,
      totalSessionsCompleted: 0,
      freezes: 0,
      totalStars: 0,
      last7Days: getDefaultLast7Days(today),
    };
  }
}

async function save(state: StreakState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Call this when the user completes a full lesson (reaches summary screen).
 * - increments totalSessionsCompleted each time
 * - increments streak once per day
 * - uses freeze automatically if a day was missed and freezes > 0
 */
export async function recordLessonCompleted(today: string = formatLocalDate()): Promise<StreakUpdateResult> {
  const prev = await getStreakState();
  const usedFreeze = false;
  const earnedFreeze = false;

  // Ensure last7Days window aligns to today before updates.
  let next: StreakState = {
    ...prev,
    last7Days: normalizeLast7Days(prev.last7Days, today),
  };

  // Always count sessions.
  next.totalSessionsCompleted += 1;

  if (next.lastSessionDate === today) {
    // Already completed today: mark today completed in dots and save.
    next.last7Days = next.last7Days.map((d) =>
      d.date === today ? { ...d, completed: true } : d,
    );
    await save(next);
    return { state: next, usedFreeze: false, earnedFreeze: false };
  }

  if (!next.lastSessionDate) {
    next.currentStreak = 1;
  } else {
    const gap = daysBetween(next.lastSessionDate, today);
    if (gap === 1) {
      next.currentStreak += 1;
    } else if (gap >= 2) {
      // Missed at least one day.
      if (next.freezes > 0) {
        next.freezes -= 1;
        (next as any)._usedFreeze = true;
        next.currentStreak += 1; // keep streak alive
      } else {
        next.currentStreak = 1; // reset to 0 then count today
      }
    } else {
      // Time travel or invalid (future date) - don't punish; start at 1.
      next.currentStreak = Math.max(1, next.currentStreak);
    }
  }

  next.lastSessionDate = today;
  next.longestStreak = Math.max(next.longestStreak, next.currentStreak);
  next.last7Days = next.last7Days.map((d) => (d.date === today ? { ...d, completed: true } : d));

  // Earn 1 freeze every 7 streak days (when currentStreak hits a multiple of 7).
  let didEarnFreeze = false;
  if (next.currentStreak > 0 && next.currentStreak % 7 === 0) {
    next.freezes += 1;
    didEarnFreeze = true;
  }

  // Milestones & stars
  const milestoneDay = MILESTONES.find((m) => m === next.currentStreak);
  let milestone: StreakUpdateResult['milestone'] = undefined;
  if (milestoneDay) {
    const starsAwarded = starsForMilestone(milestoneDay);
    if (starsAwarded > 0) {
      next.totalStars += starsAwarded;
    }
    milestone = { day: milestoneDay, starsAwarded };
  }

  const didUseFreeze = Boolean((next as any)._usedFreeze);
  delete (next as any)._usedFreeze;

  await save(next);

  return {
    state: next,
    usedFreeze: didUseFreeze,
    earnedFreeze: didEarnFreeze,
    milestone,
    message: didUseFreeze ? 'Streak saved by freeze 🛡️' : undefined,
  };
}

