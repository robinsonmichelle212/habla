import type { LessonFocusContext } from '@/lib/lesson-focus';
import type { WritingEvaluation } from '@/lib/lesson-session';

export { buildOfflineLessonAnalysis, buildPendingWritingEvaluation } from '@/lib/offline-lesson';

export const OFFLINE_SPEAKING_INTRO = {
  spanish:
    'Ahora vamos a hablar. Olvida lo que escribiste — solo habla con naturalidad. Cuéntame más sobre el tema de hoy.',
};

const OFFLINE_JAVI_REPLIES = [
  {
    spanish: '¡Muy bien! ¿Puedes contarme un poco más?',
  },
  {
    spanish: '¡Interesante! Una última pregunta: ¿qué más quieres contarme?',
  },
  {
    spanish: 'Muy bien. Vamos a ver cómo lo has hecho.',
  },
];

export function offlineJaviReply(turnIndex: number): { spanish: string; translation?: string } {
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
