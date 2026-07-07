import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import { formatLocalDate, getStreakState } from '@/lib/streak';

const STORAGE_KEY = 'lessonHistory';
const MAX_LESSON_HISTORY = 200;

export type ScoreBreakdownSection = {
  score: number;
  topic?: string;
  details: string[];
};

export type VocabWord = { spanish: string; english: string };

export type GrammarMistake = {
  mistake: string;
  correction: string;
  explanation: string;
};

export type WritingCorrection = {
  mistake: string;
  correction: string;
  explanation: string;
};

export type GrammarBreakdown = ScoreBreakdownSection & {
  topic: string;
  lessonDescription?: string;
  mistakes?: GrammarMistake[];
};

export type VocabularyBreakdown = ScoreBreakdownSection & {
  topic: string;
  wordsCorrect?: VocabWord[];
  wordsToRevisit?: VocabWord[];
};

export type FluencyBreakdown = ScoreBreakdownSection & {
  description?: string;
  positivePatterns?: string[];
  negativePatterns?: string[];
  sentenceNotes?: string[];
  weeklyTips?: string[];
};

export type WritingBreakdown = ScoreBreakdownSection & {
  originalText?: string;
  correctedText?: string;
  corrections?: WritingCorrection[];
  accentIssues?: string[];
  structuralFeedback?: string[];
  writingPrompt?: string;
};

export type StructureBreakdown = ScoreBreakdownSection & {
  topic: string;
  lessonDescription?: string;
  wordOrderMistakes?: GrammarMistake[];
};

export type ReadingBreakdown = ScoreBreakdownSection & {
  topic: string;
  textType: string;
  wordsLearned?: { spanish: string; english: string }[];
  grammarPatterns?: string[];
};

export type LessonBreakdown = {
  grammar: GrammarBreakdown;
  vocabulary: VocabularyBreakdown;
  fluency: FluencyBreakdown;
  writing: WritingBreakdown;
  structure?: StructureBreakdown;
  reading?: ReadingBreakdown;
};

export type SpeakingHistoryRecord = {
  fluencyScore: number | null;
  confidenceScore: number | null;
  vocabularyRangeScore: number | null;
  naturalFlowScore: number | null;
  combinedScore: number | null;
  javiFeedback: string;
  exchangeCount: number;
  pendingEvaluation?: boolean;
  expired?: boolean;
  audioPaths?: string[];
};

export type LessonHistoryEntry = {
  date: string; // YYYY-MM-DD
  overallScore: number | null;
  breakdown: LessonBreakdown;
  weakAreas: string[];
  focusAreas: string[];
  lessonType: string;
  speaking?: SpeakingHistoryRecord;
  /** Offline session before history was persisted — no score breakdown. */
  placeholder?: boolean;
  note?: string;
  /** @deprecated legacy flat scores — kept for old entries */
  scores?: {
    grammar: number;
    vocabulary: number;
    fluency: number;
  };
};

export type PriorityWeakArea = {
  label: string;
  frequency: number;
};

export type DrillHistoryEntry = {
  date: string; // YYYY-MM-DD
  score: number;
  totalQuestions: number;
  percentage: number;
  weakAreasDrilled: string[];
  gemsEarned: number;
  type: 'practice';
};

export type WeekChartDay = {
  date: string;
  dayLabel: string;
  score: number | null;
  activityType: 'none' | 'lesson' | 'drill' | 'both';
  /** Grey bar — session happened but was not recorded with scores. */
  placeholder?: boolean;
};

export type TodayScoreInfo = {
  score: number | null;
  label: string;
  lessonEntry: LessonHistoryEntry | null;
  drillEntry: DrillHistoryEntry | null;
};

export type BestWeekDayInfo = {
  combinedScore: number;
  lessonEntry: LessonHistoryEntry | null;
  drillEntry: DrillHistoryEntry | null;
  activityType: 'lesson' | 'drill' | 'both';
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTER_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const OFFLINE_PLACEHOLDER_NOTE =
  'Session completed offline before offline support was added';
const DRILL_STORAGE_KEY = 'drillHistory';
const MAX_DRILL_SESSIONS = 30;
const LESSON_SCORE_WEIGHT = 0.7;
const DRILL_SCORE_WEIGHT = 0.3;

function toStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v).trim()).filter(Boolean);
}

function toScore(input: unknown): number {
  const n = typeof input === 'number' && Number.isFinite(input) ? input : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeSection(
  raw: unknown,
  fallbackScore: number,
  fallbackTopic?: string,
): ScoreBreakdownSection & { topic?: string } {
  const obj = (raw ?? {}) as Partial<ScoreBreakdownSection>;
  return {
    score: toScore(obj.score ?? fallbackScore),
    topic: typeof obj.topic === 'string' ? obj.topic : fallbackTopic,
    details: toStringList(obj.details),
  };
}

function normalizeVocabWords(raw: unknown): VocabWord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item as Partial<VocabWord>;
      const spanish = typeof o.spanish === 'string' ? o.spanish.trim() : '';
      const english = typeof o.english === 'string' ? o.english.trim() : '';
      if (!spanish) return null;
      return { spanish, english: english || '—' };
    })
    .filter((w): w is VocabWord => w != null);
}

function normalizeMistakes(raw: unknown): GrammarMistake[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item as Partial<GrammarMistake>;
      const mistake = typeof o.mistake === 'string' ? o.mistake.trim() : '';
      const correction = typeof o.correction === 'string' ? o.correction.trim() : '';
      const explanation = typeof o.explanation === 'string' ? o.explanation.trim() : '';
      if (!mistake && !correction) return null;
      return { mistake, correction, explanation };
    })
    .filter((m): m is GrammarMistake => m != null);
}

function normalizeBreakdown(
  raw: unknown,
  legacyScores?: { grammar: number; vocabulary: number; fluency: number },
): LessonBreakdown {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const g = legacyScores?.grammar ?? 0;
  const v = legacyScores?.vocabulary ?? 0;
  const f = legacyScores?.fluency ?? 0;
  const w = Math.round((g + v + f) / 3);

  const grammarRaw = (obj.grammar ?? {}) as Partial<GrammarBreakdown>;
  const vocabularyRaw = (obj.vocabulary ?? {}) as Partial<VocabularyBreakdown>;
  const fluencyRaw = (obj.fluency ?? {}) as Partial<FluencyBreakdown>;
  const writingRaw = (obj.writing ?? {}) as Partial<WritingBreakdown>;
  const structureRaw = (obj.structure ?? {}) as Partial<StructureBreakdown>;

  const grammarBase = normalizeSection(grammarRaw, g, 'Grammar');
  const vocabularyBase = normalizeSection(vocabularyRaw, v, 'Vocabulary');
  const fluencyBase = normalizeSection(fluencyRaw, f);
  const writingBase = normalizeSection(writingRaw, w);
  const structureBase = normalizeSection(structureRaw, w, 'Structure');

  const breakdown: LessonBreakdown = {
    grammar: {
      ...grammarBase,
      topic: grammarBase.topic ?? 'Grammar',
      lessonDescription:
        typeof grammarRaw.lessonDescription === 'string' ? grammarRaw.lessonDescription : undefined,
      mistakes: normalizeMistakes(grammarRaw.mistakes),
    },
    vocabulary: {
      ...vocabularyBase,
      topic: vocabularyBase.topic ?? 'Vocabulary',
      wordsCorrect: normalizeVocabWords(vocabularyRaw.wordsCorrect),
      wordsToRevisit: normalizeVocabWords(vocabularyRaw.wordsToRevisit),
    },
    fluency: {
      score: fluencyBase.score,
      details: fluencyBase.details,
      description: typeof fluencyRaw.description === 'string' ? fluencyRaw.description : undefined,
      positivePatterns: toStringList(fluencyRaw.positivePatterns),
      negativePatterns: toStringList(fluencyRaw.negativePatterns),
      sentenceNotes: toStringList(fluencyRaw.sentenceNotes),
      weeklyTips: toStringList(fluencyRaw.weeklyTips),
    },
    writing: {
      score: writingBase.score,
      details: writingBase.details,
      originalText: typeof writingRaw.originalText === 'string' ? writingRaw.originalText : undefined,
      correctedText:
        typeof writingRaw.correctedText === 'string' ? writingRaw.correctedText : undefined,
      corrections: normalizeMistakes(writingRaw.corrections),
      accentIssues: toStringList(writingRaw.accentIssues),
      structuralFeedback: toStringList(writingRaw.structuralFeedback),
      writingPrompt: typeof writingRaw.writingPrompt === 'string' ? writingRaw.writingPrompt : undefined,
    },
  };

  if (obj.structure != null || structureRaw.topic || structureRaw.score != null) {
    breakdown.structure = {
      ...structureBase,
      topic: structureBase.topic ?? 'Sentence structure',
      lessonDescription:
        typeof structureRaw.lessonDescription === 'string' ? structureRaw.lessonDescription : undefined,
      wordOrderMistakes: normalizeMistakes(structureRaw.wordOrderMistakes),
    };
  }

  const readingRaw = (obj.reading ?? {}) as Partial<ReadingBreakdown>;
  if (obj.reading != null || readingRaw.topic || readingRaw.score != null) {
    const readingBase = normalizeSection(readingRaw, w, 'Reading');
    breakdown.reading = {
      ...readingBase,
      topic: readingBase.topic ?? 'Reading',
      textType: typeof readingRaw.textType === 'string' ? readingRaw.textType : 'Reading',
      wordsLearned: normalizeVocabWords(readingRaw.wordsLearned),
      grammarPatterns: toStringList(readingRaw.grammarPatterns),
    };
  }

  return breakdown;
}

/** Previous lesson entry before a given date (for fluency comparison). */
export function getPreviousLessonEntry(
  history: LessonHistoryEntry[],
  beforeDate: string,
): LessonHistoryEntry | null {
  const prior = history.filter((e) => e.date < beforeDate);
  if (!prior.length) return null;
  return prior[prior.length - 1];
}

/** Unique grammar topics covered in lesson history. */
export function getCoveredGrammarTopics(history: LessonHistoryEntry[]): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const entry of history) {
    const topic = entry.breakdown.grammar.topic?.trim();
    if (!topic || seen.has(topic.toLowerCase())) continue;
    seen.add(topic.toLowerCase());
    topics.push(topic);
  }
  return topics;
}

/** Unique vocabulary themes covered in lesson history. */
export function getCoveredVocabThemes(history: LessonHistoryEntry[]): string[] {
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const entry of history) {
    const theme = entry.breakdown.vocabulary.topic?.trim();
    if (!theme || seen.has(theme.toLowerCase())) continue;
    seen.add(theme.toLowerCase());
    themes.push(theme);
  }
  return themes;
}

function normalizeSpeakingRecord(raw: unknown): SpeakingHistoryRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<SpeakingHistoryRecord> & {
    attempt1Score?: number;
    combinedScore?: number | null;
  };

  const pendingEvaluation = Boolean(obj.pendingEvaluation);
  const expired = Boolean(obj.expired);

  if (
    obj.fluencyScore != null ||
    obj.combinedScore != null ||
    obj.attempt1Score != null ||
    pendingEvaluation ||
    expired
  ) {
    const legacyCombined =
      obj.combinedScore != null
        ? obj.combinedScore
        : obj.attempt1Score != null
          ? toScore(obj.attempt1Score)
          : null;

    const scoreOrNull = (value: unknown): number | null => {
      if (value == null) return pendingEvaluation || expired ? null : 0;
      return toScore(value);
    };

    return {
      fluencyScore: scoreOrNull(obj.fluencyScore ?? legacyCombined),
      confidenceScore: scoreOrNull(obj.confidenceScore ?? legacyCombined),
      vocabularyRangeScore: scoreOrNull(obj.vocabularyRangeScore ?? legacyCombined),
      naturalFlowScore: scoreOrNull(obj.naturalFlowScore ?? legacyCombined),
      combinedScore:
        obj.combinedScore === null || pendingEvaluation || expired
          ? legacyCombined
          : scoreOrNull(obj.combinedScore ?? legacyCombined),
      javiFeedback: typeof obj.javiFeedback === 'string' ? obj.javiFeedback : '',
      exchangeCount: Math.max(0, Math.trunc(Number(obj.exchangeCount) || 0)),
      pendingEvaluation,
      expired,
      audioPaths: Array.isArray(obj.audioPaths)
        ? obj.audioPaths.filter((p): p is string => typeof p === 'string')
        : undefined,
    };
  }
  return undefined;
}

function normalizeLessonHistory(raw: unknown): LessonHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: LessonHistoryEntry[] = [];

  for (const item of raw) {
    const obj = item as Partial<LessonHistoryEntry>;
    if (obj.placeholder === true) {
      const date = typeof obj?.date === 'string' ? obj.date : '';
      if (!date) continue;
      entries.push({
        date,
        overallScore: null,
        breakdown: normalizeBreakdown({}, undefined),
        weakAreas: [],
        focusAreas: [],
        lessonType: typeof obj.lessonType === 'string' ? obj.lessonType : 'Unknown',
        placeholder: true,
        note:
          typeof obj.note === 'string' && obj.note.trim()
            ? obj.note.trim()
            : OFFLINE_PLACEHOLDER_NOTE,
      });
      continue;
    }

    const legacyScores = obj.scores
      ? {
          grammar: toScore(obj.scores.grammar),
          vocabulary: toScore(obj.scores.vocabulary),
          fluency: toScore(obj.scores.fluency),
        }
      : undefined;

    const breakdown = normalizeBreakdown(obj.breakdown, legacyScores);
    const overallScore =
      obj.overallScore != null
        ? toScore(obj.overallScore)
        : (() => {
            const parts = [
              breakdown.grammar.score,
              breakdown.vocabulary.score,
              breakdown.fluency.score,
              breakdown.writing.score,
            ];
            if (breakdown.structure) parts.push(breakdown.structure.score);
            return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
          })();

    const date = typeof obj?.date === 'string' ? obj.date : '';
    if (!date) continue;

    entries.push({
      date,
      overallScore,
      breakdown,
      weakAreas: toStringList(obj?.weakAreas),
      focusAreas: toStringList(obj?.focusAreas),
      lessonType: typeof obj?.lessonType === 'string' ? obj.lessonType : 'Lesson',
      speaking: normalizeSpeakingRecord(obj.speaking),
      scores: legacyScores,
    });
  }

  return entries;
}

export function lessonTypeLabel(lessonType: LessonType): string {
  switch (lessonType) {
    case 'Grammar':
      return 'Grammar';
    case 'Vocab':
      return 'Vocabulary';
    case 'Your Day':
      return 'Your Day';
    case 'Structure':
      return 'Structure';
    case 'Read':
      return 'Read';
  }
}

export function scoreBarColor(score: number): string {
  if (score >= 90) return '#34D399';
  if (score >= 75) return '#FBBF24';
  return '#F87171';
}

/** Overall session score (0–100). Placeholder entries return 0 for legacy callers. */
export function overallLessonScore(entry: LessonHistoryEntry): number {
  if (entry.placeholder || entry.overallScore == null) return 0;
  return entry.overallScore;
}

export function isPlaceholderLesson(entry: LessonHistoryEntry): boolean {
  return entry.placeholder === true;
}

function createOfflinePlaceholderEntry(date: string): LessonHistoryEntry {
  return {
    date,
    overallScore: null,
    breakdown: normalizeBreakdown({}, undefined),
    weakAreas: [],
    focusAreas: [],
    lessonType: 'Unknown',
    placeholder: true,
    note: OFFLINE_PLACEHOLDER_NOTE,
  };
}

/**
 * Backfill lessonHistory for streak-active days in the last 7 days that have no entry
 * (e.g. sessions completed before offline history was added). Streak credit is preserved.
 */
export async function repairMissingSessionPlaceholders(
  today: string = formatLocalDate(),
): Promise<number> {
  const [history, streakState] = await Promise.all([getLessonHistory(), getStreakState()]);

  const lessonDates = new Set(history.map((e) => e.date));
  const missingActiveDays = streakState.last7Days.filter(
    (d) => d.completed && !lessonDates.has(d.date),
  );

  if (!missingActiveDays.length) return 0;

  const placeholders = missingActiveDays.map((d) => createOfflinePlaceholderEntry(d.date));
  const next = [...history, ...placeholders]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_LESSON_HISTORY);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return placeholders.length;
}

export async function getLessonHistory(): Promise<LessonHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizeLessonHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function appendLessonHistory(entry: LessonHistoryEntry): Promise<void> {
  const current = await getLessonHistory();
  const next = [...current, entry].slice(-MAX_LESSON_HISTORY);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function findLessonHistoryIndex(
  history: LessonHistoryEntry[],
  date: string,
  lessonType: string,
): number {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.date === date && entry.lessonType === lessonType) {
      return i;
    }
  }
  return -1;
}

export async function updateLessonHistorySpeaking(
  date: string,
  lessonType: string,
  speaking: SpeakingHistoryRecord,
  overallScore?: number,
): Promise<boolean> {
  const history = await getLessonHistory();
  const idx = findLessonHistoryIndex(history, date, lessonType);
  if (idx < 0) return false;

  const entry = history[idx];
  history[idx] = {
    ...entry,
    overallScore: overallScore ?? entry.overallScore,
    speaking,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return true;
}

export async function updateLessonHistoryWriting(
  date: string,
  lessonType: string,
  patch: {
    evaluation: import('@/lib/lesson-session').WritingEvaluation;
    breakdown: LessonBreakdown;
    overallScore?: number;
  },
): Promise<boolean> {
  const history = await getLessonHistory();
  const idx = findLessonHistoryIndex(history, date, lessonType);
  if (idx < 0) return false;

  const entry = history[idx];
  history[idx] = {
    ...entry,
    overallScore: patch.overallScore ?? entry.overallScore,
    breakdown: {
      ...entry.breakdown,
      ...patch.breakdown,
      grammar: patch.breakdown.grammar ?? entry.breakdown.grammar,
      vocabulary: patch.breakdown.vocabulary ?? entry.breakdown.vocabulary,
      writing: patch.breakdown.writing ?? entry.breakdown.writing,
      fluency: entry.breakdown.fluency,
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return true;
}

export async function markLessonSpeakingExpired(date: string, lessonType: string): Promise<boolean> {
  const history = await getLessonHistory();
  const idx = findLessonHistoryIndex(history, date, lessonType);
  if (idx < 0) return false;

  const entry = history[idx];
  history[idx] = {
    ...entry,
    speaking: {
      fluencyScore: null,
      confidenceScore: null,
      vocabularyRangeScore: null,
      naturalFlowScore: null,
      combinedScore: null,
      javiFeedback: 'Speaking expired — audio deleted',
      exchangeCount: entry.speaking?.exchangeCount ?? 0,
      pendingEvaluation: false,
      expired: true,
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return true;
}

function normalizeDrillHistory(raw: unknown): DrillHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const obj = item as Partial<DrillHistoryEntry>;
      const totalQuestions = Math.max(1, Math.trunc(Number(obj.totalQuestions) || 10));
      const score = Math.max(0, Math.min(totalQuestions, Math.trunc(Number(obj.score) || 0)));
      const percentage =
        obj.percentage != null
          ? toScore(obj.percentage)
          : Math.round((score / totalQuestions) * 100);
      return {
        date: typeof obj.date === 'string' ? obj.date : '',
        score,
        totalQuestions,
        percentage,
        weakAreasDrilled: toStringList(obj.weakAreasDrilled),
        gemsEarned: Math.max(0, Math.trunc(Number(obj.gemsEarned) || 0)),
        type: 'practice' as const,
      };
    })
    .filter((entry) => !!entry.date);
}

export async function getDrillHistory(): Promise<DrillHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(DRILL_STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizeDrillHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function appendDrillHistory(entry: DrillHistoryEntry): Promise<void> {
  const current = await getDrillHistory();
  const next = [...current, entry].slice(-MAX_DRILL_SESSIONS);
  await AsyncStorage.setItem(DRILL_STORAGE_KEY, JSON.stringify(next));
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isWithinLastCalendarDays(dateStr: string, today: string, dayCount: number): boolean {
  const entry = parseLocalDate(dateStr);
  const end = parseLocalDate(today);
  const diff = Math.floor((end.getTime() - entry.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 && diff < dayCount;
}

function bestLessonScoreForDay(lessons: LessonHistoryEntry[], date: string): number | null {
  const dayLessons = lessons.filter((e) => e.date === date && !e.placeholder);
  if (!dayLessons.length) return null;
  return Math.max(...dayLessons.map((e) => overallLessonScore(e)));
}

function hasPlaceholderLessonForDay(lessons: LessonHistoryEntry[], date: string): boolean {
  return lessons.some((e) => e.date === date && e.placeholder);
}

function bestDrillScoreForDay(drills: DrillHistoryEntry[], date: string): number | null {
  const dayDrills = drills.filter((e) => e.date === date);
  if (!dayDrills.length) return null;
  return Math.max(...dayDrills.map((e) => e.percentage));
}

function getBestLessonEntryForDay(
  lessons: LessonHistoryEntry[],
  date: string,
): LessonHistoryEntry | null {
  const dayLessons = lessons.filter((e) => e.date === date && !e.placeholder);
  if (!dayLessons.length) return null;
  return dayLessons.reduce((best, e) =>
    overallLessonScore(e) > overallLessonScore(best) ? e : best,
  );
}

function getBestDrillEntryForDay(
  drills: DrillHistoryEntry[],
  date: string,
): DrillHistoryEntry | null {
  const dayDrills = drills.filter((e) => e.date === date);
  if (!dayDrills.length) return null;
  return dayDrills.reduce((best, e) => (e.percentage > best.percentage ? e : best));
}

/** Weighted day score: 70% lesson + 30% drill when both exist. */
export function combinedDayScore(
  lessonScore: number | null,
  drillScore: number | null,
): number | null {
  if (lessonScore != null && drillScore != null) {
    return Math.round(lessonScore * LESSON_SCORE_WEIGHT + drillScore * DRILL_SCORE_WEIGHT);
  }
  if (lessonScore != null) return lessonScore;
  if (drillScore != null) return drillScore;
  return null;
}

function dayActivityType(
  lessonScore: number | null,
  drillScore: number | null,
): WeekChartDay['activityType'] {
  if (lessonScore != null && drillScore != null) return 'both';
  if (lessonScore != null) return 'lesson';
  if (drillScore != null) return 'drill';
  return 'none';
}

/** Most recent lesson completed today, or null if none today. */
export function getTodaysLessonEntry(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): LessonHistoryEntry | null {
  const todays = history.filter((e) => e.date === today && !e.placeholder);
  if (!todays.length) return null;
  return todays[todays.length - 1];
}

export function getTodaysLessonScore(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): number | null {
  const entry = getTodaysLessonEntry(history, today);
  return entry ? overallLessonScore(entry) : null;
}

export function getTodaysDrillEntry(
  drills: DrillHistoryEntry[],
  today: string = formatLocalDate(),
): DrillHistoryEntry | null {
  const todays = drills.filter((e) => e.date === today);
  if (!todays.length) return null;
  return todays[todays.length - 1];
}

/** Today's displayed score and label, factoring in lessons and practice drills. */
export function getTodayScoreInfo(
  history: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  today: string = formatLocalDate(),
): TodayScoreInfo {
  const lessonEntry = getTodaysLessonEntry(history, today);
  const lessonScore = lessonEntry ? overallLessonScore(lessonEntry) : null;
  const drillEntry = getTodaysDrillEntry(drills, today);
  const drillScore = drillEntry ? drillEntry.percentage : null;

  if (lessonScore != null && drillScore != null) {
    const score = Math.max(lessonScore, drillScore);
    return {
      score,
      label: 'Best Today',
      lessonEntry,
      drillEntry,
    };
  }
  if (drillScore != null) {
    return {
      score: drillScore,
      label: 'Practice Score',
      lessonEntry: null,
      drillEntry,
    };
  }
  if (lessonScore != null) {
    return {
      score: lessonScore,
      label: "Today's score",
      lessonEntry,
      drillEntry: null,
    };
  }
  return {
    score: null,
    label: "Today's score",
    lessonEntry: null,
    drillEntry: null,
  };
}

export function getTopScoreThisWeek(
  history: LessonHistoryEntry[],
  drills: DrillHistoryEntry[] = [],
  today: string = formatLocalDate(),
): number | null {
  const best = getBestDayThisWeek(history, drills, today);
  return best ? best.combinedScore : null;
}

/** Highest combined day score in the last 7 calendar days. */
export function getBestDayThisWeek(
  history: LessonHistoryEntry[],
  drills: DrillHistoryEntry[] = [],
  today: string = formatLocalDate(),
): BestWeekDayInfo | null {
  const chart = getWeekScoreChart(history, drills, today);
  const scored = chart.filter((d) => d.score != null);
  if (!scored.length) return null;

  const bestDay = scored.reduce((best, d) => ((d.score ?? 0) > (best.score ?? 0) ? d : best));
  const lessonScore = bestLessonScoreForDay(history, bestDay.date);
  const drillScore = bestDrillScoreForDay(drills, bestDay.date);
  const activityType = dayActivityType(lessonScore, drillScore);

  return {
    combinedScore: bestDay.score ?? 0,
    lessonEntry: getBestLessonEntryForDay(history, bestDay.date),
    drillEntry: getBestDrillEntryForDay(drills, bestDay.date),
    activityType: activityType === 'none' ? 'lesson' : activityType,
  };
}

/** @deprecated Use getBestDayThisWeek for combined lesson + drill analytics. */
export function getBestLessonThisWeek(
  history: LessonHistoryEntry[],
  today: string = formatLocalDate(),
): LessonHistoryEntry | null {
  const week = history.filter((e) => isWithinLastCalendarDays(e.date, today, 7));
  if (!week.length) return null;
  return week.reduce((best, e) =>
    overallLessonScore(e) > overallLessonScore(best) ? e : best,
  );
}

/** Last 7 calendar days ending today — combined weighted score per day for the mini chart. */
export function getWeekScoreChart(
  history: LessonHistoryEntry[],
  drills: DrillHistoryEntry[] = [],
  today: string = formatLocalDate(),
): WeekChartDay[] {
  const end = parseLocalDate(today);
  const days: WeekChartDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const date = formatLocalDate(d);
    const lessonScore = bestLessonScoreForDay(history, date);
    const drillScore = bestDrillScoreForDay(drills, date);
    const placeholder = hasPlaceholderLessonForDay(history, date) && lessonScore == null;
    days.push({
      date,
      dayLabel: DAY_LABELS[d.getDay()],
      score: placeholder ? null : combinedDayScore(lessonScore, drillScore),
      activityType: placeholder ? 'lesson' : dayActivityType(lessonScore, drillScore),
      placeholder,
    });
  }

  return days;
}


export function buildPriorityWeakAreas(lessons: LessonHistoryEntry[]): PriorityWeakArea[] {
  const counts = new Map<string, { label: string; frequency: number }>();
  for (const lesson of lessons) {
    for (const area of lesson.weakAreas) {
      const key = area.trim().toLowerCase();
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.frequency += 1;
      } else {
        counts.set(key, { label: area.trim(), frequency: 1 });
      }
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.frequency - a.frequency);
}
