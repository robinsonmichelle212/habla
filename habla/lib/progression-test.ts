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
export const HAS_SEEN_PROGRESSION_ANIMATION_KEY = 'hasSeenProgressionAnimation';

export const PROGRESSION_PASS_SCORE = 7;
export const PROGRESSION_BORDERLINE_SCORE = 6;
export const PROGRESSION_QUESTION_COUNT = 5;
export const PROGRESSION_RETAKE_LESSONS = 3;
export const PROGRESSION_PASS_GEMS = 10;
export const PROGRESSION_TRY_GEMS = 2;
export const PROGRESSION_SPEAKING_SECONDS = 30;

export type ProgressionQuestionType =
  | 'conjugation'
  | 'correct_mistake'
  | 'sentence_stem'
  | 'translation'
  | 'word_order';

export const PROGRESSION_WRITTEN_TYPES: ProgressionQuestionType[] = [
  'conjugation',
  'correct_mistake',
  'sentence_stem',
  'translation',
  'word_order',
];

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
  writtenScore: number;
  speakingScore: number;
  passed: boolean;
  attempt: number;
  questionsWrong: string[];
  wrongQuestionNumbers: number[];
  javiFeedback: string;
  gemsEarned: number;
  advancedTo: string | null;
};

export type ProgressionWrittenScore = {
  question: number;
  score: number;
  correct: boolean;
  correctAnswer: string;
  feedback: string;
};

export type ProgressionEvaluation = {
  writtenScores: ProgressionWrittenScore[];
  speakingScore: number;
  speakingBonus: number;
  speakingFeedback: string;
  totalScore: number;
  passed: boolean;
  topicMastery: string;
  javiFeedback: string;
};

export type ProgressionSpeakingPrompt = {
  spanish: string;
  english: string;
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
    score: Math.max(0, Math.min(10, Math.trunc(Number(o.totalScore ?? o.score) || 0))),
    writtenScore: Math.max(0, Math.min(5, Math.trunc(Number(o.writtenScore) || 0))),
    speakingScore: Math.max(0, Math.min(5, Math.trunc(Number(o.speakingScore) || 0))),
    passed: o.passed === true,
    attempt: Math.max(1, Math.trunc(Number(o.attempt) || 1)),
    questionsWrong: Array.isArray(o.questionsWrong)
      ? o.questionsWrong.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      : [],
    wrongQuestionNumbers: Array.isArray(o.wrongQuestions)
      ? o.wrongQuestions
          .map((n) => Math.trunc(Number(n)))
          .filter((n) => n >= 1 && n <= 5)
      : Array.isArray(o.wrongQuestionNumbers)
        ? o.wrongQuestionNumbers
            .map((n) => Math.trunc(Number(n)))
            .filter((n) => n >= 1 && n <= 5)
        : [],
    javiFeedback: typeof o.javiFeedback === 'string' ? o.javiFeedback : '',
    gemsEarned: Math.max(0, Math.trunc(Number(o.gemsEarned) || 0)),
    advancedTo: typeof o.advancedTo === 'string' && o.advancedTo.trim() ? o.advancedTo : null,
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
    case 'correct_mistake':
      return 'Corrige el error';
    case 'sentence_stem':
      return 'Continúa la frase';
    case 'translation':
      return 'Traducción';
    case 'word_order':
      return 'Ordena las palabras';
  }
}

export function progressionTopicSpanishTitle(block: ProgressionBlock): string {
  const raw = getWeekDefinition(block.endWeek).topicSpanish.trim();
  const stripped = raw.replace(/^(el|la|los|las)\s+/i, '');
  return stripped
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (word.toLowerCase() === 'vs') return 'vs';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function nextProgressionBlock(block: ProgressionBlock): ProgressionBlock | null {
  const idx = PROGRESSION_BLOCKS.findIndex((b) => b.key === block.key);
  if (idx < 0) return null;
  return PROGRESSION_BLOCKS[idx + 1] ?? null;
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

  const byTopic: Partial<Record<GrammarTopic, ProgressionTestQuestion[]>> = {
    'Present tense': [
      q('1', 'conjugation', 'Conjuga "tener" en presente, yo.', 'tengo', ['yo tengo'], 'Yo tengo.'),
      q('2', 'correct_mistake', 'Corrige: Yo tiene 20 años.', 'Yo tengo 20 años.', ['Tengo 20 años'], 'Tengo, no tiene.'),
      q('3', 'sentence_stem', 'Continúa con dos finales posibles: Todos los días yo…', 'Todos los días yo voy al trabajo.', ['Voy al trabajo', 'Como con mi familia'], 'Usa el presente.'),
      q('4', 'translation', 'Traduce: I want coffee.', 'Quiero café.', ['Yo quiero café', 'Quiero un café'], 'Querer → quiero.'),
      q('5', 'word_order', 'Ordena: ahora / casa / en / estoy', 'Ahora estoy en casa.', ['Estoy en casa ahora'], 'Sujeto implícito + presente.'),
    ],
    Preterite: [
      q('1', 'conjugation', 'Conjuga "hacer" en pretérito, ella.', 'hizo', ['ella hizo'], 'Hacer → hizo.'),
      q('2', 'correct_mistake', 'Corrige: Ella hace la cena anoche.', 'Ella hizo la cena anoche.', ['Hizo la cena anoche'], 'Anoche → pretérito.'),
      q('3', 'sentence_stem', 'Continúa con dos finales: El sábado pasado yo…', 'El sábado pasado yo fui al cine.', ['Fui al cine', 'Comí con amigos'], 'Usa el pretérito.'),
      q('4', 'translation', 'Traduce: I had a problem yesterday.', 'Tuve un problema ayer.', ['Ayer tuve un problema'], 'Tener pretérito: tuve.'),
      q('5', 'word_order', 'Ordena: mercado / al / fui / ayer', 'Ayer fui al mercado.', ['Fui al mercado ayer'], 'Pretérito de ir: fui.'),
    ],
    Imperfect: [
      q('1', 'conjugation', 'Conjuga "ir" en imperfecto, nosotros.', 'íbamos', ['ibamos', 'nosotros íbamos'], 'Ir → íbamos.'),
      q('2', 'correct_mistake', 'Corrige: De niño yo fui al parque todos los días.', 'De niño yo iba al parque todos los días.', ['Iba al parque todos los días'], 'Hábito → imperfecto.'),
      q('3', 'sentence_stem', 'Continúa: Cuando era pequeño…', 'Cuando era pequeño jugaba en la calle.', ['Jugaba en la calle', 'Vivía con mis abuelos'], 'Usa el imperfecto.'),
      q('4', 'translation', 'Traduce: We used to live in Madrid.', 'Vivíamos en Madrid.', ['Nosotros vivíamos en Madrid'], 'Used to → imperfecto.'),
      q('5', 'word_order', 'Ordena: siempre / tarde / llegaba / ella', 'Ella siempre llegaba tarde.', ['Siempre llegaba tarde'], 'Imperfecto de costumbre.'),
    ],
  };

  const specific = byTopic[block.topic];
  if (specific?.length === PROGRESSION_QUESTION_COUNT) return specific;

  return [
    q('1', 'conjugation', `Conjuga "${v0}" (yo) usando ${block.displayName}.`, v0, [v0], `Usa ${block.displayName}.`),
    q('2', 'correct_mistake', `Corrige esta frase de ${block.displayName}: Yo no usar bien el verbo.`, `Yo uso ${v0} bien.`, [`Uso ${v0}`], 'Corrige el verbo.'),
    q('3', 'sentence_stem', `Continúa usando ${block.displayName}: Yo…`, `Yo practico ${v0}.`, [`Yo ${v0}`], 'Escribe una frase corta.'),
    q('4', 'translation', `Traduce al español (usa ${block.displayName}): I practise this grammar.`, 'Practico esta gramática.', ['Yo practico esta gramática'], 'Frase corta en español.'),
    q('5', 'word_order', `Ordena: yo / ${v1} / ahora / bien`, `Ahora yo ${v1} bien.`, [`Yo ${v1} bien ahora`], 'Ordena las palabras.'),
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
  const pool = [...generated, ...fallback];
  const picked: ProgressionTestQuestion[] = [];
  for (const type of PROGRESSION_WRITTEN_TYPES) {
    const item = pool.find(
      (q) => q.type === type && q.prompt.trim() && q.expectedAnswer.trim() && !picked.some((p) => p.prompt === q.prompt),
    );
    if (item) {
      picked.push({
        ...item,
        id: String(picked.length + 1),
        instruction: item.instruction || questionTypeInstruction(item.type),
        acceptableAnswers: item.acceptableAnswers ?? [],
      });
    }
  }
  if (picked.length < PROGRESSION_QUESTION_COUNT) {
    for (const item of pool) {
      if (picked.length >= PROGRESSION_QUESTION_COUNT) break;
      if (!item.prompt.trim() || !item.expectedAnswer.trim()) continue;
      if (picked.some((p) => p.prompt === item.prompt)) continue;
      picked.push({
        ...item,
        id: String(picked.length + 1),
        type: PROGRESSION_WRITTEN_TYPES[picked.length] ?? item.type,
        instruction: item.instruction || questionTypeInstruction(item.type),
        acceptableAnswers: item.acceptableAnswers ?? [],
      });
    }
  }
  return picked.slice(0, PROGRESSION_QUESTION_COUNT);
}

export function buildFallbackSpeakingPrompt(block: ProgressionBlock): ProgressionSpeakingPrompt {
  const title = progressionTopicSpanishTitle(block);
  const byTopic: Partial<Record<GrammarTopic, ProgressionSpeakingPrompt>> = {
    'Present tense': {
      spanish: 'Cuéntame tu día típico. Usa al menos 3 verbos en presente.',
      english: 'Tell me about your typical day. Use at least 3 verbs in the present tense.',
    },
    Preterite: {
      spanish: 'Cuéntame algo que hiciste la semana pasada. Usa al menos 3 verbos en pretérito.',
      english: 'Tell me something you did last week. Use at least 3 verbs in the preterite.',
    },
    Imperfect: {
      spanish: 'Cuéntame cómo era tu vida de niño. Usa al menos 3 verbos en imperfecto.',
      english: 'Tell me what your life was like as a child. Use at least 3 verbs in the imperfect.',
    },
    'Preterite vs Imperfect': {
      spanish: 'Cuéntame una historia breve: qué pasó y cómo te sentías. Mezcla pretérito e imperfecto.',
      english: 'Tell a short story: what happened and how you felt. Mix preterite and imperfect.',
    },
    'Future tense': {
      spanish: 'Cuéntame tus planes para el próximo mes. Usa al menos 3 verbos en futuro.',
      english: 'Tell me your plans for next month. Use at least 3 verbs in the future tense.',
    },
  };
  return (
    byTopic[block.topic] ?? {
      spanish: `Habla un minuto sobre tu vida usando ${title}. Usa al menos 3 verbos de este tema.`,
      english: `Speak for a minute about your life using ${title}. Use at least 3 verbs from this topic.`,
    }
  );
}

export function localProgressionEvaluation(input: {
  questions: ProgressionTestQuestion[];
  writtenAnswers: string[];
  speakingTranscript: string;
  speakingPrompt: string;
  block: ProgressionBlock;
}): ProgressionEvaluation {
  const writtenScores: ProgressionWrittenScore[] = input.questions.map((question, index) => {
    const answer = input.writtenAnswers[index] ?? '';
    const correct = checkProgressionAnswer(question, answer);
    return {
      question: index + 1,
      score: correct ? 1 : 0,
      correct,
      correctAnswer: question.expectedAnswer,
      feedback: correct ? 'Bien.' : question.explanation || `Respuesta: ${question.expectedAnswer}`,
    };
  });
  const writtenTotal = writtenScores.reduce((sum, item) => sum + item.score, 0);
  const transcript = input.speakingTranscript.trim();
  let speakingScore = 0;
  if (transcript.length > 12) speakingScore = 1;
  if (transcript.split(/\s+/).length >= 12) speakingScore = 2;
  if (transcript.split(/\s+/).length >= 20) speakingScore = 3;
  const speakingBonus = speakingScore >= 3 ? 2 : speakingScore >= 2 ? 1 : 0;
  const totalScore = Math.max(0, Math.min(10, writtenTotal + speakingScore + speakingBonus));
  return {
    writtenScores,
    speakingScore,
    speakingBonus,
    speakingFeedback: transcript
      ? 'Gracias por hablar. Sigue usando este tiempo verbal en frases de tu día.'
      : 'No se oyó una respuesta clara. Inténtalo otra vez cuando puedas.',
    totalScore,
    passed: totalScore >= PROGRESSION_PASS_SCORE,
    topicMastery: `Práctica extra de ${progressionTopicSpanishTitle(input.block)}.`,
    javiFeedback: transcript
      ? 'Buen trabajo. Sigue hablando un poco cada día — ya se nota el esfuerzo.'
      : 'La parte oral es importante. La próxima vez, cuéntame una historia corta.',
  };
}

export function demoProgressionEvaluation(
  questions: ProgressionTestQuestion[],
  writtenAnswers: string[],
): ProgressionEvaluation {
  const writtenScores: ProgressionWrittenScore[] = questions.map((question, index) => ({
    question: index + 1,
    score: index === 1 ? 0 : 1,
    correct: index !== 1,
    correctAnswer: question.expectedAnswer,
    feedback:
      index === 1
        ? `Casi. Respuesta: ${question.expectedAnswer}`
        : 'Bien.',
  }));
  return {
    writtenScores,
    speakingScore: 3,
    speakingBonus: 0,
    speakingFeedback: 'Hablaste con claridad y usaste el tiempo verbal del tema.',
    totalScore: 8,
    passed: true,
    topicMastery: 'Good overall control of this topic. One written form still needs a look.',
    javiFeedback: 'Muy bien. Se nota que has trabajado — sigue así en el siguiente tema.',
  };
}

export async function recordProgressionTestResult(params: {
  block: ProgressionBlock;
  score: number;
  writtenScore: number;
  speakingScore: number;
  questionsWrong: string[];
  wrongQuestionNumbers: number[];
  javiFeedback: string;
  gemsEarned: number;
  passed: boolean;
  completed: boolean;
  advancedTo: string | null;
}): Promise<ProgressionTopicRecord> {
  const tests = await loadProgressionTests();
  const prev = tests[params.block.key] ?? emptyRecord();
  const attemptNumber = prev.attempts + 1;
  const attempt: ProgressionTestAttempt = {
    topic: params.block.key,
    date: formatLocalDate(),
    score: params.score,
    writtenScore: params.writtenScore,
    speakingScore: params.speakingScore,
    passed: params.passed,
    attempt: attemptNumber,
    questionsWrong: params.questionsWrong,
    wrongQuestionNumbers: params.wrongQuestionNumbers,
    javiFeedback: params.javiFeedback,
    gemsEarned: params.gemsEarned,
    advancedTo: params.advancedTo,
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
        source: 'progression_test_error',
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
  await AsyncStorage.removeItem(HAS_SEEN_PROGRESSION_ANIMATION_KEY);
}

async function loadSeenGatewayMap(): Promise<Record<string, true>> {
  try {
    const raw = await AsyncStorage.getItem(HAS_SEEN_PROGRESSION_ANIMATION_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: Record<string, true> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value) map[key] = true;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getActiveProgressionBlockKey(): Promise<string> {
  const curriculum = await getGrammarCurriculum();
  return getProgressionBlockForWeek(curriculum.currentWeek)?.key ?? 'present_tense';
}

export async function hasSeenProgressionGateway(topicKey: string): Promise<boolean> {
  const map = await loadSeenGatewayMap();
  return map[topicKey] === true;
}

export async function markProgressionGatewaySeen(topicKey: string): Promise<void> {
  const map = await loadSeenGatewayMap();
  map[topicKey] = true;
  await AsyncStorage.setItem(HAS_SEEN_PROGRESSION_ANIMATION_KEY, JSON.stringify(map));
}

export function fallbackRetakeTip(errors: ErrorDNAItem[], block: ProgressionBlock): string {
  const top = errors[0];
  if (top?.error) {
    return `Fíjate sobre todo en: ${top.error}. Ejemplo: "${top.example}" → "${top.correction}".`;
  }
  return `Sigue practicando ${block.displayName.toLowerCase()} con frases cortas de tu día.`;
}
