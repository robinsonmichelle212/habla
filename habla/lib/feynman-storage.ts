import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonKindId } from '@/lib/claude';
import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import type { LessonFocusContext } from '@/lib/lesson-focus';

const FEYNMAN_COMPLETED_KEY = 'feynmanCompletedForWeek';

export async function getFeynmanCompletedWeek(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(FEYNMAN_COMPLETED_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}

export async function markFeynmanCompletedForWeek(weekNumber: number): Promise<void> {
  await AsyncStorage.setItem(FEYNMAN_COMPLETED_KEY, String(Math.trunc(weekNumber)));
}

export async function shouldTriggerFeynman(
  lessonKind: LessonKindId,
  _focus: LessonFocusContext,
): Promise<boolean> {
  if (lessonKind !== 'grammar' && lessonKind !== 'structure') return false;

  const curriculum = await resolveGrammarCurriculum();
  const completed = await getFeynmanCompletedWeek();
  return completed !== curriculum.currentWeek;
}

export function buildFeynmanQuestion(
  focus: LessonFocusContext,
): { spanish: string; translation: string; conceptLabel: string } {
  if (focus.kind === 'grammar') {
    return {
      conceptLabel: focus.topic,
      spanish: `Ahora, explícame tú — ¿cuándo usamos ${focus.topicSpanish}? Explícalo con tus propias palabras y dame un ejemplo.`,
      translation: `Now you explain it to me — when do we use ${focus.topic}? Explain it in your own words and give me an example.`,
    };
  }

  if (focus.kind === 'structure') {
    return {
      conceptLabel: focus.topic.title,
      spanish: `Ahora, explícame tú — ¿cómo funciona ${focus.topic.title}? Explícalo con tus propias palabras y dame un ejemplo.`,
      translation: `Now you explain it to me — how does ${focus.topic.title} work? Explain it in your own words and give me an example.`,
    };
  }

  return {
    conceptLabel: 'today\'s topic',
    spanish: 'Ahora, explícame tú el concepto con tus propias palabras y dame un ejemplo.',
    translation: 'Now explain the concept to me in your own words and give me an example.',
  };
}
