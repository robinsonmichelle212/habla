import {
  getWeekDefinition,
  resolveGrammarCurriculum,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import {
  getCoveredVocabThemesFromStorage,
  VOCAB_THEMES,
  type VocabTheme,
} from '@/lib/lesson-focus';

/** Unlock thresholds aligned with the 30-week curriculum schedule. */
const UNLOCK_RULES: { minWeek: number; topic: string; aliases: string[] }[] = [
  { minWeek: 1, topic: 'present tense', aliases: ['present', 'presente'] },
  { minWeek: 3, topic: 'preterite', aliases: ['preterite', 'pretérito', 'preterito'] },
  { minWeek: 5, topic: 'imperfect', aliases: ['imperfect', 'imperfecto'] },
  {
    minWeek: 7,
    topic: 'preterite vs imperfect',
    aliases: ['preterite vs imperfect', 'pretérito vs imperfecto'],
  },
  { minWeek: 9, topic: 'future tense', aliases: ['future', 'futuro'] },
  { minWeek: 11, topic: 'conditional', aliases: ['conditional', 'condicional'] },
  {
    minWeek: 13,
    topic: 'present subjunctive',
    aliases: ['subjunctive', 'subjuntivo'],
  },
  { minWeek: 15, topic: 'ser vs estar', aliases: ['ser vs estar', 'ser/estar'] },
  { minWeek: 17, topic: 'por vs para', aliases: ['por vs para', 'por/para'] },
  { minWeek: 19, topic: 'reflexive verbs', aliases: ['reflexive', 'reflexivos'] },
  {
    minWeek: 21,
    topic: 'present participle gerund',
    aliases: ['gerund', 'present participle', 'gerundio'],
  },
  {
    minWeek: 23,
    topic: 'past participle',
    aliases: ['past participle', 'participio'],
  },
  {
    minWeek: 25,
    topic: 'perfect tenses',
    aliases: ['perfect tense', 'perfect tenses', 'haber', 'present perfect'],
  },
  { minWeek: 27, topic: 'prepositions', aliases: ['preposition', 'prepositions'] },
  {
    minWeek: 29,
    topic: 'compound prepositions',
    aliases: ['compound preposition'],
  },
  {
    minWeek: 30,
    topic: 'imperative mood',
    aliases: ['imperative', 'imperativo', 'commands'],
  },
];

export type CurriculumDrillGate = {
  weekNumber: number;
  currentGrammarTopic: string;
  unlockedTopics: string[];
  coveredVocabThemes: string[];
};

export function unlockedTopicsForWeek(weekNumber: number): string[] {
  const week = Math.max(1, Math.min(30, Math.floor(weekNumber) || 1));
  return UNLOCK_RULES.filter((rule) => week >= rule.minWeek).map((rule) => rule.topic);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** True when a label clearly refers to a grammar topic that is still locked. */
export function isLockedGrammarLabel(label: string, weekNumber: number): boolean {
  const n = normalize(label);
  if (!n) return false;
  return UNLOCK_RULES.some((rule) => {
    if (weekNumber >= rule.minWeek) return false;
    return rule.aliases.some((alias) => n.includes(alias) || alias.includes(n));
  });
}

export function isTopicUnlocked(topic: string, unlockedTopics: string[]): boolean {
  const normalized = normalize(topic);
  if (!normalized) return false;
  return unlockedTopics.some((unlocked) => {
    const u = unlocked.toLowerCase();
    return normalized.includes(u) || u.includes(normalized);
  });
}

/** Keep labels that are not clearly locked grammar; fall back to current topic. */
export function filterOutLockedGrammar(
  labels: string[],
  weekNumber: number,
  fallback: string,
): string[] {
  const filtered = labels.filter((label) => !isLockedGrammarLabel(label, weekNumber));
  if (filtered.length > 0) return filtered;
  return [fallback];
}

export async function resolveCurriculumDrillGate(
  curriculum?: GrammarCurriculumState | null,
): Promise<CurriculumDrillGate> {
  const state = curriculum ?? (await resolveGrammarCurriculum());
  const weekNumber = Math.max(1, Math.min(30, state.currentWeek || 1));
  const currentGrammarTopic =
    state.currentTopic || getWeekDefinition(weekNumber).topic;

  let coveredVocabThemes: string[] = [];
  try {
    coveredVocabThemes = await getCoveredVocabThemesFromStorage();
  } catch {
    coveredVocabThemes = [];
  }
  if (!coveredVocabThemes.length) {
    coveredVocabThemes = [VOCAB_THEMES[0] as VocabTheme]; // Food and cooking
  }

  return {
    weekNumber,
    currentGrammarTopic,
    unlockedTopics: unlockedTopicsForWeek(weekNumber),
    coveredVocabThemes,
  };
}

/** Prompt block injected into every Claude drill / gem-shop grammar generation call. */
export function formatCurriculumGatePrompt(gate: CurriculumDrillGate): string {
  const topics = gate.unlockedTopics.length
    ? gate.unlockedTopics.map((t) => `- ${t}`).join('\n')
    : '- present tense';

  return `CRITICAL: Only generate questions on these grammar topics — do not use any other tenses or grammar concepts:
${topics}

The user is currently on curriculum week ${gate.weekNumber}.
Their current focus is: ${gate.currentGrammarTopic}

Weight the questions as follows:
- 40% on current week's grammar topic (${gate.currentGrammarTopic})
- 40% on previously covered topics from the unlocked list
- 20% on vocabulary and fluency from covered themes only: ${gate.coveredVocabThemes.join(', ')}
- 0% on any topic not in the unlocked list

Never generate questions on:
- Subjunctive (unless week 13+)
- Perfect tenses (unless week 25+)
- Imperative (unless week 30+)
- Any tense or concept not in the unlocked list above`;
}

export function formatVocabThemeGatePrompt(coveredThemes: string[]): string {
  const themes = coveredThemes.length ? coveredThemes : [VOCAB_THEMES[0]];
  return `VOCABULARY RESTRICTION: Only use vocabulary from these covered themes:
${themes.map((t) => `- ${t}`).join('\n')}
Do not introduce vocabulary from themes the learner has not covered yet.`;
}
