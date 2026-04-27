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
const CURRENT_STREAK_KEY = 'currentStreak';
const LONGEST_STREAK_KEY = 'longestStreak';
const TOTAL_SESSIONS_KEY = 'totalSessionsCompleted';
const LAST_SESSION_DATE_KEY = 'lastSessionDate';
const FREEZES_KEY = 'freezes';
const TOTAL_STARS_KEY = 'totalStars';
const LAST_7_DAYS_KEY = 'last7Days';

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

function defaultStreakState(today: string): StreakState {
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

/**
 * If the JSON blob (`habla.streak.v1`) is missing or corrupt but we still have
 * the flat keys written by `save()`, rebuild state so streak data survives.
 */
async function getStreakStateFromFlatKeys(today: string): Promise<StreakState | null> {
  const [cs, ls, ts, lsd, fz, tst, l7] = await Promise.all([
    AsyncStorage.getItem(CURRENT_STREAK_KEY),
    AsyncStorage.getItem(LONGEST_STREAK_KEY),
    AsyncStorage.getItem(TOTAL_SESSIONS_KEY),
    AsyncStorage.getItem(LAST_SESSION_DATE_KEY),
    AsyncStorage.getItem(FREEZES_KEY),
    AsyncStorage.getItem(TOTAL_STARS_KEY),
    AsyncStorage.getItem(LAST_7_DAYS_KEY),
  ]);

  const anyFlat =
    cs != null ||
    ls != null ||
    ts != null ||
    (lsd != null && lsd.length > 0) ||
    fz != null ||
    tst != null ||
    (l7 != null && l7.length > 0);

  if (!anyFlat) return null;

  let last7Days: { date: string; completed: boolean }[] = getDefaultLast7Days(today);
  if (l7) {
    try {
      last7Days = normalizeLast7Days(JSON.parse(l7), today);
    } catch {
      last7Days = getDefaultLast7Days(today);
    }
  }

  const lastSessionDate =
    typeof lsd === 'string' && lsd.length > 0 ? lsd : null;

  return {
    currentStreak: Math.max(0, parseInt(cs ?? '0', 10) || 0),
    longestStreak: Math.max(0, parseInt(ls ?? '0', 10) || 0),
    lastSessionDate,
    totalSessionsCompleted: Math.max(0, parseInt(ts ?? '0', 10) || 0),
    freezes: Math.max(0, parseInt(fz ?? '0', 10) || 0),
    totalStars: Math.max(0, parseInt(tst ?? '0', 10) || 0),
    last7Days,
  };
}

export async function getStreakState(): Promise<StreakState> {
  const today = formatLocalDate();
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fromFlat = await getStreakStateFromFlatKeys(today);
    return fromFlat ?? defaultStreakState(today);
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
    const fromFlat = await getStreakStateFromFlatKeys(today);
    return fromFlat ?? defaultStreakState(today);
  }
}

/** Temporary: log every key/value for debugging persistence issues. */
export async function debugLogAllAsyncStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const obj = Object.fromEntries(pairs);
  console.log('[Habla] AsyncStorage key count:', keys.length);
  console.log('[Habla] AsyncStorage dump:', JSON.stringify(obj, null, 2));
}

async function save(state: StreakState) {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
    AsyncStorage.setItem(CURRENT_STREAK_KEY, String(state.currentStreak)),
    AsyncStorage.setItem(LONGEST_STREAK_KEY, String(state.longestStreak)),
    AsyncStorage.setItem(TOTAL_SESSIONS_KEY, String(state.totalSessionsCompleted)),
    AsyncStorage.setItem(LAST_SESSION_DATE_KEY, state.lastSessionDate ?? ''),
    AsyncStorage.setItem(FREEZES_KEY, String(state.freezes)),
    AsyncStorage.setItem(TOTAL_STARS_KEY, String(state.totalStars)),
    AsyncStorage.setItem(LAST_7_DAYS_KEY, JSON.stringify(state.last7Days)),
  ]);
}

export async function updateStreak(today: string = formatLocalDate()): Promise<StreakUpdateResult> {
  const prev = await getStreakState();
  const prevStreak = prev.currentStreak;

  const next: StreakState = {
    ...prev,
    last7Days: normalizeLast7Days(prev.last7Days, today),
  };

  // Always count completed sessions when summary is reached.
  next.totalSessionsCompleted += 1;

  if (next.lastSessionDate === null) {
    // First ever session.
    next.currentStreak = 1;
    next.lastSessionDate = today;
  } else if (next.lastSessionDate === today) {
    // Already logged for this day: keep streak unchanged.
  } else {
    const gap = daysBetween(next.lastSessionDate, today);
    if (gap === 1) {
      // Yesterday -> increment
      next.currentStreak += 1;
    } else {
      // Older than yesterday -> reset to 0 then set to 1
      next.currentStreak = 1;
    }
    next.lastSessionDate = today;
  }

  next.longestStreak = Math.max(next.longestStreak, next.currentStreak);
  next.last7Days = next.last7Days.map((d) => (d.date === today ? { ...d, completed: true } : d));

  // Keep milestone feedback for existing UI.
  const streakChanged = next.currentStreak !== prevStreak;
  let milestone: StreakUpdateResult['milestone'] = undefined;
  if (streakChanged) {
    const milestoneDay = MILESTONES.find((m) => m === next.currentStreak);
    if (milestoneDay) {
      const starsAwarded = starsForMilestone(milestoneDay);
      if (starsAwarded > 0) next.totalStars += starsAwarded;
      milestone = { day: milestoneDay, starsAwarded };
    }
  }

  await save(next);
  return {
    state: next,
    usedFreeze: false,
    earnedFreeze: false,
    milestone,
  };
}

// Backward compatible name used by existing screens.
export async function recordLessonCompleted(today: string = formatLocalDate()): Promise<StreakUpdateResult> {
  return updateStreak(today);
}

