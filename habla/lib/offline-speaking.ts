import type { LessonType } from '@/lib/claude';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import type { LessonAnalysis, WritingEvaluation } from '@/lib/lesson-session';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';

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

export function buildOfflineLessonAnalysis(
  lessonType: LessonType,
  lessonFocus: LessonFocusContext,
  writingResult: WritingEvaluation,
  writingPrompt: string,
): LessonAnalysis {
  const writingAvg = Math.round(
    (writingResult.grammarScore + writingResult.vocabularyScore + writingResult.fluencyScore) / 3,
  );
  const topic = lessonFocusLabel(lessonFocus);
  const baseBreakdown = {
    grammar: {
      score: writingResult.grammarScore,
      topic,
      details: ['Writing evaluated offline pending speaking sync'],
      mistakes: [],
    },
    vocabulary: {
      score: writingResult.vocabularyScore,
      topic: 'Vocabulary',
      details: [],
    },
    fluency: {
      score: writingResult.fluencyScore,
      details: ['Speaking pending evaluation when back online'],
      description: 'Speaking will be scored once your recordings are processed.',
    },
    writing: {
      score: writingAvg,
      details: [],
    },
  };

  return {
    strongAreas: ['Completed speaking practice while offline'],
    weakAreas: ['Speaking evaluation pending'],
    focusAreas: [topic],
    correctnessScore: writingAvg,
    overallScore: writingAvg,
    encouragingMessage:
      '¡Buen trabajo! / Great work — your speaking will be evaluated when you are back online.',
    breakdown: mergeWritingIntoBreakdown(baseBreakdown, writingResult, writingPrompt),
  };
}
