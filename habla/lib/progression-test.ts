import AsyncStorage from '@react-native-async-storage/async-storage';

import { getErrorDNA, type ErrorDNAItem } from '@/lib/error-dna';
import {
  daysRemainingInWeek,
  getGrammarCurriculum,
  getWeekDefinition,
  TOTAL_CURRICULUM_WEEKS,
  type GrammarTopic,
  type GrammarWeekDefinition,
} from '@/lib/grammar-curriculum';
import { queueMissedQuizItemsForDrills } from '@/lib/milestone-celebration-quiz';
import { getLessonHistory, type LessonHistoryEntry } from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export const PROGRESSION_TESTS_KEY = 'progressionTests';
export const LESSONS_COMPLETED_SINCE_TEST_KEY = 'lessonsCompletedSinceTest';

export const PROGRESSION_PASS_SCORE = 7;
export const PROGRESSION_BORDERLINE_SCORE = 6;
export const PROGRESSION_QUESTION_COUNT = 10;
export const PROGRESSION_RETAKE_LESSONS = 3;
export const PROGRESSION_PASS_GEMS = 10;

export type ProgressionQuestionType =
  | 'conjugation'
  | 'fill_blank'
  | 'correct_mistake'
  | 'sentence_stem'
  | 'translation';

export type ProgressionTestQuestion = {
  id: string;
  type: ProgressionQuestionType;
  prompt: string;
  instruction: string;
  expectedAnswer: string;
  acceptableAnswers: string[];
  explanation: string;
};

export type ProgressionTestAttempt = {
  topic: string;
  date: string;
  score: number;
  passed: boolean;
  attempt: number;
  questionsWrong: string[];
  gemsEarned: number;
};

export type ProgressionTopicRecord = {
  completed: boolean;
  passed: boolean;
  attempts: number;
  bestScore: number;
  bypassed: boolean;
  history: ProgressionTestAttempt[];
};

export type ProgressionBlock = {
  key: string;
  displayName: string;
  startWeek: number;
  endWeek: number;
  topic: GrammarTopic;
};

export const PROGRESSION_BLOCKS: ProgressionBlock[] = [
  { key: 'present_tense', displayName: 'Present Tense', startWeek: 1, endWeek: 2, topic: 'Present tense' },
  { key: 'preterite', displayName: 'Preterite', startWeek: 3, endWeek: 4, topic: 'Preterite' },
  { key: 'imperfect', displayName: 'Imperfect', startWeek: 5, endWeek: 6, topic: 'Imperfect' },
  {
    key: 'preterite_vs_imperfect',
    displayName: 'Preterite vs Imperfect',
    startWeek: 7,
    endWeek: 8,
    topic: 'Preterite vs Imperfect',
  },
  { key: 'future_tense', displayName: 'Future Tense', startWeek: 9, endWeek: 10, topic: 'Future tense' },
  { key: 'conditional', displayName: 'Conditional', startWeek: 11, endWeek: 12, topic: 'Conditional' },
  {
    key: 'present_subjunctive',
    displayName: 'Present Subjunctive',
    startWeek: 13,
    endWeek: 14,
    topic: 'Present subjunctive',
  },
  { key: 'ser_vs_estar', displayName: 'Ser vs Estar', startWeek: 15, endWeek: 16, topic: 'Ser vs Estar' },
  { key: 'por_vs_para', displayName: 'Por vs Para', startWeek: 17, endWeek: 18, topic: 'Por vs Para' },
  { key: 'reflexive_verbs', displayName: 'Reflexive Verbs', startWeek: 19, endWeek: 20, topic: 'Reflexive verbs' },
  {
    key: 'present_participle',
    displayName: 'Present Participle',
    startWeek: 21,
    endWeek: 22,
    topic: 'Present participle (gerund)',
  },
  { key: 'past_participle', displayName: 'Past Participle', startWeek: 23, endWeek: 24, topic: 'Past participle' },
  { key: 'perfect_tenses', displayName: 'Perfect Tenses', startWeek: 25, endWeek: 26, topic: 'Perfect tenses' },
  {
    key: 'prepositions',
    displayName: 'Prepositions',
    startWeek: 27,
    endWeek: 28,
    topic: 'Compound prepositions',
  },
  { key: 'imperative', displayName: 'Imperative', startWeek: 29, endWeek: 30, topic: 'Imperative mood' },
];

export type ProgressionHomeCard =
  | {
      kind: 'ready';
      block: ProgressionBlock;
      attempts: number;
    }
  | {
      kind: 'retake_wait';
      block: ProgressionBlock;
      lessonsRemaining: number;
    };

export type ProgressionGroupStatus =
  | { kind: 'passed'; score: number }
  | { kind: 'ready' }
  | { kind: 'retake_wait'; lessonsRemaining: number }
  | { kind: 'not_reached' }
  | { kind: 'bypassed' };

function emptyRecord(): ProgressionTopicRecord {
  return {
    completed: false,
    passed: false,
    attempts: 0,
    bestScore: 0,
    bypassed: false,
    history: [],
  };
}

function normalizeRecord(raw: unknown): ProgressionTopicRecord {
  const base = emptyRecord();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? o.history
        .map((item) => normalizeAttempt(item))
        .filter((item): item is ProgressionTestAttempt => item != null)
    : [];
  return {
    completed: o.completed === true,
    passed: o.passed === true,
    attempts: Math.max(0, Math.trunc(Number(o.attempts) || history.length || 0)),
    bestScore: Math.max(0, Math.min(10, Math.trunc(Number(o.bestScore) || 0))),
    bypassed: o.bypassed === true,
    history,
  };
}

function normalizeAttempt(raw: unknown): ProgressionTestAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const topic = typeof o.topic === 'string' ? o.topic : '';
  if (!topic) return null;
  return {
    topic,
    date: typeof o.date === 'string' ? o.date : formatLocalDate(),
    score: Math.max(0, Math.min(10, Math.trunc(Number(o.score) || 0))),
    passed: o.passed === true,
    attempt: Math.max(1, Math.trunc(Number(o.attempt) || 1)),
    questionsWrong: Array.isArray(o.questionsWrong)
      ? o.questionsWrong.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      : [],
    gemsEarned: Math.max(0, Math.trunc(Number(o.gemsEarned) || 0)),
  };
}

export function getProgressionBlockForWeek(week: number): ProgressionBlock | null {
  return PROGRESSION_BLOCKS.find((b) => week >= b.startWeek && week <= b.endWeek) ?? null;
}

export function getProgressionBlockByKey(key: string): ProgressionBlock | null {
  return PROGRESSION_BLOCKS.find((b) => b.key === key) ?? null;
}

export function isTopicEndWeek(week: number): boolean {
  return PROGRESSION_BLOCKS.some((b) => b.endWeek === week);
}

export async function loadProgressionTests(): Promise<Record<string, ProgressionTopicRecord>> {
  const raw = await AsyncStorage.getItem(PROGRESSION_TESTS_KEY);
  const parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const obj = JSON.parse(raw) as unknown;
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.assign(parsed, obj as Record<string, unknown>);
      }
    } catch {
      // keep empty
    }
  }

  const result: Record<string, ProgressionTopicRecord> = {};
  for (const block of PROGRESSION_BLOCKS) {
    result[block.key] = normalizeRecord(parsed[block.key]);
  }
  return result;
}

async function saveProgressionTests(tests: Record<string, ProgressionTopicRecord>): Promise<void> {
  await AsyncStorage.setItem(PROGRESSION_TESTS_KEY, JSON.stringify(tests));
}

export type LessonsSinceTestState = {
  topic: string;
  count: number;
};

async function loadLessonsSinceTest(): Promise<LessonsSinceTestState> {
  const raw = await AsyncStorage.getItem(LESSONS_COMPLETED_SINCE_TEST_KEY);
  if (!raw) return { topic: '', count: 0 };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'number') {
      return { topic: '', count: Math.max(0, Math.trunc(parsed)) };
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      return {
        topic: typeof o.topic === 'string' ? o.topic : '',
        count: Math.max(0, Math.trunc(Number(o.count) || 0)),
      };
    }
  } catch {
    const n = Number(raw);
    if (Number.isFinite(n)) return { topic: '', count: Math.max(0, Math.trunc(n)) };
  }
  return { topic: '', count: 0 };
}

async function saveLessonsSinceTest(state: LessonsSinceTestState): Promise<void> {
  await AsyncStorage.setItem(LESSONS_COMPLETED_SINCE_TEST_KEY, JSON.stringify(state));
}

/**
 * Marks tests for already-passed topic weeks as bypassed.
 * Reads currentWeek only — never writes grammarCurriculum.
 */
export async function syncProgressionTestBypass(currentWeek: number): Promise<Record<string, ProgressionTopicRecord>> {
  const week = Math.max(1, Math.min(TOTAL_CURRICULUM_WEEKS, Math.trunc(currentWeek) || 1));
  const tests = await loadProgressionTests();
  let changed = false;

  for (const block of PROGRESSION_BLOCKS) {
    const entry = tests[block.key] ?? emptyRecord();
    if (week > block.endWeek && !entry.passed && !entry.bypassed) {
      tests[block.key] = { ...entry, bypassed: true, completed: true };
      changed = true;
    } else if (!tests[block.key]) {
      tests[block.key] = entry;
      changed = true;
    }
  }

  const existingRaw = await AsyncStorage.getItem(PROGRESSION_TESTS_KEY);
  if (!existingRaw || changed) {
    await saveProgressionTests(tests);
  }
  return tests;
}

export async function isProgressionTestBlockingAdvance(currentWeek: number): Promise<boolean> {
  if (!isTopicEndWeek(currentWeek)) return false;
  const block = getProgressionBlockForWeek(currentWeek);
  if (!block) return false;
  const tests = await syncProgressionTestBypass(currentWeek);
  const entry = tests[block.key];
  if (!entry) return true;
  if (entry.passed || entry.bypassed) return false;
  return true;
}

export async function getProgressionHomeCard(): Promise<ProgressionHomeCard | null> {
  const curriculum = await getGrammarCurriculum();
  const block = getProgressionBlockForWeek(curriculum.currentWeek);
  if (!block || block.endWeek !== curriculum.currentWeek) return null;

  const tests = await syncProgressionTestBypass(curriculum.currentWeek);
  const entry = tests[block.key] ?? emptyRecord();
  if (entry.passed || entry.bypassed) return null;

  const weekElapsed = daysRemainingInWeek(curriculum) <= 0;
  if (!weekElapsed && entry.attempts === 0) return null;

  if (entry.attempts === 0) {
    return { kind: 'ready', block, attempts: 0 };
  }

  const since = await loadLessonsSinceTest();
  const count = since.topic === block.key ? since.count : 0;
  if (count >= PROGRESSION_RETAKE_LESSONS) {
    return { kind: 'ready', block, attempts: entry.attempts };
  }
  return {
    kind: 'retake_wait',
    block,
    lessonsRemaining: Math.max(1, PROGRESSION_RETAKE_LESSONS - count),
  };
}

export async function noteGrammarLessonForProgressionRetake(): Promise<void> {
  const curriculum = await getGrammarCurriculum();
  const block = getProgressionBlockForWeek(curriculum.currentWeek);
  if (!block || block.endWeek !== curriculum.currentWeek) return;

  const tests = await loadProgressionTests();
  const entry = tests[block.key];
  if (!entry || entry.passed || entry.bypassed || entry.attempts <= 0) return;

  const since = await loadLessonsSinceTest();
  const count = since.topic === block.key ? since.count + 1 : 1;
  await saveLessonsSinceTest({ topic: block.key, count });
}

export function questionTypeInstruction(type: ProgressionQuestionType): string {
  switch (type) {
    case 'conjugation':
      return 'Conjugación';
    case 'fill_blank':
      return 'Completa el espacio';
    case 'correct_mistake':
      return 'Corrige el error';
    case 'sentence_stem':
      return 'Continúa la frase';
    case 'translation':
      return 'Traducción';
  }
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeProgressionAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"'()]/g, '')
    .replace(/\s+/g, ' ');
}

export function checkProgressionAnswer(question: ProgressionTestQuestion, userAnswer: string): boolean {
  const normalized = normalizeProgressionAnswer(userAnswer);
  if (!normalized) return false;
  const candidates = [question.expectedAnswer, ...question.acceptableAnswers]
    .map((a) => normalizeProgressionAnswer(a))
    .filter(Boolean);
  if (candidates.includes(normalized)) return true;
  const folded = stripDiacritics(normalized);
  return candidates.some((c) => stripDiacritics(c) === folded);
}

export async function gatherProgressionTestContext(block: ProgressionBlock): Promise<{
  block: ProgressionBlock;
  weekDef: GrammarWeekDefinition;
  errorDna: ErrorDNAItem[];
  commonMistakes: string[];
}> {
  const [errors, history] = await Promise.all([getErrorDNA(), getLessonHistory()]);
  const weekDef = getWeekDefinition(block.endWeek);
  const haystack = `${block.topic} ${block.displayName}`.toLowerCase();
  const topicErrors = errors.filter((e) => {
    const text = `${e.error} ${e.example} ${e.correction}`.toLowerCase();
    return haystack.split(/\s+/).some((w) => w.length > 3 && text.includes(w));
  });
  const commonMistakes = collectCommonMistakes(history, block.topic);
  return {
    block,
    weekDef,
    errorDna: (topicErrors.length ? topicErrors : errors.filter((e) => e.category === 'grammar')).slice(0, 8),
    commonMistakes,
  };
}

function collectCommonMistakes(history: LessonHistoryEntry[], topic: GrammarTopic): string[] {
  const needle = topic.toLowerCase();
  const labels: string[] = [];
  for (const lesson of history) {
    const related =
      lesson.lessonType.toLowerCase().includes('grammar') ||
      lesson.breakdown.grammar.topic.toLowerCase().includes(needle);
    if (!related) continue;
    for (const area of [...lesson.weakAreas, ...lesson.focusAreas, ...(lesson.breakdown.grammar.workOn ?? [])]) {
      const t = area.trim();
      if (t && !labels.includes(t)) labels.push(t);
      if (labels.length >= 8) return labels;
    }
  }
  return labels;
}

export function buildFallbackProgressionQuestions(block: ProgressionBlock): ProgressionTestQuestion[] {
  const def = getWeekDefinition(block.endWeek);
  const verbs = def.focusVerbs.length ? def.focusVerbs : ['ser', 'estar', 'tener'];
  const v0 = verbs[0]?.split(' ')[0] ?? 'tener';
  const v1 = verbs[1]?.split(' ')[0] ?? 'estar';
  const v2 = verbs[2]?.split(' ')[0] ?? 'hacer';

  const byTopic: Partial<Record<GrammarTopic, ProgressionTestQuestion[]>> = {
    'Present tense': [
      q('c1', 'conjugation', `Conjuga "${v0}" en presente, yo.`, 'tengo', ['yo tengo'], 'Yo tengo.'),
      q('c2', 'conjugation', `Conjuga "ir" en presente, nosotros.`, 'vamos', ['nosotros vamos'], 'Nosotros vamos.'),
      q('c3', 'conjugation', `Conjuga "ser" en presente, ella.`, 'es', ['ella es'], 'Ella es.'),
      q('f1', 'fill_blank', 'Completa: Yo ___ (estar) en casa.', 'estoy', ['yo estoy'], 'Estoy.'),
      q('f2', 'fill_blank', 'Completa: Ellos ___ (tener) hambre.', 'tienen', ['ellos tienen'], 'Tienen.'),
      q('m1', 'correct_mistake', 'Corrige: Yo tiene 20 años.', 'Yo tengo 20 años.', ['Tengo 20 años', 'yo tengo veinte años'], 'Tengo, no tiene.'),
      q('m2', 'correct_mistake', 'Corrige: Nosotros va al mercado.', 'Nosotros vamos al mercado.', ['Vamos al mercado'], 'Vamos, no va.'),
      q('s1', 'sentence_stem', 'Continúa: Todos los días yo…', 'Todos los días yo voy al trabajo.', ['Voy al trabajo', 'Como con mi familia'], 'Usa el presente.'),
      q('s2', 'sentence_stem', 'Continúa: Ahora mismo nosotros…', 'Ahora mismo nosotros estamos en casa.', ['Estamos en casa'], 'Usa el presente.'),
      q('t1', 'translation', 'Traduce: I want coffee.', 'Quiero café.', ['Yo quiero café', 'Quiero un café'], 'Querer → quiero.'),
    ],
    Preterite: [
      q('c1', 'conjugation', `Conjuga "${v0}" en pretérito, yo.`, 'fui', ['yo fui'], 'Ser/ir: fui.'),
      q('c2', 'conjugation', 'Conjuga "hacer" en pretérito, ella.', 'hizo', ['ella hizo'], 'Hacer → hizo.'),
      q('c3', 'conjugation', 'Conjuga "tener" en pretérito, nosotros.', 'tuvimos', ['nosotros tuvimos'], 'Tener → tuvimos.'),
      q('f1', 'fill_blank', 'Completa: Ayer yo ___ (ir) al mercado.', 'fui', ['yo fui'], 'Ir pretérito: fui.'),
      q('f2', 'fill_blank', 'Completa: El año pasado ellos ___ (hacer) un viaje.', 'hicieron', ['ellos hicieron'], 'Hacer → hicieron.'),
      q('m1', 'correct_mistake', 'Corrige: Ayer yo iba al médico y ya está.', 'Ayer yo fui al médico.', ['Fui al médico'], 'Acción completada: pretérito.'),
      q('m2', 'correct_mistake', 'Corrige: Ella hace la cena anoche.', 'Ella hizo la cena anoche.', ['Hizo la cena anoche'], 'Anoche → pretérito.'),
      q('s1', 'sentence_stem', 'Continúa: El sábado pasado yo…', 'El sábado pasado yo fui al cine.', ['Fui al cine', 'Comí con amigos'], 'Usa el pretérito.'),
      q('s2', 'sentence_stem', 'Continúa: De repente ella…', 'De repente ella vio la verdad.', ['Vio algo', 'Salió corriendo'], 'Usa el pretérito.'),
      q('t1', 'translation', 'Traduce: I had a problem yesterday.', 'Tuve un problema ayer.', ['Ayer tuve un problema'], 'Tener pretérito: tuve.'),
    ],
  };

  const specific = byTopic[block.topic];
  if (specific?.length === PROGRESSION_QUESTION_COUNT) return specific;

  return [
    q('c1', 'conjugation', `Conjuga una forma de "${v0}" para yo, tema: ${block.displayName}.`, v0, [v0], `Usa ${block.displayName}.`),
    q('c2', 'conjugation', `Conjuga "${v1}" para nosotros.`, v1, [v1], `Practica ${block.displayName}.`),
    q('c3', 'conjugation', `Conjuga "${v2}" para ella.`, v2, [v2], `Practica ${block.displayName}.`),
    q('f1', 'fill_blank', `Completa con ${block.displayName}: Yo ___ (${v0}).`, v0, [v0], 'Completa el espacio.'),
    q('f2', 'fill_blank', `Completa: Nosotros ___ (${v1}).`, v1, [v1], 'Completa el espacio.'),
    q('m1', 'correct_mistake', `Corrige esta frase sobre ${block.displayName}: Yo no usar bien el verbo.`, `Yo uso ${v0} bien.`, [`Uso ${v0}`], 'Corrige el verbo.'),
    q('m2', 'correct_mistake', `Corrige: Ellos no ${v2} ayer bien.`, `Ellos ${v2} bien ayer.`, [v2], 'Corrige la forma.'),
    q('s1', 'sentence_stem', `Continúa usando ${block.displayName}: Yo…`, `Yo practico ${v0}.`, [`Yo ${v0}`], 'Escribe una frase corta.'),
    q('s2', 'sentence_stem', `Continúa: En casa nosotros…`, `En casa nosotros ${v1}.`, [`Nosotros ${v1}`], 'Escribe una frase corta.'),
    q('t1', 'translation', `Traduce al español (usa ${block.displayName}): I practise this grammar.`, 'Practico esta gramática.', ['Yo practico esta gramática'], 'Frase corta en español.'),
  ];
}

function q(
  id: string,
  type: ProgressionQuestionType,
  prompt: string,
  expectedAnswer: string,
  acceptableAnswers: string[],
  explanation: string,
): ProgressionTestQuestion {
  return {
    id,
    type,
    prompt,
    instruction: questionTypeInstruction(type),
    expectedAnswer,
    acceptableAnswers,
    explanation,
  };
}

export function mergeProgressionQuestions(
  generated: ProgressionTestQuestion[],
  fallback: ProgressionTestQuestion[],
): ProgressionTestQuestion[] {
  const merged: ProgressionTestQuestion[] = [];
  for (const item of [...generated, ...fallback]) {
    if (merged.length >= PROGRESSION_QUESTION_COUNT) break;
    if (!item.prompt.trim() || !item.expectedAnswer.trim()) continue;
    if (merged.some((m) => m.prompt === item.prompt)) continue;
    merged.push({
      ...item,
      id: String(merged.length + 1),
      instruction: item.instruction || questionTypeInstruction(item.type),
      acceptableAnswers: item.acceptableAnswers ?? [],
    });
  }
  return merged.slice(0, PROGRESSION_QUESTION_COUNT);
}

export async function recordProgressionTestResult(params: {
  block: ProgressionBlock;
  score: number;
  questionsWrong: string[];
  gemsEarned: number;
  passed: boolean;
  completed: boolean;
}): Promise<ProgressionTopicRecord> {
  const tests = await loadProgressionTests();
  const prev = tests[params.block.key] ?? emptyRecord();
  const attemptNumber = prev.attempts + 1;
  const attempt: ProgressionTestAttempt = {
    topic: params.block.key,
    date: formatLocalDate(),
    score: params.score,
    passed: params.passed,
    attempt: attemptNumber,
    questionsWrong: params.questionsWrong,
    gemsEarned: params.gemsEarned,
  };
  const next: ProgressionTopicRecord = {
    completed: params.completed || prev.completed,
    passed: params.passed || prev.passed,
    attempts: attemptNumber,
    bestScore: Math.max(prev.bestScore, params.score),
    bypassed: prev.bypassed,
    history: [...prev.history, attempt].slice(-20),
  };
  tests[params.block.key] = next;
  await saveProgressionTests(tests);

  if (!params.passed) {
    await saveLessonsSinceTest({ topic: params.block.key, count: 0 });
  }

  if (params.questionsWrong.length) {
    await queueMissedQuizItemsForDrills(
      params.questionsWrong.map((prompt) => ({
        drillTag: params.block.displayName,
        explanation: prompt,
      })),
    );
  }

  return next;
}

export async function getProgressionStatusForBlock(
  block: ProgressionBlock,
  currentWeek: number,
): Promise<ProgressionGroupStatus> {
  const tests = await loadProgressionTests();
  const entry = tests[block.key] ?? emptyRecord();
  const since = await loadLessonsSinceTest();

  if (entry.passed) return { kind: 'passed', score: entry.bestScore };
  if (entry.bypassed) return { kind: 'bypassed' };
  if (currentWeek < block.startWeek) return { kind: 'not_reached' };

  if (currentWeek > block.endWeek) return { kind: 'bypassed' };

  if (currentWeek === block.endWeek) {
    const curriculum = await getGrammarCurriculum();
    const weekElapsed = daysRemainingInWeek(curriculum) <= 0;
    if (entry.attempts === 0) {
      return weekElapsed ? { kind: 'ready' } : { kind: 'not_reached' };
    }
    const count = since.topic === block.key ? since.count : 0;
    if (count >= PROGRESSION_RETAKE_LESSONS) return { kind: 'ready' };
    return {
      kind: 'retake_wait',
      lessonsRemaining: Math.max(1, PROGRESSION_RETAKE_LESSONS - count),
    };
  }

  return { kind: 'not_reached' };
}

export function blocksForCurriculumGroup(weeks: number[]): ProgressionBlock[] {
  return PROGRESSION_BLOCKS.filter((b) => weeks.includes(b.endWeek));
}

export function pickGroupProgressionStatus(
  statuses: ProgressionGroupStatus[],
): ProgressionGroupStatus {
  const ready = statuses.find((s) => s.kind === 'ready');
  if (ready) return ready;
  const wait = statuses.find((s) => s.kind === 'retake_wait');
  if (wait) return wait;
  const passed = statuses.filter((s) => s.kind === 'passed');
  if (passed.length === statuses.length && passed.length > 0) {
    const score = Math.max(...passed.map((s) => (s.kind === 'passed' ? s.score : 0)));
    return { kind: 'passed', score };
  }
  if (statuses.every((s) => s.kind === 'bypassed' || s.kind === 'passed')) {
    const score = Math.max(
      0,
      ...statuses.map((s) => (s.kind === 'passed' ? s.score : 0)),
    );
    return score > 0 ? { kind: 'passed', score } : { kind: 'bypassed' };
  }
  return { kind: 'not_reached' };
}

export function formatProgressionStatusLine(status: ProgressionGroupStatus): string {
  switch (status.kind) {
    case 'passed':
      return `✅ Passed — ${status.score}/10`;
    case 'ready':
      return '⏳ Ready to take';
    case 'retake_wait':
      return `📝 ${status.lessonsRemaining} more lesson${status.lessonsRemaining === 1 ? '' : 's'} needed to retake`;
    case 'bypassed':
      return '✅ Passed';
    case 'not_reached':
      return '🔒 Not yet reached';
  }
}

export async function markProgressionOverrideAdvance(topicKey: string): Promise<void> {
  const tests = await loadProgressionTests();
  const entry = tests[topicKey];
  if (!entry) return;
  tests[topicKey] = { ...entry, completed: true };
  await saveProgressionTests(tests);
}

export async function resetProgressionTestStorage(): Promise<void> {
  await AsyncStorage.removeItem(PROGRESSION_TESTS_KEY);
  await AsyncStorage.removeItem(LESSONS_COMPLETED_SINCE_TEST_KEY);
}

export function fallbackRetakeTip(errors: ErrorDNAItem[], block: ProgressionBlock): string {
  const top = errors[0];
  if (top?.error) {
    return `Fíjate sobre todo en: ${top.error}. Ejemplo: "${top.example}" → "${top.correction}".`;
  }
  return `Sigue practicando ${block.displayName.toLowerCase()} con frases cortas de tu día.`;
}
