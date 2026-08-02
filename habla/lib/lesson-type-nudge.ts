import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonKindId } from '@/lib/claude';
import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { formatLocalDate } from '@/lib/streak';

const KEY_LESSON_TYPE_HISTORY = 'lessonTypeHistory';
const KEY_LAST_GRAMMAR = 'lastGrammarLesson';
const KEY_LAST_YOUR_DAY = 'lastYourDayLesson';
const KEY_LAST_STRUCTURE = 'lastStructureLesson';
const KEY_LAST_READ = 'lastReadLesson';
const KEY_WEEKLY_OVERRIDE_USED = 'weeklyOverrideUsed';
const KEY_WEEKLY_OVERRIDE_WEEK = 'weeklyOverrideWeekStart';

export type SelectableLessonKind = Exclude<LessonKindId, 'vocabulary'>;

export type LessonTypeHistoryEntry = {
  type: 'Grammar' | 'Your Day' | 'Structure' | 'Read';
  date: string; // YYYY-MM-DD
  curriculumWeek: number;
};

export type LessonNudgeResult = {
  recommended: SelectableLessonKind;
  nudgeMessage: string | null;
  reason: 'grammar-default' | 'grammar-rotation' | 'neglected';
  neglectedDays: number | null;
};

const KIND_META: Record<
  SelectableLessonKind,
  { label: string; emoji: string; historyType: LessonTypeHistoryEntry['type']; lastKey: string }
> = {
  grammar: {
    label: 'Grammar',
    emoji: '📚',
    historyType: 'Grammar',
    lastKey: KEY_LAST_GRAMMAR,
  },
  'your-day': {
    label: 'Your Day',
    emoji: '🗣️',
    historyType: 'Your Day',
    lastKey: KEY_LAST_YOUR_DAY,
  },
  structure: {
    label: 'Structure',
    emoji: '🏗️',
    historyType: 'Structure',
    lastKey: KEY_LAST_STRUCTURE,
  },
  read: {
    label: 'Read',
    emoji: '📖',
    historyType: 'Read',
    lastKey: KEY_LAST_READ,
  },
};

const NEGLECT_DAYS: Record<Exclude<SelectableLessonKind, 'grammar'>, number> = {
  'your-day': 3,
  structure: 4,
  read: 5,
};

export const LESSON_TYPE_OPTIONS: {
  id: SelectableLessonKind;
  label: string;
}[] = [
  { id: 'grammar', label: 'Grammar 📚' },
  { id: 'your-day', label: 'Your Day 🗣️' },
  { id: 'structure', label: 'Structure 🏗️' },
  { id: 'read', label: 'Read 📖' },
];

function daysBetween(fromDate: string, toDate: string): number {
  const a = new Date(`${fromDate}T12:00:00`);
  const b = new Date(`${toDate}T12:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export function mondayOfWeek(d: Date = new Date()): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return formatLocalDate(copy);
}

export async function ensureWeeklyOverrideReset(today: Date = new Date()): Promise<void> {
  const monday = mondayOfWeek(today);
  const stored = await AsyncStorage.getItem(KEY_WEEKLY_OVERRIDE_WEEK);
  if (stored !== monday) {
    await AsyncStorage.setItem(KEY_WEEKLY_OVERRIDE_WEEK, monday);
    await AsyncStorage.setItem(KEY_WEEKLY_OVERRIDE_USED, 'false');
  }
}

export async function getWeeklyOverrideUsed(): Promise<boolean> {
  await ensureWeeklyOverrideReset();
  return (await AsyncStorage.getItem(KEY_WEEKLY_OVERRIDE_USED)) === 'true';
}

export async function markWeeklyOverrideUsed(): Promise<void> {
  await ensureWeeklyOverrideReset();
  await AsyncStorage.setItem(KEY_WEEKLY_OVERRIDE_USED, 'true');
}

export async function getLessonTypeHistory(): Promise<LessonTypeHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY_LESSON_TYPE_HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LessonTypeHistoryEntry =>
        !!e &&
        typeof e.type === 'string' &&
        typeof e.date === 'string' &&
        typeof e.curriculumWeek === 'number',
    );
  } catch {
    return [];
  }
}

async function getLastLessonDate(kind: SelectableLessonKind): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KIND_META[kind].lastKey);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function recordLessonTypeCompletion(
  kind: SelectableLessonKind | 'vocabulary',
  curriculumWeek?: number,
): Promise<void> {
  // Vocabulary absorbed — do not record as a standalone type.
  if (kind === 'vocabulary') return;

  const today = formatLocalDate();
  let week = curriculumWeek;
  if (week == null) {
    try {
      week = (await resolveGrammarCurriculum()).currentWeek;
    } catch {
      week = 1;
    }
  }

  const history = await getLessonTypeHistory();
  history.unshift({
    type: KIND_META[kind].historyType,
    date: today,
    curriculumWeek: week,
  });
  await AsyncStorage.setItem(KEY_LESSON_TYPE_HISTORY, JSON.stringify(history.slice(0, 21)));
  await AsyncStorage.setItem(KIND_META[kind].lastKey, today);
}

function spanishLabel(kind: SelectableLessonKind): string {
  switch (kind) {
    case 'grammar':
      return 'Gramática';
    case 'your-day':
      return 'Tu día';
    case 'structure':
      return 'Estructura';
    case 'read':
      return 'Lectura';
  }
}

function neglectedMessage(kind: Exclude<SelectableLessonKind, 'grammar'>, days: number): string {
  switch (kind) {
    case 'your-day':
      return `Hace ${days} días que no hablamos de tu día.\nTe lo propongo para hoy.`;
    case 'structure':
      return `Hace ${days} días que no practicamos estructura.\nTe lo propongo para hoy.`;
    case 'read':
      return `Hace ${days} días que no leemos.\nTe lo propongo para hoy.`;
  }
}

function rotationMessage(kind: SelectableLessonKind, consecutiveGrammar: number, week: number): string {
  const name = spanishLabel(kind);
  if (week <= 8 && consecutiveGrammar >= 3) {
    return `Llevamos 3 días de gramática.\n¿Qué tal algo diferente hoy?\nHe elegido ${name} para ti.`;
  }
  if (week <= 16 && consecutiveGrammar >= 2) {
    return `Dos días de gramática seguidos — bien hecho.\nHoy te propongo ${name}.`;
  }
  return `Hoy te propongo ${name}.`;
}

function longestNeglected(
  lastDates: Record<SelectableLessonKind, string | null>,
  today: string,
): { kind: Exclude<SelectableLessonKind, 'grammar'>; days: number } | null {
  let best: { kind: Exclude<SelectableLessonKind, 'grammar'>; days: number } | null = null;
  (Object.keys(NEGLECT_DAYS) as Array<Exclude<SelectableLessonKind, 'grammar'>>).forEach((kind) => {
    const last = lastDates[kind];
    // Never-done types are not "neglected" — only types with a prior completion.
    if (!last) return;
    const days = daysBetween(last, today);
    const threshold = NEGLECT_DAYS[kind];
    if (days >= threshold) {
      if (!best || days > best.days) best = { kind, days };
    }
  });
  return best;
}

function longestSince(
  lastDates: Record<SelectableLessonKind, string | null>,
  today: string,
  exclude: SelectableLessonKind[] = ['grammar'],
): SelectableLessonKind {
  const candidates: SelectableLessonKind[] = ['your-day', 'structure', 'read', 'grammar'].filter(
    (k) => !exclude.includes(k as SelectableLessonKind),
  ) as SelectableLessonKind[];
  let best: SelectableLessonKind = candidates[0] ?? 'your-day';
  let bestDays = -1;
  for (const kind of candidates) {
    const last = lastDates[kind];
    const days = last ? daysBetween(last, today) : 10_000;
    if (days > bestDays) {
      bestDays = days;
      best = kind;
    }
  }
  return best;
}

function consecutiveGrammarCount(history: LessonTypeHistoryEntry[]): number {
  let count = 0;
  for (const entry of history) {
    if (entry.type === 'Grammar') count += 1;
    else break;
  }
  return count;
}

export async function resolveLessonNudge(today: Date = new Date()): Promise<LessonNudgeResult> {
  const todayStr = formatLocalDate(today);
  const [history, curriculum, lastGrammar, lastYourDay, lastStructure, lastRead] =
    await Promise.all([
      getLessonTypeHistory(),
      resolveGrammarCurriculum(todayStr),
      getLastLessonDate('grammar'),
      getLastLessonDate('your-day'),
      getLastLessonDate('structure'),
      getLastLessonDate('read'),
    ]);

  const week = Math.max(1, Math.min(30, curriculum.currentWeek || 1));
  const lastDates: Record<SelectableLessonKind, string | null> = {
    grammar: lastGrammar,
    'your-day': lastYourDay,
    structure: lastStructure,
    read: lastRead,
  };

  const neglected = longestNeglected(lastDates, todayStr);
  if (neglected) {
    return {
      recommended: neglected.kind,
      nudgeMessage: neglectedMessage(neglected.kind, neglected.days),
      reason: 'neglected',
      neglectedDays: neglected.days,
    };
  }

  const consecutive = consecutiveGrammarCount(history);
  let forceRotate = false;
  if (week <= 8) {
    forceRotate = consecutive >= 3;
  } else if (week <= 16) {
    forceRotate = consecutive >= 2;
  } else {
    forceRotate = consecutive >= 1;
  }

  if (!forceRotate) {
    return {
      recommended: 'grammar',
      nudgeMessage: null,
      reason: 'grammar-default',
      neglectedDays: null,
    };
  }

  const pick = longestSince(lastDates, todayStr, ['grammar']);
  return {
    recommended: pick,
    nudgeMessage: rotationMessage(pick, consecutive, week),
    reason: 'grammar-rotation',
    neglectedDays: null,
  };
}

export function homeRecommendationPreview(nudge: LessonNudgeResult): string {
  const meta = KIND_META[nudge.recommended];
  if (nudge.reason === 'neglected' && nudge.neglectedDays != null) {
    const verb =
      nudge.recommended === 'read'
        ? 'leer'
        : nudge.recommended === 'structure'
          ? 'practicar estructura'
          : 'hablar de tu día';
    return `Javi recomienda: ${meta.label} ${meta.emoji} — llevas ${nudge.neglectedDays} días sin ${verb}`;
  }
  return `Javi recomienda: ${meta.label} ${meta.emoji} hoy`;
}

export type WeeklyLessonBalance = {
  Grammar: number;
  'Your Day': number;
  Structure: number;
  Read: number;
};

export async function getWeeklyLessonBalance(today: Date = new Date()): Promise<WeeklyLessonBalance> {
  const monday = mondayOfWeek(today);
  const history = await getLessonTypeHistory();
  const balance: WeeklyLessonBalance = {
    Grammar: 0,
    'Your Day': 0,
    Structure: 0,
    Read: 0,
  };
  for (const entry of history) {
    if (entry.date < monday) continue;
    if (entry.type in balance) {
      balance[entry.type] += 1;
    }
  }
  return balance;
}

export function lessonKindFromHistoryLabel(
  label: string,
): SelectableLessonKind | 'vocabulary' | null {
  switch (label) {
    case 'Grammar':
      return 'grammar';
    case 'Your Day':
      return 'your-day';
    case 'Structure':
      return 'structure';
    case 'Read':
      return 'read';
    case 'Vocabulary':
    case 'Vocab':
      return 'vocabulary';
    default:
      return null;
  }
}
