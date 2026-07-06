import { getWeekDefinition } from '@/lib/grammar-curriculum';
import type { QuickFireQuestion } from '@/lib/claude';

/** Pre-written fallback drill questions per grammar week (10 each). */
export function getOfflineGrammarDrillQuestions(week: number): QuickFireQuestion[] {
  const def = getWeekDefinition(week);
  const verbs = def.focusVerbs.slice(0, 5);
  const questions: QuickFireQuestion[] = [];

  verbs.forEach((verb, index) => {
    questions.push({
      id: `offline-${week}-${index}-1`,
      type: 'fill_blank',
      prompt: `Completa: Yo _____ (${verb}) todos los días.`,
      expectedAnswer: verb,
      acceptableAnswers: [verb],
    });
  });

  while (questions.length < 10) {
    const n = questions.length + 1;
    questions.push({
      id: `offline-${week}-extra-${n}`,
      type: 'quick_translate',
      prompt: `Traduce al español: "I practise ${def.topic} every week."`,
      expectedAnswer: `Practico ${def.topicSpanish} cada semana.`,
      acceptableAnswers: [`Practico ${def.topicSpanish} cada semana`],
    });
  }

  return questions.slice(0, 10);
}
