import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLessonHistory, type LessonHistoryEntry } from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type ErrorDNACategory = 'grammar' | 'writing' | 'vocabulary' | 'speaking' | 'structure';

export type ErrorDNAInput = {
  error: string;
  category: ErrorDNACategory | string;
  occurrences?: number;
  example: string;
  correction: string;
};

export type ErrorDNAItem = {
  error: string;
  category: ErrorDNACategory;
  occurrences: number;
  example: string;
  correction: string;
  lastSeenAt: string;
  appearanceDates: string[];
  improvingSince: string | null;
};

export type ArchivedErrorDNAItem = ErrorDNAItem & {
  archivedAt: string;
};

const STORAGE_KEY = 'errorDNA';
const ARCHIVED_STORAGE_KEY = 'errorDNAArchived';
const MAX_ACTIVE_ERRORS = 20;
const IMPROVING_SESSION_WINDOW = 5;
const ARCHIVE_IMPROVING_MONTHS = 3;

const VALID_CATEGORIES: ErrorDNACategory[] = ['grammar', 'writing', 'vocabulary', 'speaking', 'structure'];

function normalizeErrorKey(error: string): string {
  return error.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCategory(value: string): ErrorDNACategory {
  const lower = value.trim().toLowerCase();
  if (VALID_CATEGORIES.includes(lower as ErrorDNACategory)) {
    return lower as ErrorDNACategory;
  }
  return 'grammar';
}

function normalizeItem(raw: unknown): ErrorDNAItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<ErrorDNAItem>;
  const error = typeof obj.error === 'string' ? obj.error.trim() : '';
  if (!error) return null;

  const appearanceDates = Array.isArray(obj.appearanceDates)
    ? obj.appearanceDates.filter((d): d is string => typeof d === 'string' && Boolean(d.trim()))
    : typeof obj.lastSeenAt === 'string' && obj.lastSeenAt
      ? [obj.lastSeenAt]
      : [];

  return {
    error,
    category: normalizeCategory(typeof obj.category === 'string' ? obj.category : 'grammar'),
    occurrences: Math.max(1, Math.trunc(Number(obj.occurrences) || 1)),
    example: typeof obj.example === 'string' ? obj.example.trim() : '',
    correction: typeof obj.correction === 'string' ? obj.correction.trim() : '',
    lastSeenAt:
      typeof obj.lastSeenAt === 'string' && obj.lastSeenAt ? obj.lastSeenAt : appearanceDates.at(-1) ?? '',
    appearanceDates: [...new Set(appearanceDates)],
    improvingSince: typeof obj.improvingSince === 'string' ? obj.improvingSince : null,
  };
}

function normalizeArchivedItem(raw: unknown): ArchivedErrorDNAItem | null {
  const base = normalizeItem(raw);
  if (!base) return null;
  const obj = raw as Partial<ArchivedErrorDNAItem>;
  return {
    ...base,
    archivedAt: typeof obj.archivedAt === 'string' ? obj.archivedAt : formatLocalDate(),
  };
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return 0;
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

export function getLastSessionDates(history: LessonHistoryEntry[], count = IMPROVING_SESSION_WINDOW): string[] {
  return history
    .slice(-count)
    .map((entry) => entry.date)
    .filter(Boolean);
}

export function getMostRecentSessionDate(history: LessonHistoryEntry[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const date = history[i]?.date;
    if (date) return date;
  }
  return null;
}

export function isErrorRecent(item: ErrorDNAItem, lastSessionDate: string | null): boolean {
  if (!lastSessionDate) return false;
  return item.appearanceDates.includes(lastSessionDate);
}

export function isErrorImproving(item: ErrorDNAItem, recentSessionDates: string[]): boolean {
  if (!recentSessionDates.length) return false;
  return !item.appearanceDates.some((date) => recentSessionDates.includes(date));
}

export function occurrenceIndicator(occurrences: number): string {
  if (occurrences >= 3) return '🔴';
  if (occurrences === 2) return '🟡';
  return '🟢';
}

export function categoryLabel(category: ErrorDNACategory): string {
  switch (category) {
    case 'grammar':
      return 'Grammar';
    case 'writing':
      return 'Writing';
    case 'vocabulary':
      return 'Vocabulary';
    case 'speaking':
      return 'Speaking';
    case 'structure':
      return 'Structure';
  }
}

export function formatErrorDnaForJavi(items: ErrorDNAItem[]): string {
  if (!items.length) return '';
  return items
    .slice(0, 3)
    .map((item, index) => {
      const example = item.example ? ` (e.g. ${item.example})` : '';
      return `${index + 1}. ${item.error}${example}`;
    })
    .join('\n');
}

export function formatErrorDnaForDrillPrompt(items: ErrorDNAInput[]): string {
  if (!items.length) return '';
  return items
    .slice(0, 2)
    .map(
      (item, index) =>
        `${index + 1}. ${item.error} — example mistake: "${item.example}" — correction: ${item.correction}`,
    )
    .join('\n');
}

function updateImprovingFlags(items: ErrorDNAItem[], recentSessionDates: string[]): ErrorDNAItem[] {
  const today = formatLocalDate();
  return items.map((item) => {
    const improving = isErrorImproving(item, recentSessionDates);
    if (!improving) {
      return { ...item, improvingSince: null };
    }
    return {
      ...item,
      improvingSince: item.improvingSince ?? today,
    };
  });
}

function partitionArchivable(
  items: ErrorDNAItem[],
  archived: ArchivedErrorDNAItem[],
  recentSessionDates: string[],
): { active: ErrorDNAItem[]; archived: ArchivedErrorDNAItem[] } {
  const today = formatLocalDate();
  const withFlags = updateImprovingFlags(items, recentSessionDates);
  const active: ErrorDNAItem[] = [];
  const nextArchived = [...archived];

  for (const item of withFlags) {
    const shouldArchive =
      item.improvingSince != null && monthsBetween(item.improvingSince, today) >= ARCHIVE_IMPROVING_MONTHS;

    if (shouldArchive) {
      const key = normalizeErrorKey(item.error);
      if (!nextArchived.some((a) => normalizeErrorKey(a.error) === key)) {
        nextArchived.push({ ...item, archivedAt: today });
      }
      continue;
    }

    active.push(item);
  }

  return { active, archived: nextArchived };
}

async function loadRawActive(): Promise<ErrorDNAItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter((item): item is ErrorDNAItem => item != null);
  } catch {
    return [];
  }
}

async function loadRawArchived(): Promise<ArchivedErrorDNAItem[]> {
  const raw = await AsyncStorage.getItem(ARCHIVED_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeArchivedItem).filter((item): item is ArchivedErrorDNAItem => item != null);
  } catch {
    return [];
  }
}

async function saveActive(items: ErrorDNAItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function saveArchived(items: ArchivedErrorDNAItem[]): Promise<void> {
  await AsyncStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(items));
}

export async function getErrorDNA(): Promise<ErrorDNAItem[]> {
  const [active, archived, history] = await Promise.all([
    loadRawActive(),
    loadRawArchived(),
    getLessonHistory(),
  ]);
  const recentSessionDates = getLastSessionDates(history);
  const { active: nextActive, archived: nextArchived } = partitionArchivable(
    active,
    archived,
    recentSessionDates,
  );

  const sorted = sortByOccurrences(nextActive);
  if (
    sorted.length !== active.length ||
    nextArchived.length !== archived.length ||
    JSON.stringify(sorted) !== JSON.stringify(sortByOccurrences(active))
  ) {
    await Promise.all([saveActive(sorted), saveArchived(nextArchived)]);
  }

  return sorted;
}

export async function getArchivedErrorDNA(): Promise<ArchivedErrorDNAItem[]> {
  await getErrorDNA();
  const archived = await loadRawArchived();
  return archived.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export async function getTopErrorDNA(count = 3): Promise<ErrorDNAItem[]> {
  const items = await getErrorDNA();
  return items.slice(0, count);
}

function sortByOccurrences(items: ErrorDNAItem[]): ErrorDNAItem[] {
  return [...items].sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });
}

export async function mergeErrorDnaFromLesson(
  incoming: ErrorDNAInput[],
  sessionDate: string = formatLocalDate(),
): Promise<ErrorDNAItem[]> {
  if (!incoming.length) {
    return getErrorDNA();
  }

  const [current, archived, history] = await Promise.all([
    loadRawActive(),
    loadRawArchived(),
    getLessonHistory(),
  ]);
  const recentSessionDates = getLastSessionDates(history);
  const merged = new Map<string, ErrorDNAItem>();

  for (const item of current) {
    merged.set(normalizeErrorKey(item.error), { ...item });
  }

  for (const raw of incoming) {
    const error = raw.error?.trim();
    if (!error) continue;

    const key = normalizeErrorKey(error);
    const existing = merged.get(key);

    if (existing) {
      const appearanceDates = existing.appearanceDates.includes(sessionDate)
        ? existing.appearanceDates
        : [...existing.appearanceDates, sessionDate];

      merged.set(key, {
        ...existing,
        category: normalizeCategory(raw.category),
        occurrences: existing.occurrences + 1,
        example: raw.example?.trim() || existing.example,
        correction: raw.correction?.trim() || existing.correction,
        lastSeenAt: sessionDate,
        appearanceDates,
        improvingSince: null,
      });
    } else {
      merged.set(key, {
        error,
        category: normalizeCategory(raw.category),
        occurrences: 1,
        example: raw.example?.trim() ?? '',
        correction: raw.correction?.trim() ?? '',
        lastSeenAt: sessionDate,
        appearanceDates: [sessionDate],
        improvingSince: null,
      });
    }
  }

  const sorted = sortByOccurrences([...merged.values()]).slice(0, MAX_ACTIVE_ERRORS);
  const { active, archived: nextArchived } = partitionArchivable(sorted, archived, recentSessionDates);

  await Promise.all([saveActive(active), saveArchived(nextArchived)]);
  return active;
}
