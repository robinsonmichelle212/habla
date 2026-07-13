import type {
  FluencyBreakdown,
  GrammarBreakdown,
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
    section.wordsCorrect?.map((w) => `Used "${w.spanish}" naturally (${w.english})`) ?? section.details.slice(0, 2);
  const workOn =
    section.wordsToRevisit?.map((w) => `Revisit "${w.spanish}" (${w.english})`) ?? section.details.slice(2, 4);
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
    workOn: normalizeInsightsList(section.negativePatterns ?? section.sentenceNotes ?? section.details.slice(2, 4), 3),
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
