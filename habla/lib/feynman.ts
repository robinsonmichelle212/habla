import {
  evaluateFeynmanExplanation,
  type FeynmanEvaluationJson,
  type LessonType,
} from '@/lib/claude';
import {
  getWeekDefinition,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { withTimeout } from '@/lib/with-timeout';

export {
  buildFeynmanQuestion,
  markFeynmanCompletedForWeek,
  shouldTriggerFeynman,
} from '@/lib/feynman-storage';

export const MAX_FEYNMAN_ATTEMPTS = 2;
export const FEYNMAN_EVAL_TIMEOUT_MS = 15_000;

export type FeynmanCheckResult = {
  explanation: string;
  feedback: string;
  attempts: number;
  skipped: boolean;
  messages: { role: 'user' | 'assistant'; spanish: string; translation?: string }[];
};

export type FeynmanAttemptRecord = {
  explanation: string;
  feedback: string;
  attempts: number;
};

export function storedFeynmanFromResult(
  result: FeynmanCheckResult | null | undefined,
): FeynmanAttemptRecord | null {
  if (!result || result.skipped) return null;
  return {
    explanation: result.explanation,
    feedback: result.feedback,
    attempts: result.attempts,
  };
}

export function grammarFocusForFeynman(
  curriculum: GrammarCurriculumState,
  weekNumber: number,
): LessonFocusContext {
  const weekDef = getWeekDefinition(weekNumber);
  return {
    kind: 'grammar',
    topic: weekDef.topic,
    topicSpanish: weekDef.topicSpanish,
    weekNumber: weekDef.week,
    focusVerbs: weekDef.focusVerbs,
    includesContrast: weekDef.includesContrast,
    weekSummary: weekDef.summary,
    curriculum,
  };
}

export async function evaluateFeynmanAttempt(
  lessonType: LessonType,
  focus: LessonFocusContext,
  conceptLabel: string,
  userExplanation: string,
  attemptNumber: number,
): Promise<FeynmanEvaluationJson> {
  return withTimeout(
    evaluateFeynmanExplanation(lessonType, focus, conceptLabel, userExplanation, attemptNumber),
    FEYNMAN_EVAL_TIMEOUT_MS,
    'feynman-evaluation',
  );
}
