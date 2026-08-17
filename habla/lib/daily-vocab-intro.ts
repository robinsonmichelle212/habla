import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateDailyVocabWords } from '@/lib/claude';
import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { VOCAB_THEMES, type VocabTheme } from '@/lib/lesson-focus';
import type { LessonConversationTurn } from '@/lib/lesson-session';
import { formatLocalDate } from '@/lib/streak';
import {
  findThemeById,
  normalizeSpanishKey,
  type ThemedVocabWord,
} from '@/lib/themed-vocabulary';

export const CURRENT_VOCAB_THEME_KEY = 'currentVocabTheme';
export const VOCAB_WORDS_SEEN_WEEK_KEY = 'vocabWordsSeenThisWeek';
export const WEEKLY_VOCAB_INTRODUCED_KEY = 'weeklyVocabIntroduced';
export const VOCAB_WEEK_START_KEY = 'vocabWeekStartDate';

export const DAILY_VOCAB_COUNT = 3;
export const WEEKLY_VOCAB_REINFORCE_THRESHOLD = 15;

export type DailyVocabWord = {
  spanish: string;
  english: string;
  partOfSpeech: string;
  exampleSpanish: string;
  exampleEnglish: string;
  memoryHook: string;
  revisiting?: boolean;
};

export type DailyVocabRecapWord = {
  spanish: string;
  english: string;
  javiUsed: boolean;
  userUsed: boolean;
  saved: boolean;
  revisiting?: boolean;
};

function isVocabTheme(value: string | null | undefined): value is VocabTheme {
  return !!value && (VOCAB_THEMES as readonly string[]).includes(value);
}

function pickNextInRotation<T extends string>(items: readonly T[], last: T | null): T {
  if (!last) return items[0];
  const idx = items.indexOf(last);
  if (idx === -1) return items[0];
  return items[(idx + 1) % items.length];
}

/** Monday of the current calendar week as YYYY-MM-DD. */
export function getVocabWeekStartKey(today = formatLocalDate()): string {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function loadSeenWords(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_WORDS_SEEN_WEEK_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w): w is string => typeof w === 'string' && w.trim().length > 0);
  } catch {
    return [];
  }
}

export async function getVocabWordsSeenThisWeek(): Promise<string[]> {
  return loadSeenWords();
}

export async function getWeeklyVocabIntroducedCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_VOCAB_INTRODUCED_KEY);
    return Math.max(0, Math.trunc(Number(raw) || 0));
  } catch {
    return 0;
  }
}

export async function getCurrentVocabTheme(): Promise<VocabTheme> {
  await ensureVocabWeekFresh();
  const raw = await AsyncStorage.getItem(CURRENT_VOCAB_THEME_KEY);
  if (isVocabTheme(raw)) return raw;
  const curriculum = await resolveGrammarCurriculum();
  const theme = VOCAB_THEMES[(Math.max(1, curriculum.currentWeek) - 1) % VOCAB_THEMES.length];
  await AsyncStorage.setItem(CURRENT_VOCAB_THEME_KEY, theme);
  await AsyncStorage.setItem('lastVocabTheme', theme);
  return theme;
}

/** Clears weekly seen words and rotates theme when a new week starts. */
export async function ensureVocabWeekFresh(today = formatLocalDate()): Promise<void> {
  const weekStart = getVocabWeekStartKey(today);
  const stored = await AsyncStorage.getItem(VOCAB_WEEK_START_KEY);
  if (stored === weekStart) return;

  const previousThemeRaw = await AsyncStorage.getItem(CURRENT_VOCAB_THEME_KEY);
  const previousTheme = isVocabTheme(previousThemeRaw) ? previousThemeRaw : null;
  const nextTheme = pickNextInRotation(VOCAB_THEMES, previousTheme);

  await AsyncStorage.multiSet([
    [VOCAB_WEEK_START_KEY, weekStart],
    [VOCAB_WORDS_SEEN_WEEK_KEY, '[]'],
    [WEEKLY_VOCAB_INTRODUCED_KEY, '0'],
    [CURRENT_VOCAB_THEME_KEY, nextTheme],
    ['lastVocabTheme', nextTheme],
  ]);
}

export function grammarTopicLabel(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return focus.topic;
    case 'structure':
      return focus.topic.title;
    case 'vocabulary':
      return focus.theme;
    case 'your-day':
      return 'Everyday conversation';
    case 'read':
      return focus.textTypeLabel;
  }
}

function themedToDaily(word: ThemedVocabWord, revisiting: boolean): DailyVocabWord {
  return {
    spanish: word.spanish,
    english: word.english,
    partOfSpeech: 'noun',
    exampleSpanish: word.exampleSpanish,
    exampleEnglish: word.exampleEnglish,
    memoryHook: word.definition,
    revisiting,
  };
}

function fallbackDailyWords(theme: VocabTheme, seen: string[], revisiting: boolean): DailyVocabWord[] {
  const pack = findThemeById(theme);
  if (!pack) return [];
  const seenKeys = new Set(seen.map(normalizeSpanishKey));
  const pool = pack.words.filter((w) => !seenKeys.has(normalizeSpanishKey(w.spanish)));
  const source = revisiting && pool.length < DAILY_VOCAB_COUNT ? pack.words : pool.length ? pool : pack.words;
  return source.slice(0, DAILY_VOCAB_COUNT).map((w) => themedToDaily(w, revisiting));
}

export async function selectDailyVocabWordsForLesson(
  focus: LessonFocusContext,
  options?: { skipClaude?: boolean },
): Promise<{ theme: VocabTheme; words: DailyVocabWord[]; revisiting: boolean }> {
  await ensureVocabWeekFresh();
  const theme = await getCurrentVocabTheme();
  const seen = await loadSeenWords();
  const revisiting = seen.length >= WEEKLY_VOCAB_REINFORCE_THRESHOLD;
  const grammarTopic = grammarTopicLabel(focus);

  let words: DailyVocabWord[] = [];
  if (!options?.skipClaude) {
    try {
      words = await generateDailyVocabWords({
        theme,
        seenThisWeek: seen,
        grammarTopic,
        revisiting,
      });
    } catch {
      words = [];
    }
  }

  if (words.length < DAILY_VOCAB_COUNT) {
    const fallback = fallbackDailyWords(theme, seen, revisiting);
    const merged = [...words];
    for (const item of fallback) {
      if (merged.length >= DAILY_VOCAB_COUNT) break;
      if (merged.some((w) => normalizeSpanishKey(w.spanish) === normalizeSpanishKey(item.spanish))) {
        continue;
      }
      merged.push(item);
    }
    words = merged.slice(0, DAILY_VOCAB_COUNT);
  }

  return { theme, words, revisiting };
}

export function buildDailyVocabIntroMessage(words: DailyVocabWord[], revisiting: boolean): string {
  const header = revisiting
    ? 'Para repasar — tres palabras de esta semana: 🔤'
    : 'Antes de empezar — tres palabras para hoy. 🔤';
  const lines = words.map((word, index) => {
    const hook = word.memoryHook ? `\n   💡 ${word.memoryHook}` : '';
    return `${index + 1}. ${word.spanish} — ${word.english}\n   «${word.exampleSpanish}»${hook}`;
  });
  return `${header}\n\n${lines.join('\n\n')}\n\nIntenta usarlas en la lección de hoy.`;
}

export async function recordDailyVocabWordsShown(words: DailyVocabWord[]): Promise<void> {
  const seen = await loadSeenWords();
  const keys = new Set(seen.map(normalizeSpanishKey));
  const added = words.filter((w) => !keys.has(normalizeSpanishKey(w.spanish)));
  if (!added.length) return;

  const nextSeen = [...seen, ...added.map((w) => w.spanish)];
  await AsyncStorage.setItem(VOCAB_WORDS_SEEN_WEEK_KEY, JSON.stringify(nextSeen));

  const introduced = await getWeeklyVocabIntroducedCount();
  const newCount = introduced + added.filter((w) => !w.revisiting).length;
  await AsyncStorage.setItem(WEEKLY_VOCAB_INTRODUCED_KEY, String(newCount));
}

function stripArticles(value: string): string {
  return value.replace(/^(el|la|los|las|un|una)\s+/i, '').trim();
}

function wordInText(text: string, spanish: string): boolean {
  const haystack = text.toLowerCase();
  const needle = stripArticles(spanish).toLowerCase();
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const first = needle.split(/\s+/)[0];
  return first.length > 3 && new RegExp(`\\b${first}\\b`, 'i').test(haystack);
}

export function detectDailyVocabUsage(
  words: DailyVocabWord[],
  warmUp: LessonConversationTurn[],
  speaking: LessonConversationTurn[],
  userWriting?: string,
): Record<string, { javiUsed: boolean; userUsed: boolean }> {
  const javiText = [...warmUp, ...speaking]
    .filter((t) => t.role === 'assistant')
    .map((t) => t.spanish)
    .join(' ');
  const userText = [
    ...warmUp.filter((t) => t.role === 'user').map((t) => t.spanish),
    ...speaking.filter((t) => t.role === 'user').map((t) => t.spanish),
    userWriting ?? '',
  ].join(' ');

  const usage: Record<string, { javiUsed: boolean; userUsed: boolean }> = {};
  for (const word of words) {
    usage[normalizeSpanishKey(word.spanish)] = {
      javiUsed: wordInText(javiText, word.spanish),
      userUsed: wordInText(userText, word.spanish),
    };
  }
  return usage;
}

export function buildDailyVocabRecap(
  words: DailyVocabWord[],
  usage: Record<string, { javiUsed: boolean; userUsed: boolean }>,
  savedKeys: Set<string>,
): DailyVocabRecapWord[] {
  return words.map((word) => {
    const key = normalizeSpanishKey(word.spanish);
    const hit = usage[key] ?? { javiUsed: false, userUsed: false };
    return {
      spanish: word.spanish,
      english: word.english,
      javiUsed: hit.javiUsed,
      userUsed: hit.userUsed,
      saved: savedKeys.has(key),
      revisiting: word.revisiting,
    };
  });
}

export function formatDailyVocabPromptList(words: DailyVocabWord[]): string {
  return words.map((w) => `${w.spanish} (${w.english})`).join(', ');
}
