import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateWrappedJaviMessage } from '@/lib/claude';
import { buildWrappedReport, previousMonthKey, type MonthKey, type SpanishWrappedReport } from '@/lib/wrapped-data';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'wrappedHistory';
const UNREAD_KEY = 'wrappedUnreadMonth';

export async function getWrappedHistory(): Promise<SpanishWrappedReport[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SpanishWrappedReport[];
  } catch {
    return [];
  }
}

export async function getWrappedForMonth(monthKey: MonthKey): Promise<SpanishWrappedReport | null> {
  const history = await getWrappedHistory();
  return history.find((w) => w.monthKey === monthKey) ?? null;
}

async function saveAll(reports: SpanishWrappedReport[]): Promise<void> {
  const sorted = [...reports].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, 24)));
}

export async function saveWrappedReport(report: SpanishWrappedReport): Promise<void> {
  const history = await getWrappedHistory();
  const next = history.filter((w) => w.monthKey !== report.monthKey);
  next.push(report);
  await saveAll(next);
  await AsyncStorage.setItem(UNREAD_KEY, report.monthKey);
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

/** Generate wrapped for previous calendar month if missing and we're on/after the 1st. */
export async function ensurePreviousMonthWrapped(): Promise<SpanishWrappedReport | null> {
  const today = new Date();
  const monthKey = previousMonthKey(today);
  const existing = await getWrappedForMonth(monthKey);
  if (existing) return null;

  const draft = await buildWrappedReport(monthKey);
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
  await saveWrappedReport(report);
  return report;
}

export async function loadOrGenerateWrapped(monthKey: MonthKey): Promise<SpanishWrappedReport | null> {
  const existing = await getWrappedForMonth(monthKey);
  if (existing) return existing;

  const draft = await buildWrappedReport(monthKey);
  if (draft.totalLessons === 0 && draft.totalDrills === 0) return null;

  let javiMessage = '';
  try {
    javiMessage = await generateWrappedJaviMessage(draft);
  } catch {
    javiMessage = '¡Sigue así! / Keep going — every session counts.';
  }

  const report: SpanishWrappedReport = { ...draft, javiMessage };
  await saveWrappedReport(report);
  return report;
}
