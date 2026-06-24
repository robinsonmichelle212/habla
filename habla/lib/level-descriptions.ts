import type { LevelBandId, NextLevelRequirements, SkillSnapshot } from '@/lib/level-progress';

export type LevelDescription = {
  id: LevelBandId;
  title: string;
  whatYouCanDo: string[];
  grammar: string[];
  vocabulary: string[];
  realConversation: string[];
};

export const LEVEL_DESCRIPTIONS: LevelDescription[] = [
  {
    id: 'b1-beginner',
    title: 'B1 Beginner',
    whatYouCanDo: [
      'Understand the main points of clear standard speech on familiar topics',
      'Deal with most situations likely to arise whilst travelling',
      'Produce simple connected text on familiar topics',
      'Describe experiences, events, dreams and ambitions briefly',
    ],
    grammar: [
      'Present tense mostly solid with some gaps in irregular verbs',
      'Beginning to use preterite for simple past events',
      'Limited use of imperfect',
    ],
    vocabulary: [
      'Around 1,500–2,000 words',
      'Familiar everyday topics only',
      'Gaps in abstract vocabulary',
    ],
    realConversation: [
      '"Fui al supermercado ayer. Compré leche y pan."',
      'Short, simple sentences. Frequent pauses to think.',
      'Relies heavily on present tense even for past events',
    ],
  },
  {
    id: 'b1-developing',
    title: 'B1 Developing',
    whatYouCanDo: [
      'Handle longer conversations on familiar topics',
      'Beginning to express opinions with reasons',
      'Starting to use past tenses more consistently',
      'Can follow the gist of TV programmes on familiar topics',
    ],
    grammar: [
      'Preterite used consistently for completed past actions',
      'Beginning to distinguish preterite from imperfect',
      'Future tense emerging',
    ],
    vocabulary: [
      'Around 2,000–2,500 words',
      'Can discuss work, travel, current events at a basic level',
      'Some abstract vocabulary emerging',
    ],
    realConversation: [
      '"Cuando era pequeño, vivía en Madrid. Un día fui..."',
      'Longer sentences appearing. Still some translation from English.',
      'Mix of tenses but not always correctly chosen',
    ],
  },
  {
    id: 'b1-confident',
    title: 'B1 Confident',
    whatYouCanDo: [
      'Sustain conversations on a wide range of familiar topics',
      'Express and justify opinions clearly',
      'Understand the main points of authentic Spanish media',
      'Handle most travel and work situations comfortably',
    ],
    grammar: [
      'Preterite and imperfect used correctly most of the time',
      'Future and conditional emerging',
      'Beginning to encounter subjunctive',
    ],
    vocabulary: [
      'Around 2,500–3,000 words',
      'Can discuss abstract topics at a basic level',
      'Dialect differences becoming noticeable',
    ],
    realConversation: [
      '"Creo que es importante que la gente..."',
      'Natural flow in familiar topics. Struggles with unfamiliar vocabulary.',
      'Occasional self-correction. Thinking in Spanish sometimes.',
    ],
  },
  {
    id: 'b1-strong',
    title: 'B1 Strong',
    whatYouCanDo: [
      'Converse fluently on most familiar and some unfamiliar topics',
      'Understand native speakers at normal speed on familiar topics',
      'Produce detailed text on a wide range of subjects',
      'Beginning to use idiomatic expressions naturally',
    ],
    grammar: [
      'All major tenses used accurately',
      'Present subjunctive emerging in set phrases',
      'Complex sentences with subordinate clauses',
    ],
    vocabulary: [
      'Around 3,000–3,500 words',
      'Comfortable with abstract topics',
      'Regional and dialect vocabulary awareness',
    ],
    realConversation: [
      '"Espero que puedas venir. Habría sido mejor si..."',
      'Fluid conversation. Rare pauses. Self-corrects naturally.',
      'Thinking predominantly in Spanish',
    ],
  },
  {
    id: 'b2-emerging',
    title: 'B2 Emerging',
    whatYouCanDo: [
      'Understand the main ideas of complex text on concrete and abstract topics',
      'Interact with native speakers with fluency and spontaneity',
      'Produce clear detailed text on a wide range of subjects',
      'Explain a viewpoint giving advantages and disadvantages',
    ],
    grammar: [
      'Subjunctive used correctly in common trigger phrases',
      'Passive voice emerging',
      'Complex conditional structures',
    ],
    vocabulary: [
      'Around 3,500–4,000 words',
      'Comfortable with most everyday and professional topics',
      'Understanding of Spain vs Argentine vocabulary differences',
    ],
    realConversation: [
      '"Aunque no estuviera de acuerdo, entiendo su punto de vista..."',
      'Near-native fluency on familiar topics',
      'Occasional gaps on specialist vocabulary only',
    ],
  },
  {
    id: 'b2-developing',
    title: 'B2 Developing',
    whatYouCanDo: [
      'Understand extended speech and complex text with ease',
      'Express yourself fluently and spontaneously',
      'Use language flexibly for social, academic and professional purposes',
      'Produce clear, well-structured detailed text',
    ],
    grammar: [
      'Full subjunctive used accurately',
      'All tenses used naturally without conscious thought',
      'Idiomatic expressions used correctly',
    ],
    vocabulary: [
      'Around 4,000–5,000 words',
      'Comfortable with specialist topics',
      'Understanding humour, irony and cultural references',
    ],
    realConversation: [
      'Indistinguishable from a fluent speaker on most topics',
      'Native-like rhythm and intonation',
      'Dialect switching awareness',
    ],
  },
  {
    id: 'b2-confident',
    title: 'B2 Confident',
    whatYouCanDo: [
      'Understand virtually everything heard or read',
      'Summarise information from different spoken and written sources',
      'Express yourself spontaneously, fluently and precisely',
      'Differentiate finer shades of meaning in complex situations',
    ],
    grammar: [
      'Grammar is fully internalised — no conscious thought required',
      'Complex structures used naturally',
      'Full command of all tenses and moods',
    ],
    vocabulary: [
      '5,000+ words',
      'Near native range across all topics',
      'Full dialect awareness and switching ability',
    ],
    realConversation: [
      'Native speaker level fluency',
      'Cultural references understood and used naturally',
      'Ready for C1 curriculum',
    ],
  },
];

export function getLevelDescription(id: LevelBandId): LevelDescription {
  return LEVEL_DESCRIPTIONS.find((d) => d.id === id) ?? LEVEL_DESCRIPTIONS[0];
}

export type BandProgressStatus = 'achieved' | 'current' | 'locked';

export function getBandProgressStatus(
  bandIndex: number,
  currentBandIndex: number,
): BandProgressStatus {
  if (bandIndex < currentBandIndex) return 'achieved';
  if (bandIndex === currentBandIndex) return 'current';
  return 'locked';
}

export function buildJaviFocusForNextLevel(
  requirements: NextLevelRequirements | null,
  nextBandTitle: string | null,
): string[] {
  if (!requirements || !nextBandTitle) {
    return ['Keep completing lessons — Javi will adapt as your scores grow.'];
  }

  const points: string[] = [];
  for (const skill of requirements.skillsToImprove.slice(0, 3)) {
    if (skill.skill === 'Grammar') {
      points.push(`Strengthen grammar (${skill.average}% avg) — more targeted tense and structure practice.`);
    } else if (skill.skill === 'Vocabulary') {
      points.push(`Expand active vocabulary (${skill.average}% avg) — save words in lessons and drill them.`);
    } else if (skill.skill === 'Fluency') {
      points.push(`Build speaking fluency (${skill.average}% avg) — longer spoken responses in Phase 3.`);
    } else {
      points.push(`Polish writing (${skill.average}% avg) — apply corrections when you speak aloud.`);
    }
  }

  if (requirements.gap > 0) {
    points.push(
      `Reach ${requirements.targetAverage}% average to unlock ${nextBandTitle} — about ${requirements.gap}% to close.`,
    );
  }

  return points.length ? points : ['Keep your lesson streak — consistency is the fastest path up.'];
}
