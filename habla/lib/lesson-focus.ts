import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonKindId } from '@/lib/claude';
import {
  getStructureTopic,
  STRUCTURE_TOPICS,
  structureTopicLabel,
  type StructureTopic,
} from '@/lib/sentence-structure';
import {
  getWeekDefinition,
  resolveGrammarCurriculum,
  type GrammarCurriculumState,
  type GrammarTopic,
} from '@/lib/grammar-curriculum';

const KEY_LAST_VOCAB_THEME = 'lastVocabTheme';
const KEY_LAST_YOUR_DAY_TOPIC = 'lastYourDayTopic';
const KEY_COVERED_GRAMMAR_TOPICS = 'coveredGrammarTopics';
const KEY_COVERED_VOCAB_THEMES = 'coveredVocabThemes';
const KEY_COVERED_YOUR_DAY_TOPICS = 'coveredYourDayTopics';
const KEY_LAST_STRUCTURE_TOPIC = 'lastStructureTopic';
const KEY_COVERED_STRUCTURE_TOPICS = 'coveredStructureTopics';

export type { GrammarTopic } from '@/lib/grammar-curriculum';
export {
  GRAMMAR_TOPICS,
  GRAMMAR_WEEK_DEFINITIONS,
  TOTAL_CURRICULUM_WEEKS,
  getGrammarCurriculum,
  resetGrammarCurriculum,
  resolveGrammarCurriculum,
  daysRemainingInWeek,
  weekLabel,
  grammarCurriculumProgress,
  isWeekCompleted,
  isWeekLocked,
  getCurrentGrammarTopic,
  getWeekDefinition,
} from '@/lib/grammar-curriculum';

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

export type VocabTheme = (typeof VOCAB_THEMES)[number];
export type YourDayTopic = (typeof YOUR_DAY_TOPICS)[number];

export type StructureTopicId = StructureTopic['id'];

export type LessonFocusContext =
  | {
      kind: 'grammar';
      topic: GrammarTopic;
      topicSpanish: string;
      weekNumber: number;
      focusVerbs: string[];
      includesContrast: boolean;
      weekSummary: string;
      curriculum: GrammarCurriculumState;
    }
  | { kind: 'vocabulary'; theme: VocabTheme; themeSpanish: string }
  | { kind: 'your-day'; starter: YourDayTopic; starterSpanish: string }
  | { kind: 'structure'; topic: StructureTopic };

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
    case 'structure':
      await addToCoveredList(KEY_COVERED_STRUCTURE_TOPICS, focus.topic.title);
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

async function selectStructureTopic(): Promise<StructureTopic> {
  const lastRaw = await AsyncStorage.getItem(KEY_LAST_STRUCTURE_TOPIC);
  const lastId = lastRaw ? Number(lastRaw) : null;
  const lastTopic =
    lastId != null && STRUCTURE_TOPICS.some((t) => t.id === lastId)
      ? getStructureTopic(lastId)
      : null;
  const ids = STRUCTURE_TOPICS.map((t) => t.id);
  const nextId = lastTopic
    ? ids[(ids.indexOf(lastTopic.id) + 1) % ids.length]
    : ids[0];
  const topic = getStructureTopic(nextId);
  await AsyncStorage.setItem(KEY_LAST_STRUCTURE_TOPIC, String(topic.id));
  return topic;
}

/** Resolves and persists the focus for a lesson type (grammar weekly, vocab/your-day per lesson). */
export async function prepareLessonFocus(lessonKind: LessonKindId): Promise<LessonFocusContext> {
  let focus: LessonFocusContext;
  switch (lessonKind) {
    case 'grammar': {
      const curriculum = await resolveGrammarCurriculum();
      const weekDef = getWeekDefinition(curriculum.currentWeek);
      focus = {
        kind: 'grammar',
        topic: weekDef.topic,
        topicSpanish: weekDef.topicSpanish,
        weekNumber: weekDef.week,
        focusVerbs: weekDef.focusVerbs,
        includesContrast: weekDef.includesContrast,
        weekSummary: weekDef.summary,
        curriculum,
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
    case 'structure': {
      const topic = await selectStructureTopic();
      focus = { kind: 'structure', topic };
      break;
    }
  }
  await recordFocusCoverage(focus);
  return focus;
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
      return `Week ${focus.weekNumber}: ${focus.topic}`;
    case 'vocabulary':
      return focus.theme;
    case 'your-day':
      return focus.starter;
    case 'structure':
      return structureTopicLabel(focus.topic);
  }
}

export function buildLessonOpening(focus: LessonFocusContext): {
  spanish: string;
  translation?: string;
} {
  switch (focus.kind) {
    case 'grammar':
      return {
        spanish: `Semana ${focus.weekNumber} de 20. Esta semana practicamos ${focus.topicSpanish}.`,
        translation: `Week ${focus.weekNumber} of 20. This week we're focusing on ${focus.topic}.`,
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
    case 'structure':
      return {
        spanish: `Hoy practicamos estructura: ${focus.topic.title}.`,
        translation: `Today we're practising sentence structure: ${focus.topic.title}. ${focus.topic.summary}`,
      };
  }
}
