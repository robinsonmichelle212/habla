import type {
  FluencyBreakdown,
  GrammarBreakdown,
  LessonBreakdown,
  VocabularyBreakdown,
  WritingBreakdown,
} from '@/lib/practice-storage';

export type SkillTabInsights = {
  didWell: string[];
  workOn: string[];
  focusThisWeek: string[];
};

const MAX_OBSERVATION_WORDS = 15;

function trimObservation(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_OBSERVATION_WORDS) return words.join(' ');
  return `${words.slice(0, MAX_OBSERVATION_WORDS).join(' ')}…`;
}

function normalizeInsightsList(raw: unknown, max = 3): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => trimObservation(String(item)))
    .filter(Boolean)
    .slice(0, max);
}

export function normalizeSkillTabInsights(raw: {
  didWell?: unknown;
  workOn?: unknown;
  focusThisWeek?: unknown;
}): SkillTabInsights {
  return {
    didWell: normalizeInsightsList(raw.didWell, 3),
    workOn: normalizeInsightsList(raw.workOn, 3),
    focusThisWeek: normalizeInsightsList(raw.focusThisWeek, 2),
  };
}

function hasInsights(insights: SkillTabInsights): boolean {
  return insights.didWell.length > 0 || insights.workOn.length > 0 || insights.focusThisWeek.length > 0;
}

function ensureSectionInsights(
  existing: { didWell?: unknown; workOn?: unknown; focusThisWeek?: unknown },
  fallbacks: SkillTabInsights,
): SkillTabInsights {
  const current = normalizeSkillTabInsights(existing);
  return {
    didWell: current.didWell.length ? current.didWell : fallbacks.didWell,
    workOn: current.workOn.length ? current.workOn : fallbacks.workOn,
    focusThisWeek: current.focusThisWeek.length ? current.focusThisWeek : fallbacks.focusThisWeek,
  };
}

export function resolveGrammarInsights(section: GrammarBreakdown): SkillTabInsights {
  const direct = normalizeSkillTabInsights(section);
  if (hasInsights(direct)) return direct;

  const didWell = section.details.slice(0, 2);
  const workOn =
    section.mistakes?.map((m) =>
      m.mistake && m.correction ? `${m.mistake} → ${m.correction}` : m.mistake || m.correction,
    ) ?? section.details.slice(2, 4);
  const focusThisWeek = section.lessonDescription
    ? [trimObservation(section.lessonDescription)]
    : section.details.slice(0, 1);

  return {
    didWell: normalizeInsightsList(didWell, 3),
    workOn: normalizeInsightsList(workOn, 3),
    focusThisWeek: normalizeInsightsList(focusThisWeek, 2),
  };
}

export function resolveVocabularyInsights(section: VocabularyBreakdown): SkillTabInsights {
  const direct = normalizeSkillTabInsights(section);
  if (hasInsights(direct)) return direct;

  const didWell =
    section.wordsCorrect?.map((w) => `Used "${w.spanish}" naturally (${w.english})`) ??
    section.details.slice(0, 2);
  const workOn =
    section.wordsToRevisit?.map((w) => `Revisit "${w.spanish}" (${w.english})`) ??
    section.details.slice(2, 4);
  const focusThisWeek = section.topic
    ? [`Review ${section.topic} words before your next lesson`]
    : section.details.slice(0, 1);

  return {
    didWell: normalizeInsightsList(didWell, 3),
    workOn: normalizeInsightsList(workOn, 3),
    focusThisWeek: normalizeInsightsList(focusThisWeek, 2),
  };
}

export function resolveFluencyInsights(section: FluencyBreakdown): SkillTabInsights {
  const direct = normalizeSkillTabInsights(section);
  if (hasInsights(direct)) return direct;

  return {
    didWell: normalizeInsightsList(section.positivePatterns ?? section.details.slice(0, 2), 3),
    workOn: normalizeInsightsList(
      section.negativePatterns ?? section.sentenceNotes ?? section.details.slice(2, 4),
      3,
    ),
    focusThisWeek: normalizeInsightsList(section.weeklyTips ?? section.details.slice(0, 1), 2),
  };
}

export function resolveWritingInsights(section: WritingBreakdown): SkillTabInsights {
  const direct = normalizeSkillTabInsights(section);
  if (hasInsights(direct)) return direct;

  const workOn =
    section.corrections?.map((c) =>
      c.mistake && c.correction ? `${c.mistake} → ${c.correction}` : c.mistake || c.correction,
    ) ??
    section.accentIssues ??
    section.structuralFeedback ??
    section.details.slice(0, 2);

  return {
    didWell: normalizeInsightsList(section.details.slice(0, 2), 3),
    workOn: normalizeInsightsList(workOn, 3),
    focusThisWeek: normalizeInsightsList(
      section.structuralFeedback?.slice(0, 1) ?? ['Rewrite one sentence from today without checking notes'],
      2,
    ),
  };
}

export type SkillTabContext = {
  strongAreas?: string[];
  weakAreas?: string[];
  focusAreas?: string[];
};

/**
 * Persist didWell / workOn / focusThisWeek onto every breakdown section.
 * Writing often has corrections already; grammar/vocab/fluency need this so tabs stay populated.
 */
export function materializeBreakdownSkillTabs(
  breakdown: LessonBreakdown,
  ctx: SkillTabContext = {},
): LessonBreakdown {
  const strong = normalizeInsightsList(ctx.strongAreas ?? [], 3);
  const weak = normalizeInsightsList(ctx.weakAreas ?? [], 3);
  const focus = normalizeInsightsList(ctx.focusAreas ?? [], 2);

  const writingCorrections = normalizeInsightsList(
    (breakdown.writing.corrections ?? []).map((c) =>
      c.mistake && c.correction ? `${c.mistake} → ${c.correction}` : c.mistake || c.correction,
    ),
    3,
  );
  const accentIssues = normalizeInsightsList(breakdown.writing.accentIssues ?? [], 2);
  const topic = breakdown.grammar.topic?.trim() || 'today\'s grammar';

  const grammarResolved = resolveGrammarInsights(breakdown.grammar);
  const vocabularyResolved = resolveVocabularyInsights(breakdown.vocabulary);
  const fluencyResolved = resolveFluencyInsights(breakdown.fluency);
  const writingResolved = resolveWritingInsights(breakdown.writing);

  const grammar = {
    ...breakdown.grammar,
    ...ensureSectionInsights(breakdown.grammar, {
      didWell: grammarResolved.didWell.length
        ? grammarResolved.didWell
        : strong.length
          ? strong.slice(0, 2)
          : ['Used target grammar accurately in writing'],
      workOn: grammarResolved.workOn.length
        ? grammarResolved.workOn
        : writingCorrections.length
          ? writingCorrections
          : weak.length
            ? weak.slice(0, 2)
            : [`Tighten endings and agreement for ${topic}`],
      focusThisWeek: grammarResolved.focusThisWeek.length
        ? grammarResolved.focusThisWeek
        : focus.length
          ? focus.slice(0, 1)
          : [`Write three new sentences practising ${topic}`],
    }),
  };

  const vocabulary = {
    ...breakdown.vocabulary,
    ...ensureSectionInsights(breakdown.vocabulary, {
      didWell: vocabularyResolved.didWell.length
        ? vocabularyResolved.didWell
        : strong.length
          ? strong.slice(0, 2)
          : ['Used lesson vocabulary in your answers'],
      workOn: vocabularyResolved.workOn.length
        ? vocabularyResolved.workOn
        : weak.length
          ? weak.slice(0, 2)
          : ['Reuse today’s new words without translating first'],
      focusThisWeek: vocabularyResolved.focusThisWeek.length
        ? vocabularyResolved.focusThisWeek
        : focus.length
          ? focus.slice(0, 1)
          : [
              breakdown.vocabulary.topic
                ? `Review ${breakdown.vocabulary.topic} words before your next lesson`
                : 'Review today’s vocabulary before your next lesson',
            ],
    }),
  };

  const fluency = {
    ...breakdown.fluency,
    ...ensureSectionInsights(breakdown.fluency, {
      didWell: fluencyResolved.didWell.length
        ? fluencyResolved.didWell
        : breakdown.fluency.description
          ? [trimObservation(breakdown.fluency.description)]
          : ['Kept speaking in Spanish through the exchanges'],
      workOn: fluencyResolved.workOn.length
        ? fluencyResolved.workOn
        : weak.length
          ? weak.slice(0, 2)
          : ['Reduce mid-sentence pauses and keep answers moving'],
      focusThisWeek: fluencyResolved.focusThisWeek.length
        ? fluencyResolved.focusThisWeek
        : ['Say one full answer aloud without stopping mid-sentence'],
    }),
  };

  const writing = {
    ...breakdown.writing,
    ...ensureSectionInsights(breakdown.writing, {
      didWell: writingResolved.didWell.length
        ? writingResolved.didWell
        : breakdown.writing.details?.length
          ? normalizeInsightsList(breakdown.writing.details, 2)
          : ['Completed the writing task in Spanish'],
      workOn: writingResolved.workOn.length
        ? writingResolved.workOn
        : writingCorrections.length
          ? writingCorrections
          : accentIssues.length
            ? accentIssues
            : ['Check accents and verb endings before submitting'],
      focusThisWeek: writingResolved.focusThisWeek.length
        ? writingResolved.focusThisWeek
        : ['Rewrite one sentence from today without checking notes'],
    }),
  };

  return {
    ...breakdown,
    grammar,
    vocabulary,
    fluency,
    writing,
  };
}

export function countBreakdownInsightItems(breakdown: LessonBreakdown | undefined | null): number {
  if (!breakdown) return 0;
  let total = 0;
  for (const section of [breakdown.grammar, breakdown.vocabulary, breakdown.fluency, breakdown.writing]) {
    const insights = normalizeSkillTabInsights(section ?? {});
    total += insights.didWell.length + insights.workOn.length + insights.focusThisWeek.length;
  }
  return total;
}
