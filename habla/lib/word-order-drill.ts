import type { QuickFireQuestion, WordOrderSubtype } from '@/lib/claude';
import { mergeErrorDnaFromLesson, type ErrorDNAInput } from '@/lib/error-dna';
import { formatLocalDate } from '@/lib/streak';

export const WORD_ORDER_CONSTRUCTIONS = [
  'adjective_placement',
  'object_pronouns',
  'double_negatives',
  'question_formation',
  'gustar_construction',
  'jumbled_words',
  'spot_error',
] as const;

export type WordOrderConstruction = (typeof WORD_ORDER_CONSTRUCTIONS)[number];

const CONSTRUCTION_LABELS: Record<WordOrderConstruction, string> = {
  adjective_placement: 'Adjective placement',
  object_pronouns: 'Object pronoun placement',
  double_negatives: 'Double negatives',
  question_formation: 'Question formation',
  gustar_construction: 'Gustar-type constructions',
  jumbled_words: 'Jumbled word order',
  spot_error: 'Spot the word order error',
};

export function constructionLabel(tag: string): string {
  if (tag in CONSTRUCTION_LABELS) {
    return CONSTRUCTION_LABELS[tag as WordOrderConstruction];
  }
  return tag;
}

export function subtypeToConstruction(subtype: WordOrderSubtype): WordOrderConstruction {
  switch (subtype) {
    case 'jumbled_words':
      return 'jumbled_words';
    case 'spot_error':
      return 'spot_error';
    case 'adjective_placement':
      return 'adjective_placement';
    case 'object_pronoun':
      return 'object_pronouns';
    case 'double_negative':
      return 'double_negatives';
    case 'question_formation':
      return 'question_formation';
    case 'gustar_construction':
      return 'gustar_construction';
  }
}

export function formatWordOrderQuestionType(q: QuickFireQuestion): string {
  switch (q.wordOrderSubtype) {
    case 'jumbled_words':
      return 'Jumbled words 🔀';
    case 'spot_error':
      return 'Spot the error 🔀';
    case 'adjective_placement':
      return 'Adjective placement 🔀';
    case 'object_pronoun':
      return 'Object pronouns 🔀';
    case 'double_negative':
      return 'Double negatives 🔀';
    case 'question_formation':
      return 'Question formation 🔀';
    case 'gustar_construction':
      return 'Gustar construction 🔀';
    default:
      return 'Word order 🔀';
  }
}

export async function recordWordOrderDrillMistakes(
  wrongQuestions: { question: QuickFireQuestion; userAnswer: string }[],
): Promise<void> {
  if (!wrongQuestions.length) return;

  const incoming: ErrorDNAInput[] = wrongQuestions.map(({ question, userAnswer }) => {
    const construction =
      question.constructionTag ??
      (question.wordOrderSubtype
        ? subtypeToConstruction(question.wordOrderSubtype)
        : 'jumbled_words');
    const label = constructionLabel(construction);
    return {
      error: `${label} — word order`,
      category: 'word-order',
      example: userAnswer.trim() || question.prompt.slice(0, 80),
      correction: question.expectedAnswer,
    };
  });

  await mergeErrorDnaFromLesson(incoming, formatLocalDate());
}
