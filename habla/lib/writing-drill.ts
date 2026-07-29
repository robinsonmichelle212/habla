import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ErrorDNAInput } from '@/lib/error-dna';
import {
  resolveCurriculumDrillGate,
  type CurriculumDrillGate,
} from '@/lib/curriculum-drill-gate';

const INTRO_SEEN_KEY = 'habla.writingDrillIntroSeen';
const CACHE_KEY = 'writingDrillQuestionsCache';
const PENDING_KEY = 'writingDrillPendingEvaluations';
const FOCUS_QUEUE_KEY = 'writingDrillFocusQueue';

export type WritingDrillQuestionType =
  | 'rewrite_past'
  | 'complete_sentence'
  | 'free_response'
  | 'correct_rewrite'
  | 'order_words';

export type WritingDrillQuestion = {
  id: string;
  type: WritingDrillQuestionType;
  /** Spanish-only instruction shown above the prompt. */
  instruction: string;
  /** Spanish-only prompt / stem / scrambled words. */
  prompt: string;
  /** Model / expected answer for review (Spanish). */
  expectedAnswer: string;
  acceptableAnswers?: string[];
};

export type WritingDrillEvaluationItem = {
  questionId: string;
  correct: boolean;
  partialCredit: boolean;
  feedback: string;
  modelAnswer: string;
};

export type WritingDrillPendingSession = {
  id: string;
  savedAt: number;
  questions: WritingDrillQuestion[];
  answers: string[];
  errorDnaHints?: string[];
};

export const WRITING_DRILL_SECONDS = 30;

export const WRITING_TYPE_LABELS_ES: Record<WritingDrillQuestionType, string> = {
  rewrite_past: 'reescribir en pasado',
  complete_sentence: 'completar la frase',
  free_response: 'respuesta libre',
  correct_rewrite: 'corregir y reescribir',
  order_words: 'ordenar las palabras',
};

export function writingTimerBarColor(secondsLeft: number): string {
  if (secondsLeft > 15) return '#34D399';
  if (secondsLeft > 8) return '#FBBF24';
  return '#F87171';
}

export function writingDrillScore(
  evaluations: { correct: boolean; partialCredit?: boolean }[],
): number {
  return evaluations.reduce((sum, item) => {
    if (item.correct) return sum + 1;
    if (item.partialCredit) return sum + 0.5;
    return sum;
  }, 0);
}

export async function hasSeenWritingDrillIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === 'true';
}

export async function markWritingDrillIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
}

export async function cacheWritingDrillQuestions(
  questions: WritingDrillQuestion[],
): Promise<void> {
  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ questions, savedAt: Date.now() }),
  );
}

export async function getCachedWritingDrillQuestions(): Promise<WritingDrillQuestion[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { questions?: WritingDrillQuestion[] };
    return Array.isArray(parsed.questions) && parsed.questions.length
      ? parsed.questions
      : null;
  } catch {
    return null;
  }
}

export async function savePendingWritingDrillEvaluation(
  session: WritingDrillPendingSession,
): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  let list: WritingDrillPendingSession[] = [];
  try {
    list = raw ? (JSON.parse(raw) as WritingDrillPendingSession[]) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.unshift(session);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(0, 5)));
}

export async function getPendingWritingDrillEvaluations(): Promise<WritingDrillPendingSession[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as WritingDrillPendingSession[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function clearPendingWritingDrillEvaluation(id: string): Promise<void> {
  const list = await getPendingWritingDrillEvaluations();
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify(list.filter((item) => item.id !== id)),
  );
}

/** Queue weak writing types for the next grammar drill focus tips. */
export async function queueWritingTypesForGrammarFocus(
  types: WritingDrillQuestionType[],
): Promise<void> {
  const unique = [...new Set(types)];
  if (!unique.length) return;
  const tips = unique.map((t) => `Writing focus: ${WRITING_TYPE_LABELS_ES[t]}`);
  const raw = await AsyncStorage.getItem(FOCUS_QUEUE_KEY);
  let existing: string[] = [];
  try {
    existing = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  await AsyncStorage.setItem(
    FOCUS_QUEUE_KEY,
    JSON.stringify([...tips, ...existing].slice(0, 8)),
  );
}

export async function consumeWritingFocusQueue(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FOCUS_QUEUE_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as string[];
    await AsyncStorage.removeItem(FOCUS_QUEUE_KEY);
    return Array.isArray(list) ? list.filter(Boolean) : [];
  } catch {
    await AsyncStorage.removeItem(FOCUS_QUEUE_KEY);
    return [];
  }
}

/** Offline fallback set — unlocked present + preterite only, Spanish-only. */
export function getOfflineWritingDrillQuestions(
  gate?: CurriculumDrillGate | null,
): WritingDrillQuestion[] {
  const week = gate?.weekNumber ?? 1;
  const canPast = week >= 3;

  const rewritePrompts = canPast
    ? [
        'Voy al mercado y compro pan.',
        'Como con mis amigos en un restaurante.',
        'Trabajo mucho y llego a casa tarde.',
      ]
    : [
        'Voy al mercado todos los días.',
        'Como pan con mis amigos.',
        'Trabajo mucho en la oficina.',
      ];

  const rewriteAnswers = canPast
    ? [
        'Fui al mercado y compré pan.',
        'Comí con mis amigos en un restaurante.',
        'Trabajé mucho y llegué a casa tarde.',
      ]
    : [
        'Voy al mercado todos los días.',
        'Como pan con mis amigos.',
        'Trabajo mucho en la oficina.',
      ];

  return [
    ...rewritePrompts.map((prompt, i) => ({
      id: `offline-rewrite-${i + 1}`,
      type: 'rewrite_past' as const,
      instruction: canPast
        ? 'Escribe esta frase en pasado:'
        : 'Reescribe esta frase con tus propias palabras:',
      prompt,
      expectedAnswer: rewriteAnswers[i],
    })),
    {
      id: 'offline-complete-1',
      type: 'complete_sentence',
      instruction: 'Completa la frase:',
      prompt: canPast
        ? 'El fin de semana pasado, ___ con mi familia en un restaurante.'
        : 'Hoy ___ al mercado con mi hermana.',
      expectedAnswer: canPast ? 'comí' : 'voy',
      acceptableAnswers: canPast ? ['comí', 'cené', 'almorcé'] : ['voy', 'voy a ir'],
    },
    {
      id: 'offline-complete-2',
      type: 'complete_sentence',
      instruction: 'Completa la frase:',
      prompt: canPast
        ? 'Ayer ___ muy cansado después del trabajo.'
        : 'Ahora ___ muy cansado.',
      expectedAnswer: canPast ? 'estuve' : 'estoy',
      acceptableAnswers: canPast ? ['estuve', 'llegué'] : ['estoy', 'me siento'],
    },
    {
      id: 'offline-free-1',
      type: 'free_response',
      instruction: 'Responde en 1-2 frases:',
      prompt: '¿Qué desayunaste esta mañana?',
      expectedAnswer: 'Desayuné café y pan.',
    },
    {
      id: 'offline-free-2',
      type: 'free_response',
      instruction: 'Responde en 1-2 frases:',
      prompt: '¿Qué tiempo hace ahora mismo?',
      expectedAnswer: 'Hace buen tiempo.',
    },
    {
      id: 'offline-correct-1',
      type: 'correct_rewrite',
      instruction: 'Hay un error en esta frase. Corrígelo y reescríbela:',
      prompt: 'Yo soy muy cansado porque trabajé mucho ayer.',
      expectedAnswer: 'Estoy muy cansado porque trabajé mucho ayer.',
    },
    {
      id: 'offline-correct-2',
      type: 'correct_rewrite',
      instruction: 'Hay un error en esta frase. Corrígelo y reescríbela:',
      prompt: 'Me gusto el café.',
      expectedAnswer: 'Me gusta el café.',
    },
    {
      id: 'offline-order-1',
      type: 'order_words',
      instruction: 'Ordena estas palabras para formar una frase correcta:',
      prompt: 'mercado / ayer / al / fui / tarde',
      expectedAnswer: 'Ayer fui al mercado tarde.',
      acceptableAnswers: ['Ayer fui tarde al mercado.'],
    },
  ];
}

export async function resolveWritingDrillGate(): Promise<CurriculumDrillGate> {
  return resolveCurriculumDrillGate();
}

export function formatErrorDnaHints(targets: ErrorDNAInput[]): string[] {
  return targets
    .map((t) => t.error?.trim())
    .filter((v): v is string => Boolean(v))
    .slice(0, 4);
}
