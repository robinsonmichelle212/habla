import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonKindId } from '@/lib/claude';
import { formatLocalDate } from '@/lib/streak';

const KEY_CURRENT_GRAMMAR_TOPIC = 'currentGrammarTopic';
const KEY_GRAMMAR_WEEK_START = 'grammarWeekStartDate';
const KEY_LAST_VOCAB_THEME = 'lastVocabTheme';
const KEY_LAST_YOUR_DAY_TOPIC = 'lastYourDayTopic';
const KEY_COVERED_GRAMMAR_TOPICS = 'coveredGrammarTopics';
const KEY_COVERED_VOCAB_THEMES = 'coveredVocabThemes';
const KEY_COVERED_YOUR_DAY_TOPICS = 'coveredYourDayTopics';

export const GRAMMAR_TOPICS = [
  'Present tense',
  'Past tense (preterite)',
  'Past tense (imperfect)',
  'Future tense',
  'Subjunctive mood',
  'Reflexive verbs',
  'Ser vs Estar',
  'Por vs Para',
  'Conditional tense',
  'Imperative mood',
] as const;

export const VOCAB_THEMES = [
  'Food and cooking',
  'Travel and transport',
  'Work and careers',
  'Health and body',
  'Weather and environment',
  'Family and relationships',
  'Technology and modern life',
  'Culture and entertainment',
  'Shopping and money',
  'Sport and hobbies',
] as const;

export const YOUR_DAY_TOPICS = [
  'Something that happened this week',
  'Weekend plans',
  'A place you\'ve been recently',
  'Something you\'re looking forward to',
  'Your opinion on something current',
  'A recent meal you had',
  'Something you watched or read recently',
  'A challenge you faced recently',
  'Something that made you laugh',
  'Your plans for the next few weeks',
] as const;

export type GrammarTopic = (typeof GRAMMAR_TOPICS)[number];
export type VocabTheme = (typeof VOCAB_THEMES)[number];
export type YourDayTopic = (typeof YOUR_DAY_TOPICS)[number];

export type LessonFocusContext =
  | { kind: 'grammar'; topic: GrammarTopic; topicSpanish: string }
  | { kind: 'vocabulary'; theme: VocabTheme; themeSpanish: string }
  | { kind: 'your-day'; starter: YourDayTopic; starterSpanish: string };

const GRAMMAR_TOPIC_SPANISH: Record<GrammarTopic, string> = {
  'Present tense': 'el presente',
  'Past tense (preterite)': 'el pretérito',
  'Past tense (imperfect)': 'el imperfecto',
  'Future tense': 'el futuro',
  'Subjunctive mood': 'el subjuntivo',
  'Reflexive verbs': 'los verbos reflexivos',
  'Ser vs Estar': 'ser vs estar',
  'Por vs Para': 'por vs para',
  'Conditional tense': 'el condicional',
  'Imperative mood': 'el imperativo',
};

const VOCAB_THEME_SPANISH: Record<VocabTheme, string> = {
  'Food and cooking': 'la comida y la cocina',
  'Travel and transport': 'los viajes y el transporte',
  'Work and careers': 'el trabajo y las carreras',
  'Health and body': 'la salud y el cuerpo',
  'Weather and environment': 'el tiempo y el medio ambiente',
  'Family and relationships': 'la familia y las relaciones',
  'Technology and modern life': 'la tecnología y la vida moderna',
  'Culture and entertainment': 'la cultura y el entretenimiento',
  'Shopping and money': 'las compras y el dinero',
  'Sport and hobbies': 'el deporte y los pasatiempos',
};

const YOUR_DAY_STARTER_SPANISH: Record<YourDayTopic, string> = {
  'Something that happened this week':
    '¿Qué ha pasado esta semana que quieras contarme?',
  'Weekend plans': '¿Qué planes tienes para el fin de semana?',
  "A place you've been recently": '¿Qué lugar has visitado recientemente?',
  "Something you're looking forward to": '¿Qué es lo que más esperas con ilusión?',
  'Your opinion on something current':
    '¿Qué opinas de algo que haya pasado últimamente?',
  'A recent meal you had': '¿Qué comida memorable has probado hace poco?',
  'Something you watched or read recently':
    '¿Qué has visto o leído recientemente que te haya gustado?',
  'A challenge you faced recently': '¿Qué reto has tenido recientemente?',
  'Something that made you laugh': '¿Qué te ha hecho reír últimamente?',
  'Your plans for the next few weeks': '¿Qué planes tienes para las próximas semanas?',
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function isGrammarTopic(value: string | null): value is GrammarTopic {
  return !!value && (GRAMMAR_TOPICS as readonly string[]).includes(value);
}

function isVocabTheme(value: string | null): value is VocabTheme {
  return !!value && (VOCAB_THEMES as readonly string[]).includes(value);
}

function isYourDayTopic(value: string | null): value is YourDayTopic {
  return !!value && (YOUR_DAY_TOPICS as readonly string[]).includes(value);
}

async function addToCoveredList(key: string, value: string): Promise<void> {
  const raw = await AsyncStorage.getItem(key);
  let list: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter((x) => typeof x === 'string');
      }
    } catch {
      list = [];
    }
  }
  const normalized = value.trim();
  if (!normalized) return;
  if (list.some((x) => x.toLowerCase() === normalized.toLowerCase())) return;
  list.push(normalized);
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

async function recordFocusCoverage(focus: LessonFocusContext): Promise<void> {
  switch (focus.kind) {
    case 'grammar':
      await addToCoveredList(KEY_COVERED_GRAMMAR_TOPICS, focus.topic);
      break;
    case 'vocabulary':
      await addToCoveredList(KEY_COVERED_VOCAB_THEMES, focus.theme);
      break;
    case 'your-day':
      await addToCoveredList(KEY_COVERED_YOUR_DAY_TOPICS, focus.starter);
      break;
  }
}

export async function getCoveredGrammarTopicsFromStorage(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_COVERED_GRAMMAR_TOPICS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function getCoveredVocabThemesFromStorage(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_COVERED_VOCAB_THEMES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function getCoveredYourDayTopicsFromStorage(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_COVERED_YOUR_DAY_TOPICS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pickNextInRotation<T extends string>(items: readonly T[], last: T | null): T {
  if (!last) return items[0];
  const idx = items.indexOf(last);
  if (idx === -1) return items[0];
  return items[(idx + 1) % items.length];
}

async function resolveWeeklyGrammarTopic(today: string = formatLocalDate()): Promise<GrammarTopic> {
  const [storedTopic, storedStart] = await Promise.all([
    AsyncStorage.getItem(KEY_CURRENT_GRAMMAR_TOPIC),
    AsyncStorage.getItem(KEY_GRAMMAR_WEEK_START),
  ]);

  if (!isGrammarTopic(storedTopic) || !storedStart) {
    const topic = GRAMMAR_TOPICS[0];
    await AsyncStorage.multiSet([
      [KEY_CURRENT_GRAMMAR_TOPIC, topic],
      [KEY_GRAMMAR_WEEK_START, today],
    ]);
    return topic;
  }

  if (daysBetween(storedStart, today) >= 7) {
    const currentIdx = GRAMMAR_TOPICS.indexOf(storedTopic);
    const nextTopic = GRAMMAR_TOPICS[(currentIdx + 1) % GRAMMAR_TOPICS.length];
    await AsyncStorage.multiSet([
      [KEY_CURRENT_GRAMMAR_TOPIC, nextTopic],
      [KEY_GRAMMAR_WEEK_START, today],
    ]);
    return nextTopic;
  }

  return storedTopic;
}

async function selectVocabTheme(): Promise<VocabTheme> {
  const last = await AsyncStorage.getItem(KEY_LAST_VOCAB_THEME);
  const theme = pickNextInRotation(
    VOCAB_THEMES,
    isVocabTheme(last) ? last : null,
  );
  await AsyncStorage.setItem(KEY_LAST_VOCAB_THEME, theme);
  return theme;
}

async function selectYourDayTopic(): Promise<YourDayTopic> {
  const last = await AsyncStorage.getItem(KEY_LAST_YOUR_DAY_TOPIC);
  const starter = pickNextInRotation(
    YOUR_DAY_TOPICS,
    isYourDayTopic(last) ? last : null,
  );
  await AsyncStorage.setItem(KEY_LAST_YOUR_DAY_TOPIC, starter);
  return starter;
}

/** Resolves and persists the focus for a lesson type (grammar weekly, vocab/your-day per lesson). */
export async function prepareLessonFocus(lessonKind: LessonKindId): Promise<LessonFocusContext> {
  let focus: LessonFocusContext;
  switch (lessonKind) {
    case 'grammar': {
      const topic = await resolveWeeklyGrammarTopic();
      focus = {
        kind: 'grammar',
        topic,
        topicSpanish: GRAMMAR_TOPIC_SPANISH[topic],
      };
      break;
    }
    case 'vocabulary': {
      const theme = await selectVocabTheme();
      focus = {
        kind: 'vocabulary',
        theme,
        themeSpanish: VOCAB_THEME_SPANISH[theme],
      };
      break;
    }
    case 'your-day': {
      const starter = await selectYourDayTopic();
      focus = {
        kind: 'your-day',
        starter,
        starterSpanish: YOUR_DAY_STARTER_SPANISH[starter],
      };
      break;
    }
  }
  await recordFocusCoverage(focus);
  return focus;
}

/** Read the current weekly grammar topic from AsyncStorage (no rotation side effects). */
export async function getCurrentGrammarTopic(): Promise<GrammarTopic | null> {
  const stored = await AsyncStorage.getItem(KEY_CURRENT_GRAMMAR_TOPIC);
  return isGrammarTopic(stored) ? stored : null;
}

export function grammarRotationProgress(
  coveredTopics: string[],
  currentTopic: GrammarTopic | null,
): { covered: GrammarTopic[]; remaining: GrammarTopic[]; progress: number } {
  const coveredSet = new Set(coveredTopics.map((t) => t.toLowerCase()));
  const covered = GRAMMAR_TOPICS.filter((t) => coveredSet.has(t.toLowerCase()));
  const remaining = GRAMMAR_TOPICS.filter((t) => !coveredSet.has(t.toLowerCase()));
  const currentIdx = currentTopic ? GRAMMAR_TOPICS.indexOf(currentTopic) : -1;
  const progress =
    currentIdx >= 0
      ? Math.round(((currentIdx + 1) / GRAMMAR_TOPICS.length) * 100)
      : Math.round((covered.length / GRAMMAR_TOPICS.length) * 100);
  return { covered, remaining, progress };
}

export function vocabThemeRotation(
  coveredThemes: string[],
): { covered: VocabTheme[]; remaining: VocabTheme[] } {
  const coveredSet = new Set(coveredThemes.map((t) => t.toLowerCase()));
  return {
    covered: VOCAB_THEMES.filter((t) => coveredSet.has(t.toLowerCase())),
    remaining: VOCAB_THEMES.filter((t) => !coveredSet.has(t.toLowerCase())),
  };
}

export function lessonFocusLabel(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return focus.topic;
    case 'vocabulary':
      return focus.theme;
    case 'your-day':
      return focus.starter;
  }
}

export function buildLessonOpening(focus: LessonFocusContext): {
  spanish: string;
  translation?: string;
} {
  switch (focus.kind) {
    case 'grammar':
      return {
        spanish: `Esta semana practicamos ${focus.topicSpanish}.`,
        translation: `This week we're focusing on ${focus.topic}.`,
      };
    case 'vocabulary':
      return {
        spanish: `¡Hola! Hoy practicamos vocabulario de ${focus.themeSpanish}.`,
        translation: `Hi! Today we're practising vocabulary about ${focus.theme}.`,
      };
    case 'your-day':
      return {
        spanish: focus.starterSpanish,
        translation: focus.starter,
      };
  }
}
