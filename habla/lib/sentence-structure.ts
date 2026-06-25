export const STRUCTURE_TOPICS = [
  {
    id: 1,
    title: 'Adjective placement',
    summary: 'English puts adjectives before nouns; Spanish usually after.',
    focus: 'Place adjectives after the noun unless they change meaning (buen/mal/gran before noun).',
    examples: ['The red car → El coche rojo', 'A big problem → Un problema grande'],
    writingHint: 'Rewrite English sentences with adjectives in correct Spanish word order.',
  },
  {
    id: 2,
    title: 'Dropping subject pronouns',
    summary: 'Spanish verb endings show the subject — yo/tú/él are often unnecessary.',
    focus: 'Remove unnecessary subject pronouns unless needed for emphasis or clarity.',
    examples: ['I am tired → Estoy cansado (not Yo estoy cansado)', 'We eat → Comemos'],
    writingHint: 'Rewrite sentences removing unnecessary subject pronouns.',
  },
  {
    id: 3,
    title: 'Object pronoun placement',
    summary: 'Object pronouns come BEFORE the conjugated verb in Spanish.',
    focus: 'Direct and indirect pronouns: me, te, lo, la, le, nos, os, los, las, les — before the verb.',
    examples: ['I see him → Lo veo (not Veo lo)', 'She gives it to me → Me lo da'],
    writingHint: 'Fix object pronoun position in Spanish sentences.',
  },
  {
    id: 4,
    title: 'Double negatives',
    summary: 'Spanish requires double negatives — both parts are correct and required.',
    focus: 'No + verb + nada/nadie/nunca/ningún — both negatives stay.',
    examples: ['I don\'t want anything → No quiero nada', 'I never go → No voy nunca / Nunca voy'],
    writingHint: 'Build correct double-negative Spanish sentences.',
  },
  {
    id: 5,
    title: 'Question formation',
    summary: 'Questions use rising intonation or invert — no English-style "do you".',
    focus: '¿Vienes? ¿Estás cansado? — no auxiliary "do".',
    examples: ['Are you coming? → ¿Vienes?', 'Do you like it? → ¿Te gusta?'],
    writingHint: 'Turn English questions into natural Spanish questions.',
  },
  {
    id: 6,
    title: 'Ser vs Estar — word order and context',
    summary: 'Ser vs estar is about context and feel, not just rules.',
    focus: 'DOCTOR for ser (Description, Occupation, Characteristic, Time, Origin, Relationship). PLACE for estar (Position, Location, Action, Condition, Emotion).',
    examples: ['I am a teacher → Soy profesor', 'I am tired → Estoy cansado'],
    writingHint: 'Choose ser or estar and build natural sentences.',
  },
  {
    id: 7,
    title: 'Reflexive verb constructions',
    summary: 'Many daily experiences use reflexive verbs in Spanish but not in English.',
    focus: 'Me aburro, me caí, me lavo — the reflexive pronoun is essential.',
    examples: ['I am bored → Me aburro', 'I fell → Me caí'],
    writingHint: 'Use correct reflexive constructions for daily experiences.',
  },
  {
    id: 8,
    title: 'Gustar-type verbs',
    summary: 'The thing liked is the subject; the person is an indirect object.',
    focus: 'Me gusta el café (not Yo gusto). Me duele la cabeza = My head hurts.',
    examples: ['I like coffee → Me gusta el café', 'My head hurts → Me duele la cabeza'],
    writingHint: 'Rewrite using gustar-type word order (me/te/le + verb + subject).',
  },
  {
    id: 9,
    title: 'Por vs Para in sentences',
    summary: 'Por vs para changes the meaning of the whole sentence.',
    focus: 'Por: cause, duration, exchange, movement through. Para: purpose, destination, deadline, opinion.',
    examples: ['I study for the exam → Estudio para el examen', 'Thanks for everything → Gracias por todo'],
    writingHint: 'Choose por or para and complete the sentence naturally.',
  },
  {
    id: 10,
    title: 'Complex sentence building',
    summary: 'Connect clauses with que, porque, aunque, cuando, si.',
    focus: 'Subordinate clause word order — verb often follows the connector.',
    examples: ['I think that he is right → Creo que tiene razón', 'Although I am tired, I will go → Aunque estoy cansado, iré'],
    writingHint: 'Build longer sentences with subordinate connectors.',
  },
] as const;

export type StructureTopic = (typeof STRUCTURE_TOPICS)[number];
export type StructureTopicId = StructureTopic['id'];

export function getStructureTopic(id: number): StructureTopic {
  return STRUCTURE_TOPICS.find((t) => t.id === id) ?? STRUCTURE_TOPICS[0];
}

export function structureTopicLabel(topic: StructureTopic): string {
  return `Topic ${topic.id}: ${topic.title}`;
}
