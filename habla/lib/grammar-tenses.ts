import type { GrammarTopic } from '@/lib/grammar-curriculum';

export type TenseKey =
  | 'present'
  | 'preterite'
  | 'imperfect'
  | 'future'
  | 'conditional'
  | 'presentSubjunctive';

export const TENSE_LABELS: Record<TenseKey, string> = {
  present: 'Present (Presente)',
  preterite: 'Preterite (Pretérito Indefinido)',
  imperfect: 'Imperfect (Pretérito Imperfecto)',
  future: 'Future (Futuro)',
  conditional: 'Conditional (Condicional)',
  presentSubjunctive: 'Present Subjunctive (Subjuntivo Presente)',
};

export const PERSON_LABELS = [
  'yo',
  'tú',
  'él/ella',
  'nosotros',
  'vosotros',
  'ellos/ellas',
] as const;

export type PersonLabel = (typeof PERSON_LABELS)[number];

export const ESSENTIAL_VERB_INFINITIVES = [
  'ser',
  'estar',
  'tener',
  'ir',
  'hacer',
  'poder',
  'querer',
  'saber',
  'dar',
  'venir',
] as const;

export const ESSENTIAL_TENSE_KEYS: TenseKey[] = [
  'present',
  'preterite',
  'imperfect',
  'future',
  'conditional',
  'presentSubjunctive',
];

export function tensesForTopic(topic: GrammarTopic): TenseKey[] {
  switch (topic) {
    case 'Present tense':
      return ['present'];
    case 'Preterite':
      return ['preterite'];
    case 'Imperfect':
      return ['imperfect'];
    case 'Preterite vs Imperfect':
      return ['preterite', 'imperfect'];
    case 'Future tense':
      return ['future'];
    case 'Conditional':
      return ['conditional'];
    case 'Present subjunctive':
      return ['presentSubjunctive'];
    case 'Ser vs Estar':
      return ['present'];
    case 'Por vs Para':
      return ['present'];
    case 'Reflexive verbs':
      return ['present'];
    case 'Present participle (gerund)':
      return ['present'];
    case 'Past participle':
      return ['present'];
    case 'Perfect tenses':
      return ['present', 'preterite'];
    case 'Core prepositions':
      return ['present'];
    case 'Compound prepositions':
      return ['present'];
    case 'Verbs with prepositions':
      return ['present'];
    case 'Imperative mood':
      return ['present', 'presentSubjunctive'];
  }
}

export function parseFocusVerb(focus: string): string {
  const trimmed = focus.trim();
  const withoutHint = trimmed.split('(')[0]?.trim() ?? trimmed;
  if (withoutHint.includes('/')) {
    return withoutHint.split('/')[0]?.trim() ?? withoutHint;
  }
  return withoutHint;
}
