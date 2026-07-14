import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatLocalDate } from '@/lib/streak';

export const GRAMMAR_CURRICULUM_KEY = 'grammarCurriculum';
/** Extending this only appends weeks — never rewrite stored currentWeek for learners already mid-curriculum. */
export const TOTAL_CURRICULUM_WEEKS = 30;

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
  | 'Reflexive verbs'
  | 'Present participle (gerund)'
  | 'Past participle'
  | 'Perfect tenses'
  | 'Core prepositions'
  | 'Compound prepositions'
  | 'Verbs with prepositions'
  | 'Imperative mood';

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
  'Present participle (gerund)': 'el gerundio',
  'Past participle': 'el participio pasado',
  'Perfect tenses': 'los tiempos compuestos',
  'Core prepositions': 'las preposiciones básicas',
  'Compound prepositions': 'las preposiciones compuestas',
  'Verbs with prepositions': 'verbos con preposición',
  'Imperative mood': 'el imperativo',
};

/** Full 30-week progressive grammar curriculum (paired weeks share a topic). */
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
  {
    week: 21,
    topic: 'Present participle (gerund)',
    topicSpanish: TOPIC_SPANISH['Present participle (gerund)'],
    summary: 'Present participle (gerund) — -ando/-iendo, progressives, seguir/continuar/llevar',
    focusVerbs: [
      'hablar (hablando)',
      'comer (comiendo)',
      'escribir (escribiendo)',
      'ir (yendo)',
      'leer (leyendo)',
      'poder (pudiendo)',
      'venir (viniendo)',
      'decir (diciendo)',
      'hirviendo',
      'lloviendo',
    ],
    includesContrast: false,
  },
  {
    week: 22,
    topic: 'Present participle (gerund)',
    topicSpanish: TOPIC_SPANISH['Present participle (gerund)'],
    summary: 'Present participle (gerund) — -ando/-iendo, progressives, seguir/continuar/llevar',
    focusVerbs: [
      'hablar (hablando)',
      'comer (comiendo)',
      'escribir (escribiendo)',
      'ir (yendo)',
      'leer (leyendo)',
      'poder (pudiendo)',
      'venir (viniendo)',
      'decir (diciendo)',
      'hirviendo',
      'lloviendo',
    ],
    includesContrast: false,
  },
  {
    week: 23,
    topic: 'Past participle',
    topicSpanish: TOPIC_SPANISH['Past participle'],
    summary: 'Past participle — -ado/-ido, irregulars, perfects, adjectives, passive',
    focusVerbs: [
      'hacer (hecho)',
      'ver (visto)',
      'escribir (escrito)',
      'abrir (abierto)',
      'decir (dicho)',
      'poner (puesto)',
      'volver (vuelto)',
      'romper (roto)',
      'morir (muerto)',
      'ir (ido)',
    ],
    includesContrast: false,
  },
  {
    week: 24,
    topic: 'Past participle',
    topicSpanish: TOPIC_SPANISH['Past participle'],
    summary: 'Past participle — -ado/-ido, irregulars, perfects, adjectives, passive',
    focusVerbs: [
      'hacer (hecho)',
      'ver (visto)',
      'escribir (escrito)',
      'abrir (abierto)',
      'decir (dicho)',
      'poner (puesto)',
      'volver (vuelto)',
      'romper (roto)',
      'morir (muerto)',
      'ir (ido)',
    ],
    includesContrast: false,
  },
  {
    week: 25,
    topic: 'Perfect tenses',
    topicSpanish: TOPIC_SPANISH['Perfect tenses'],
    summary: 'Perfect tenses — haber + past participle (present, past, future perfect)',
    focusVerbs: [
      'haber (he/había/habré)',
      'comer (comido)',
      'ver (visto)',
      'hablar (hablado)',
      'terminar (terminado)',
      'salir (salido)',
      'hacer (hecho)',
      'escribir (escrito)',
    ],
    includesContrast: true,
  },
  {
    week: 26,
    topic: 'Perfect tenses',
    topicSpanish: TOPIC_SPANISH['Perfect tenses'],
    summary: 'Perfect tenses — haber + past participle (present, past, future perfect)',
    focusVerbs: [
      'haber (he/había/habré)',
      'comer (comido)',
      'ver (visto)',
      'hablar (hablado)',
      'terminar (terminado)',
      'salir (salido)',
      'hacer (hecho)',
      'escribir (escrito)',
    ],
    includesContrast: true,
  },
  {
    week: 27,
    topic: 'Core prepositions',
    topicSpanish: TOPIC_SPANISH['Core prepositions'],
    summary: 'Core prepositions — a, en, de, con, sin, sobre, entre, hasta, desde',
    focusVerbs: ['ir a', 'estar en', 'ser de', 'llamar a', 'empezar a', 'escribir con'],
    includesContrast: false,
  },
  {
    week: 28,
    topic: 'Compound prepositions',
    topicSpanish: TOPIC_SPANISH['Compound prepositions'],
    summary: 'Compound prepositions — delante de, encima de, a pesar de, en vez de…',
    focusVerbs: [
      'antes de',
      'después de',
      'delante de',
      'detrás de',
      'cerca de',
      'lejos de',
      'en vez de',
      'a pesar de',
    ],
    includesContrast: false,
  },
  {
    week: 29,
    topic: 'Verbs with prepositions',
    topicSpanish: TOPIC_SPANISH['Verbs with prepositions'],
    summary: 'Verbs that change with prepositions — soñar con, pensar en, casarse con…',
    focusVerbs: [
      'soñar con',
      'pensar en',
      'pensar de',
      'casarse con',
      'depender de',
      'enamorarse de',
      'olvidarse de',
      'acordarse de',
      'quedar con',
      'tardar en',
    ],
    includesContrast: false,
  },
  {
    week: 30,
    topic: 'Imperative mood',
    topicSpanish: TOPIC_SPANISH['Imperative mood'],
    summary: 'Imperative mood — positive/negative commands and object pronouns',
    focusVerbs: [
      'hablar (habla/no hables)',
      'comer (come/no comas)',
      'escribir (escribe/no escribas)',
      'decir (di)',
      'hacer (haz)',
      'ir (ve/no vayas)',
      'poner (pon)',
      'salir (sal)',
      'ser (sé)',
      'venir (ven)',
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
  'Present participle (gerund)',
  'Past participle',
  'Perfect tenses',
  'Core prepositions',
  'Compound prepositions',
  'Verbs with prepositions',
  'Imperative mood',
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

/** Set curriculum to a specific starting week (marks prior weeks completed). */
export async function setGrammarCurriculumStartWeek(week: number): Promise<GrammarCurriculumState> {
  const clamped = Math.max(1, Math.min(TOTAL_CURRICULUM_WEEKS, Math.trunc(week)));
  const completedWeeks =
    clamped > 1 ? Array.from({ length: clamped - 1 }, (_, i) => i + 1) : [];
  const state = stateFromWeek(clamped, formatLocalDate(), completedWeeks);
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

export type GrammarTopicGroup = {
  id: string;
  name: string;
  weeks: number[];
};

export const GRAMMAR_TOPIC_GROUPS: GrammarTopicGroup[] = [
  { id: 'present', name: 'Present Tense', weeks: [1, 2] },
  { id: 'past', name: 'Past Tenses', weeks: [3, 4, 5, 6, 7, 8] },
  { id: 'future', name: 'Future and Conditional', weeks: [9, 10, 11, 12] },
  { id: 'subjunctive', name: 'Subjunctive', weeks: [13, 14] },
  { id: 'confusions', name: 'Common Confusions', weeks: [15, 16, 17, 18] },
  { id: 'reflexive', name: 'Reflexive Verbs', weeks: [19, 20] },
  { id: 'participles', name: 'Participles', weeks: [21, 22, 23, 24] },
  { id: 'perfect', name: 'Perfect Tenses', weeks: [25, 26] },
  { id: 'prepositions', name: 'Prepositions', weeks: [27, 28, 29] },
  { id: 'imperative', name: 'Imperative', weeks: [30] },
];

export function weekRangeLabel(weeks: number[]): string {
  if (weeks.length === 0) return '';
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  return `Weeks ${weeks[0]}-${weeks[weeks.length - 1]}`;
}

export function weekDisplayTitle(
  def: GrammarWeekDefinition,
  allWeeks: GrammarWeekDefinition[] = GRAMMAR_WEEK_DEFINITIONS,
): string {
  const hasEarlierSameTopic = allWeeks.some(
    (w) => w.topic === def.topic && w.week < def.week,
  );
  if (hasEarlierSameTopic) {
    return `Week ${def.week} — ${def.topic} continued`;
  }
  return `Week ${def.week} — ${def.topic}`;
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
