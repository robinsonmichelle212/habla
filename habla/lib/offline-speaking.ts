import type { LessonFocusContext } from '@/lib/lesson-focus';
import type { LessonType } from '@/lib/claude';
import type { WritingEvaluation } from '@/lib/lesson-session';

export { buildOfflineLessonAnalysis, buildPendingWritingEvaluation } from '@/lib/offline-lesson';

export const OFFLINE_SPEAKING_INTRO = {
  spanish:
    'Ahora vamos a hablar. Olvida lo que escribiste — solo habla con naturalidad. Cuéntame más sobre el tema de hoy.',
  translation:
    "Now let's talk. Forget what you wrote — just speak naturally. Tell me more about today's topic.",
};

const OFFLINE_JAVI_REPLIES = [
  {
    spanish: '¡Muy bien! Sigue contándome más.',
    translation: 'Very good! Keep telling me more.',
  },
  {
    spanish: '¡Interesante! ¿Y qué más?',
    translation: 'Interesting! What else?',
  },
  {
    spanish: 'Perfecto, gracias por compartir. Cuéntame un poco más.',
    translation: 'Perfect, thanks for sharing. Tell me a bit more.',
  },
];

export function offlineJaviReply(turnIndex: number): { spanish: string; translation: string } {
  return OFFLINE_JAVI_REPLIES[turnIndex % OFFLINE_JAVI_REPLIES.length];
}

export function grammarTopicFromFocus(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return focus.topic;
    case 'vocabulary':
      return focus.theme;
    case 'your-day':
      return focus.starter;
    case 'structure':
      return focus.topic.title;
    case 'read':
      return focus.textTypeLabel;
    default:
      return 'General';
  }
}

export function writingScoresFromEvaluation(writing: WritingEvaluation) {
  return {
    grammarScore: writing.pendingEvaluation ? 50 : writing.grammarScore,
    vocabularyScore: writing.pendingEvaluation ? 50 : writing.vocabularyScore,
    fluencyScore: writing.pendingEvaluation ? 50 : writing.fluencyScore,
    structureScore: writing.structureScore,
  };
}
