/**
 * Synchronous in-memory store for summary display.
 * Populated on the lesson-complete save screen BEFORE navigating to summary.
 * Summary reads this with zero AsyncStorage / network.
 */

export type SummaryDisplayPayload = {
  overallScore: number;
  scorePending: boolean;
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  xpEarned: number;
  gemsEarned: number;
  grammarData: Record<string, unknown>;
  vocabularyData: Record<string, unknown>;
  fluencyData: Record<string, unknown>;
  writingData: Record<string, unknown>;
  challenge: string;
  lessonType: string;
  encouragingMessage: string;
  summaryNotice?: string;
  isDemoSession?: boolean;
  speaking?: {
    fluencyScore: number | null;
    confidenceScore: number | null;
    vocabularyRangeScore: number | null;
    naturalFlowScore: number | null;
    combinedScore: number | null;
    javiFeedback: string;
    pendingEvaluation?: boolean;
    expired?: boolean;
  };
  writing?: {
    grammarScore: number;
    vocabularyScore: number;
    fluencyScore: number;
    feedback: string;
    pendingEvaluation?: boolean;
  };
  reading?: {
    score: number;
    textType: string;
  };
};

let displayPayload: SummaryDisplayPayload | null = null;

export function setSummaryDisplayPayload(payload: SummaryDisplayPayload): void {
  displayPayload = payload;
}

export function getSummaryDisplayPayload(): SummaryDisplayPayload | null {
  return displayPayload;
}

export function clearSummaryDisplayPayload(): void {
  displayPayload = null;
}

/** Compact route params (Expo string params). Large arrays live in the sync store. */
export type SummaryRouteParams = {
  overallScore: string;
  scorePending: string;
  strongAreas: string;
  weakAreas: string;
  focusAreas: string;
  xpEarned: string;
  gemsEarned: string;
  grammarData: string;
  vocabularyData: string;
  fluencyData: string;
  writingData: string;
  challenge: string;
  lessonType: string;
  encouragingMessage: string;
};

export function toSummaryRouteParams(payload: SummaryDisplayPayload): SummaryRouteParams {
  return {
    overallScore: String(payload.overallScore),
    scorePending: payload.scorePending ? '1' : '0',
    strongAreas: JSON.stringify(payload.strongAreas),
    weakAreas: JSON.stringify(payload.weakAreas),
    focusAreas: JSON.stringify(payload.focusAreas),
    xpEarned: String(payload.xpEarned),
    gemsEarned: String(payload.gemsEarned),
    grammarData: JSON.stringify(payload.grammarData),
    vocabularyData: JSON.stringify(payload.vocabularyData),
    fluencyData: JSON.stringify(payload.fluencyData),
    writingData: JSON.stringify(payload.writingData),
    challenge: payload.challenge,
    lessonType: payload.lessonType,
    encouragingMessage: payload.encouragingMessage,
  };
}

function parseStringArray(raw: unknown, fallback: string[]): string[] {
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map(String).filter(Boolean);
  } catch {
    return fallback;
  }
}

function parseObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Resolve display data from route params, falling back to sync store. */
export function resolveSummaryDisplayFromParams(
  params: Record<string, string | string[] | undefined>,
): SummaryDisplayPayload {
  const stored = getSummaryDisplayPayload();
  const pick = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const overallScore = Number(pick('overallScore'));
  const hasParamScore = Number.isFinite(overallScore);

  if (!hasParamScore && stored) return stored;

  return {
    overallScore: hasParamScore ? Math.round(overallScore) : (stored?.overallScore ?? 0),
    scorePending: pick('scorePending') === '1' || stored?.scorePending === true,
    strongAreas: parseStringArray(pick('strongAreas'), stored?.strongAreas ?? ['Good effort today']),
    weakAreas: parseStringArray(pick('weakAreas'), stored?.weakAreas ?? ['Keep practising']),
    focusAreas: parseStringArray(pick('focusAreas'), stored?.focusAreas ?? ['Daily practice']),
    xpEarned: Number.isFinite(Number(pick('xpEarned')))
      ? Math.round(Number(pick('xpEarned')))
      : (stored?.xpEarned ?? 50),
    gemsEarned: Number.isFinite(Number(pick('gemsEarned')))
      ? Math.round(Number(pick('gemsEarned')))
      : (stored?.gemsEarned ?? 2),
    grammarData: Object.keys(parseObject(pick('grammarData'))).length
      ? parseObject(pick('grammarData'))
      : (stored?.grammarData ?? {}),
    vocabularyData: Object.keys(parseObject(pick('vocabularyData'))).length
      ? parseObject(pick('vocabularyData'))
      : (stored?.vocabularyData ?? {}),
    fluencyData: Object.keys(parseObject(pick('fluencyData'))).length
      ? parseObject(pick('fluencyData'))
      : (stored?.fluencyData ?? {}),
    writingData: Object.keys(parseObject(pick('writingData'))).length
      ? parseObject(pick('writingData'))
      : (stored?.writingData ?? {}),
    challenge: pick('challenge') || stored?.challenge || '',
    lessonType: pick('lessonType') || stored?.lessonType || 'Lesson',
    encouragingMessage:
      pick('encouragingMessage') ||
      stored?.encouragingMessage ||
      '¡Buen trabajo! / Great work completing your lesson.',
    summaryNotice: stored?.summaryNotice,
    isDemoSession: stored?.isDemoSession,
    speaking: stored?.speaking,
    writing: stored?.writing,
    reading: stored?.reading,
  };
}
