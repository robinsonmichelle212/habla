import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateWrappedJaviMessage } from '@/lib/claude';
import {
  buildWrappedReport,
  currentMonthKey,
  dataMonthKeyForDisplayMonth,
  monthKeyFromParts,
  monthNameOnly,
  parseMonthKeyParts,
  previousMonthKey,
  wrapDisplayMonthKey,
  type MonthKey,
  type SpanishWrappedReport,
} from '@/lib/wrapped-data';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'wrappedHistory';
const UNREAD_KEY = 'wrappedUnreadMonth';
const LAST_WRAPPED_KEY = 'lastWrappedMonth';

export type LastWrappedMonth = {
  month: number; // 0-11 display month
  year: number;
  generatedAt: string;
};

export async function getWrappedHistory(): Promise<SpanishWrappedReport[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SpanishWrappedReport[]).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey),
    );
  } catch {
    return [];
  }
}

export async function getMostRecentWrapped(): Promise<SpanishWrappedReport | null> {
  const history = await getWrappedHistory();
  if (!history.length) return null;
  // Sort by display month (data month + 1) descending.
  const sorted = [...history].sort((a, b) => {
    const da = wrapDisplayMonthKey(a.monthKey);
    const db = wrapDisplayMonthKey(b.monthKey);
    return db.localeCompare(da);
  });
  return sorted[0] ?? null;
}

export async function getWrappedForMonth(monthKey: MonthKey): Promise<SpanishWrappedReport | null> {
  const history = await getWrappedHistory();
  return history.find((w) => w.monthKey === monthKey) ?? null;
}

async function saveAll(reports: SpanishWrappedReport[]): Promise<void> {
  // Keep all months forever — never truncate history.
  const sorted = [...reports].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
}

export async function getLastWrappedMonth(): Promise<LastWrappedMonth | null> {
  const raw = await AsyncStorage.getItem(LAST_WRAPPED_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastWrappedMonth>;
    if (
      typeof parsed.month !== 'number' ||
      typeof parsed.year !== 'number' ||
      parsed.month < 0 ||
      parsed.month > 11
    ) {
      return null;
    }
    return {
      month: parsed.month,
      year: parsed.year,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
    };
  } catch {
    return null;
  }
}

export async function setLastWrappedMonth(displayMonthKey: MonthKey): Promise<void> {
  const { year, monthIndex } = parseMonthKeyParts(displayMonthKey);
  const payload: LastWrappedMonth = {
    month: monthIndex,
    year,
    generatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LAST_WRAPPED_KEY, JSON.stringify(payload));
}

/** Append only — never overwrite an existing month's Wrapped. */
export async function saveWrappedReport(report: SpanishWrappedReport): Promise<boolean> {
  const history = await getWrappedHistory();
  if (history.some((w) => w.monthKey === report.monthKey)) {
    return false;
  }
  history.push(report);
  await saveAll(history);
  await AsyncStorage.setItem(UNREAD_KEY, report.monthKey);
  await setLastWrappedMonth(wrapDisplayMonthKey(report.monthKey));
  return true;
}

export async function getUnreadWrappedMonth(): Promise<MonthKey | null> {
  const raw = await AsyncStorage.getItem(UNREAD_KEY);
  return raw || null;
}

export async function markWrappedSeen(monthKey: MonthKey): Promise<void> {
  const history = await getWrappedHistory();
  const updated = history.map((w) =>
    w.monthKey === monthKey ? { ...w, seenAt: formatLocalDate() } : w,
  );
  await saveAll(updated);
  const unread = await getUnreadWrappedMonth();
  if (unread === monthKey) {
    await AsyncStorage.removeItem(UNREAD_KEY);
  }
}

async function monthHasActivity(dataMonthKey: MonthKey): Promise<boolean> {
  const draft = await buildWrappedReport(dataMonthKey);
  return draft.totalLessons > 0 || draft.totalDrills > 0;
}

export async function previousMonthHasActivity(from: Date = new Date()): Promise<boolean> {
  return monthHasActivity(previousMonthKey(from));
}

export function shouldGenerateWrapped(
  lastWrapped: LastWrappedMonth | null,
  from: Date = new Date(),
): boolean {
  if (from.getDate() < 1) return false;
  const thisMonth = from.getMonth();
  const thisYear = from.getFullYear();
  if (!lastWrapped) return true;
  if (lastWrapped.month !== thisMonth || lastWrapped.year !== thisYear) return true;
  return false;
}

export async function isWrappedOverdue(from: Date = new Date()): Promise<boolean> {
  const last = await getLastWrappedMonth();
  if (!shouldGenerateWrapped(last, from)) return false;
  return previousMonthHasActivity(from);
}

async function generateAndSaveForDataMonth(
  dataMonthKey: MonthKey,
): Promise<SpanishWrappedReport | null> {
  const existing = await getWrappedForMonth(dataMonthKey);
  if (existing) return null;

  const draft = await buildWrappedReport(dataMonthKey);
  if (draft.totalLessons === 0 && draft.totalDrills === 0) {
    return null;
  }

  let javiMessage = '';
  try {
    javiMessage = await generateWrappedJaviMessage(draft);
  } catch {
    javiMessage =
      '¡Qué mes tan productivo! / What a productive month — Javi is proud of your progress.';
  }

  const report: SpanishWrappedReport = { ...draft, javiMessage };
  const saved = await saveWrappedReport(report);
  return saved ? report : null;
}

/**
 * On app open: generate any overdue wraps (catch-up through current month)
 * without overwriting existing history entries.
 */
export async function ensurePreviousMonthWrapped(): Promise<SpanishWrappedReport | null> {
  const today = new Date();
  const last = await getLastWrappedMonth();
  if (!shouldGenerateWrapped(last, today)) {
    // Still try to fill the immediate previous data month if somehow missing.
    const dataKey = previousMonthKey(today);
    return generateAndSaveForDataMonth(dataKey);
  }

  const currentDisplay = currentMonthKey(today);
  const { year: endYear, monthIndex: endMonth } = parseMonthKeyParts(currentDisplay);

  // Catch up up to 14 display months so a missed July still generates in August.
  const start = last
    ? new Date(last.year, last.month + 1, 1)
    : new Date(endYear, endMonth - 13, 1);

  let latestCreated: SpanishWrappedReport | null = null;
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date(endYear, endMonth, 1);

  while (cursor <= end) {
    const displayKey = monthKeyFromParts(cursor.getFullYear(), cursor.getMonth());
    const dataKey = dataMonthKeyForDisplayMonth(displayKey);
    const created = await generateAndSaveForDataMonth(dataKey);
    if (created) latestCreated = created;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Even if no report was created (no activity), mark current month checked only when
  // previous month had no activity — so Generate now can still appear when data exists.
  const hasPrev = await previousMonthHasActivity(today);
  if (!hasPrev) {
    await setLastWrappedMonth(currentDisplay);
  } else if (latestCreated) {
    await setLastWrappedMonth(wrapDisplayMonthKey(latestCreated.monthKey));
  } else {
    // Activity exists but wrap already stored — sync lastWrapped to current month.
    const existing = await getWrappedForMonth(previousMonthKey(today));
    if (existing) {
      await setLastWrappedMonth(currentDisplay);
    }
  }

  return latestCreated;
}

/** Manual / screen load: load existing or generate for a data month key. */
export async function loadOrGenerateWrapped(monthKey: MonthKey): Promise<SpanishWrappedReport | null> {
  const existing = await getWrappedForMonth(monthKey);
  if (existing) return existing;

  const created = await generateAndSaveForDataMonth(monthKey);
  return created;
}

/** Manual "Generate now" for the overdue current wrap (previous month's data). */
export async function generateCurrentWrappedNow(): Promise<SpanishWrappedReport | null> {
  const dataKey = previousMonthKey();
  const created = await generateAndSaveForDataMonth(dataKey);
  if (created) {
    await setLastWrappedMonth(wrapDisplayMonthKey(created.monthKey));
    return created;
  }
  // If already exists, treat as success for UI.
  const existing = await getWrappedForMonth(dataKey);
  if (existing) {
    await setLastWrappedMonth(wrapDisplayMonthKey(existing.monthKey));
  }
  return existing;
}

export function emptyWrappedMessage(dataMonthKey: MonthKey): string {
  const name = monthNameOnly(dataMonthKey);
  return `No lessons recorded in ${name}.\nStart learning to see your Wrapped next month! 🎉`;
}
