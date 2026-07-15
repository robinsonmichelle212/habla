import { getWeekDefinition } from '@/lib/grammar-curriculum';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import type { LessonKindId } from '@/lib/claude';

export function getOfflineGrammarIntro(week: number): { spanish: string; translation: string } {
  const def = getWeekDefinition(week);
  return {
    spanish: `¡Hola! Hoy vamos a practicar ${def.topicSpanish}. Cuéntame: ¿qué sabes ya sobre este tema?`,
    translation: `Hello! Today we'll practise ${def.topic}. ${def.summary}. Tell me — what do you already know about this topic?`,
  };
}

export function getOfflineLessonOpening(
  lessonKind: LessonKindId,
  focus: LessonFocusContext,
): { spanish: string; translation: string; usedBundle: boolean } {
  if (focus.kind === 'grammar') {
    const intro = getOfflineGrammarIntro(focus.weekNumber);
    return { ...intro, usedBundle: true };
  }

  switch (focus.kind) {
    case 'vocabulary':
      return {
        spanish: '¡Hola! Hoy practicamos el vocabulario de la lección. Empecemos con palabras útiles del día a día.',
        translation: `Hello! Today we're practising vocabulary about ${focus.theme}. Let's start with useful everyday words.`,
        usedBundle: true,
      };
    case 'your-day':
      return {
        spanish: '¡Hola! Hoy hablamos de tu vida. Cuéntame algo sobre ti.',
        translation: `Hello! Today we talk about your life: ${focus.starter}. Tell me something about yourself.`,
        usedBundle: true,
      };
    case 'structure':
      return {
        spanish: '¡Hola! Hoy trabajamos la estructura de las frases en español. Vamos a verla paso a paso.',
        translation: `Hello! Today we work on structure: ${focus.topic.title}. ${focus.topic.summary}`,
        usedBundle: true,
      };
    case 'read':
      return {
        spanish: `¡Hola! Hoy leemos sobre ${focus.textTypeLabel}. Vamos a practicar comprensión lectora.`,
        translation: `Hello! Today we read about ${focus.textTypeLabel}. Let's practise reading comprehension.`,
        usedBundle: true,
      };
    default:
      return {
        spanish: '¡Hola! ¿Cómo estás? Estoy aquí para practicar español contigo.',
        translation: "Hello! How are you? I'm here to practise Spanish with you.",
        usedBundle: true,
      };
  }
}

export function getOfflineWritingPrompt(focus: LessonFocusContext): string {
  if (focus.kind === 'grammar') {
    const def = getWeekDefinition(focus.weekNumber);
    return `Escribe 4–6 frases en español usando ${def.topicSpanish}. Usa estos verbos: ${def.focusVerbs.slice(0, 4).join(', ')}.`;
  }
  if (focus.kind === 'vocabulary') {
    return 'Escribe un párrafo corto de cuatro a seis frases usando el vocabulario de hoy.';
  }
  if (focus.kind === 'your-day') {
    return 'Escribe de cuatro a seis frases sobre tu día y tus experiencias.';
  }
  if (focus.kind === 'structure') {
    return 'Escribe de cuatro a seis frases practicando la estructura de la lección.';
  }
  return 'Escribe 4–6 frases en español sobre el tema de hoy.';
}

export function offlineWarmUpReply(turnIndex: number): { spanish: string; translation: string } {
  const replies = [
    {
      spanish: '¡Muy bien! Sigue — cuéntame un poco más.',
      translation: 'Very good! Keep going — tell me a bit more.',
    },
    {
      spanish: '¡Perfecto! Me gusta cómo lo explicas.',
      translation: 'Perfect! I like how you explain it.',
    },
    {
      spanish: 'Interesante. ¿Puedes darme un ejemplo?',
      translation: 'Interesting. Can you give me an example?',
    },
  ];
  return replies[turnIndex % replies.length];
}

export function focusCacheKey(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return `grammar-w${focus.weekNumber}`;
    case 'vocabulary':
      return `vocab-${focus.theme}`;
    case 'your-day':
      return `day-${focus.starter}`;
    case 'structure':
      return `structure-${focus.topic.id}`;
    case 'read':
      return `read-${focus.textType}`;
    default:
      return 'general';
  }
}
