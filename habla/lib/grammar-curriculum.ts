import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatLocalDate } from '@/lib/streak';

export const GRAMMAR_CURRICULUM_KEY = 'grammarCurriculum';
export const TOTAL_CURRICULUM_WEEKS = 20;

export type GrammarTopic =
  | 'Present tense'
  | 'Preterite'
  | 'Imperfect'
  | 'Preterite vs Imperfect'
  | 'Future tense'
  | 'Conditional'
  | 'Present subjunctive'
  | 'Ser vs Estar'
  | 'Por vs Para'
  | 'Reflexive verbs';

export type GrammarWeekDefinition = {
  week: number;
  topic: GrammarTopic;
  topicSpanish: string;
  summary: string;
  focusVerbs: string[];
  includesContrast: boolean;
};

export type GrammarCurriculumState = {
  currentWeek: number;
  currentTopic: GrammarTopic;
  weekStartDate: string;
  completedWeeks: number[];
  currentFocusVerbs: string[];
};

const TOPIC_SPANISH: Record<GrammarTopic, string> = {
  'Present tense': 'el presente',
  Preterite: 'el pretérito indefinido',
  Imperfect: 'el imperfecto',
  'Preterite vs Imperfect': 'el pretérito vs el imperfecto',
  'Future tense': 'el futuro',
  Conditional: 'el condicional',
  'Present subjunctive': 'el presente de subjuntivo',
  'Ser vs Estar': 'ser vs estar',
  'Por vs Para': 'por vs para',
  'Reflexive verbs': 'los verbos reflexivos',
};

/** Full 20-week progressive grammar curriculum (weeks 1–2 share a topic, etc.). */
export const GRAMMAR_WEEK_DEFINITIONS: GrammarWeekDefinition[] = [
  {
    week: 1,
    topic: 'Present tense',
    topicSpanish: TOPIC_SPANISH['Present tense'],
    summary: 'Present tense — top 10 irregular verbs in context',
    focusVerbs: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'querer', 'saber', 'dar', 'venir'],
    includesContrast: false,
  },
  {
    week: 2,
    topic: 'Present tense',
    topicSpanish: TOPIC_SPANISH['Present tense'],
    summary: 'Present tense — top 10 irregular verbs in context',
    focusVerbs: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'querer', 'saber', 'dar', 'venir'],
    includesContrast: false,
  },
  {
    week: 3,
    topic: 'Preterite',
    topicSpanish: TOPIC_SPANISH.Preterite,
    summary: 'Preterite — completed past actions, top irregular preterites',
    focusVerbs: [
      'ser/ir (fui)',
      'tener (tuve)',
      'hacer (hice)',
      'poder (pude)',
      'querer (quise)',
      'saber (supe)',
      'venir (vine)',
      'dar (di)',
      'ver (vi)',
      'decir (dije)',
    ],
    includesContrast: false,
  },
  {
    week: 4,
    topic: 'Preterite',
    topicSpanish: TOPIC_SPANISH.Preterite,
    summary: 'Preterite — completed past actions, top irregular preterites',
    focusVerbs: [
      'ser/ir (fui)',
      'tener (tuve)',
      'hacer (hice)',
      'poder (pude)',
      'querer (quise)',
      'saber (supe)',
      'venir (vine)',
      'dar (di)',
      'ver (vi)',
      'decir (dije)',
    ],
    includesContrast: false,
  },
  {
    week: 5,
    topic: 'Imperfect',
    topicSpanish: TOPIC_SPANISH.Imperfect,
    summary: 'Imperfect — past descriptions and habits',
    focusVerbs: ['ser (era)', 'ir (iba)', 'ver (veía)'],
    includesContrast: false,
  },
  {
    week: 6,
    topic: 'Imperfect',
    topicSpanish: TOPIC_SPANISH.Imperfect,
    summary: 'Imperfect — past descriptions and habits',
    focusVerbs: ['ser (era)', 'ir (iba)', 'ver (veía)'],
    includesContrast: false,
  },
  {
    week: 7,
    topic: 'Preterite vs Imperfect',
    topicSpanish: TOPIC_SPANISH['Preterite vs Imperfect'],
    summary: 'Preterite vs Imperfect — contrast and choice',
    focusVerbs: ['ser/ir', 'tener', 'hacer', 'ver', 'estar'],
    includesContrast: true,
  },
  {
    week: 8,
    topic: 'Preterite vs Imperfect',
    topicSpanish: TOPIC_SPANISH['Preterite vs Imperfect'],
    summary: 'Preterite vs Imperfect — contrast and choice',
    focusVerbs: ['ser/ir', 'tener', 'hacer', 'ver', 'estar'],
    includesContrast: true,
  },
  {
    week: 9,
    topic: 'Future tense',
    topicSpanish: TOPIC_SPANISH['Future tense'],
    summary: 'Future tense — will and going to',
    focusVerbs: [
      'tener',
      'poder',
      'querer',
      'saber',
      'hacer',
      'decir',
      'salir',
      'venir',
      'poner',
      'valer',
    ],
    includesContrast: false,
  },
  {
    week: 10,
    topic: 'Future tense',
    topicSpanish: TOPIC_SPANISH['Future tense'],
    summary: 'Future tense — will and going to',
    focusVerbs: [
      'tener',
      'poder',
      'querer',
      'saber',
      'hacer',
      'decir',
      'salir',
      'venir',
      'poner',
      'valer',
    ],
    includesContrast: false,
  },
  {
    week: 11,
    topic: 'Conditional',
    topicSpanish: TOPIC_SPANISH.Conditional,
    summary: 'Conditional — would and hypotheticals',
    focusVerbs: [
      'tener',
      'poder',
      'querer',
      'saber',
      'hacer',
      'decir',
      'salir',
      'venir',
      'poner',
      'valer',
    ],
    includesContrast: false,
  },
  {
    week: 12,
    topic: 'Conditional',
    topicSpanish: TOPIC_SPANISH.Conditional,
    summary: 'Conditional — would and hypotheticals',
    focusVerbs: [
      'tener',
      'poder',
      'querer',
      'saber',
      'hacer',
      'decir',
      'salir',
      'venir',
      'poner',
      'valer',
    ],
    includesContrast: false,
  },
  {
    week: 13,
    topic: 'Present subjunctive',
    topicSpanish: TOPIC_SPANISH['Present subjunctive'],
    summary: 'Present subjunctive — wishes, doubts, emotions',
    focusVerbs: [
      'ser (sea)',
      'estar (esté)',
      'ir (vaya)',
      'tener (tenga)',
      'hacer (haga)',
      'poder (pueda)',
      'querer (quiera)',
      'saber (sepa)',
      'dar (dé)',
      'venir (venga)',
    ],
    includesContrast: false,
  },
  {
    week: 14,
    topic: 'Present subjunctive',
    topicSpanish: TOPIC_SPANISH['Present subjunctive'],
    summary: 'Present subjunctive — wishes, doubts, emotions',
    focusVerbs: [
      'ser (sea)',
      'estar (esté)',
      'ir (vaya)',
      'tener (tenga)',
      'hacer (haga)',
      'poder (pueda)',
      'querer (quiera)',
      'saber (sepa)',
      'dar (dé)',
      'venir (venga)',
    ],
    includesContrast: false,
  },
  {
    week: 15,
    topic: 'Ser vs Estar',
    topicSpanish: TOPIC_SPANISH['Ser vs Estar'],
    summary: 'Ser vs Estar — deep dive and edge cases',
    focusVerbs: ['ser', 'estar'],
    includesContrast: false,
  },
  {
    week: 16,
    topic: 'Ser vs Estar',
    topicSpanish: TOPIC_SPANISH['Ser vs Estar'],
    summary: 'Ser vs Estar — deep dive and edge cases',
    focusVerbs: ['ser', 'estar'],
    includesContrast: false,
  },
  {
    week: 17,
    topic: 'Por vs Para',
    topicSpanish: TOPIC_SPANISH['Por vs Para'],
    summary: 'Por vs Para — the classic confusion point',
    focusVerbs: ['ir', 'pasar', 'trabajar', 'dar', 'venir'],
    includesContrast: false,
  },
  {
    week: 18,
    topic: 'Por vs Para',
    topicSpanish: TOPIC_SPANISH['Por vs Para'],
    summary: 'Por vs Para — the classic confusion point',
    focusVerbs: ['ir', 'pasar', 'trabajar', 'dar', 'venir'],
    includesContrast: false,
  },
  {
    week: 19,
    topic: 'Reflexive verbs',
    topicSpanish: TOPIC_SPANISH['Reflexive verbs'],
    summary: 'Reflexive verbs — daily routine language',
    focusVerbs: [
      'levantarse',
      'ducharse',
      'vestirse',
      'acostarse',
      'despertarse',
      'llamarse',
      'sentirse',
      'quedarse',
    ],
    includesContrast: false,
  },
  {
    week: 20,
    topic: 'Reflexive verbs',
    topicSpanish: TOPIC_SPANISH['Reflexive verbs'],
    summary: 'Reflexive verbs — daily routine language',
    focusVerbs: [
      'levantarse',
      'ducharse',
      'vestirse',
      'acostarse',
      'despertarse',
      'llamarse',
      'sentirse',
      'quedarse',
    ],
    includesContrast: false,
  },
];

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  'Present tense',
  'Preterite',
  'Imperfect',
  'Preterite vs Imperfect',
  'Future tense',
  'Conditional',
  'Present subjunctive',
  'Ser vs Estar',
  'Por vs Para',
  'Reflexive verbs',
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function getWeekDefinition(week: number): GrammarWeekDefinition {
  const clamped = Math.max(1, Math.min(TOTAL_CURRICULUM_WEEKS, week));
  return GRAMMAR_WEEK_DEFINITIONS[clamped - 1];
}

function stateFromWeek(week: number, weekStartDate: string, completedWeeks: number[]): GrammarCurriculumState {
  const def = getWeekDefinition(week);
  return {
    currentWeek: week,
    currentTopic: def.topic,
    weekStartDate,
    completedWeeks,
    currentFocusVerbs: def.focusVerbs,
  };
}

function normalizeStoredState(raw: unknown): GrammarCurriculumState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const currentWeek = typeof o.currentWeek === 'number' ? o.currentWeek : Number(o.currentWeek);
  const weekStartDate = typeof o.weekStartDate === 'string' ? o.weekStartDate : '';
  const completedWeeks = Array.isArray(o.completedWeeks)
    ? o.completedWeeks.map((w) => Number(w)).filter((w) => Number.isFinite(w) && w >= 1 && w <= TOTAL_CURRICULUM_WEEKS)
    : [];

  if (!Number.isFinite(currentWeek) || currentWeek < 1 || currentWeek > TOTAL_CURRICULUM_WEEKS || !weekStartDate) {
    return null;
  }

  return stateFromWeek(currentWeek, weekStartDate, completedWeeks);
}

async function saveGrammarCurriculum(state: GrammarCurriculumState): Promise<void> {
  await AsyncStorage.setItem(GRAMMAR_CURRICULUM_KEY, JSON.stringify(state));
}

export async function getGrammarCurriculum(): Promise<GrammarCurriculumState> {
  const raw = await AsyncStorage.getItem(GRAMMAR_CURRICULUM_KEY);
  if (!raw) {
    const initial = stateFromWeek(1, formatLocalDate(), []);
    await saveGrammarCurriculum(initial);
    return initial;
  }

  try {
    const parsed = normalizeStoredState(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    // fall through to reset
  }

  const initial = stateFromWeek(1, formatLocalDate(), []);
  await saveGrammarCurriculum(initial);
  return initial;
}

/** Advance week after 7 days; never skip — always sequential. */
export async function resolveGrammarCurriculum(
  today: string = formatLocalDate(),
): Promise<GrammarCurriculumState> {
  let state = await getGrammarCurriculum();

  if (state.currentWeek >= TOTAL_CURRICULUM_WEEKS) {
    return state;
  }

  if (daysBetween(state.weekStartDate, today) < 7) {
    return state;
  }

  const completed = state.completedWeeks.includes(state.currentWeek)
    ? state.completedWeeks
    : [...state.completedWeeks, state.currentWeek];

  const nextWeek = Math.min(TOTAL_CURRICULUM_WEEKS, state.currentWeek + 1);
  state = stateFromWeek(nextWeek, today, completed);
  await saveGrammarCurriculum(state);
  return state;
}

export async function resetGrammarCurriculum(): Promise<GrammarCurriculumState> {
  const initial = stateFromWeek(1, formatLocalDate(), []);
  await saveGrammarCurriculum(initial);
  return initial;
}

export function daysRemainingInWeek(state: GrammarCurriculumState, today: string = formatLocalDate()): number {
  const elapsed = daysBetween(state.weekStartDate, today);
  return Math.max(0, 7 - elapsed);
}

export function curriculumProgressPercent(state: GrammarCurriculumState): number {
  const completedCount = new Set([
    ...state.completedWeeks,
    ...(state.currentWeek > 1 ? [] : []),
  ]).size;
  const throughCurrent = Math.max(completedCount, state.currentWeek - 1);
  return Math.round((throughCurrent / TOTAL_CURRICULUM_WEEKS) * 100);
}

export function isWeekCompleted(state: GrammarCurriculumState, week: number): boolean {
  return state.completedWeeks.includes(week) || week < state.currentWeek;
}

export function isWeekLocked(state: GrammarCurriculumState, week: number): boolean {
  return week > state.currentWeek;
}

export function weekLabel(def: GrammarWeekDefinition): string {
  return `Week ${def.week}: ${def.topic}`;
}

export async function getCurrentGrammarTopic(): Promise<GrammarTopic | null> {
  const state = await resolveGrammarCurriculum();
  return state.currentTopic;
}

export function grammarCurriculumProgress(state: GrammarCurriculumState): {
  completedWeeks: number[];
  currentWeek: number;
  progress: number;
} {
  return {
    completedWeeks: state.completedWeeks,
    currentWeek: state.currentWeek,
    progress: Math.round((state.currentWeek / TOTAL_CURRICULUM_WEEKS) * 100),
  };
}
