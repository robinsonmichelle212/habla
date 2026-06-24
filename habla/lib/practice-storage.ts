import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'lessonHistory';

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

export type LessonBreakdown = {
  grammar: GrammarBreakdown;
  vocabulary: VocabularyBreakdown;
  fluency: FluencyBreakdown;
  writing: WritingBreakdown;
};

export type LessonHistoryEntry = {
  date: string; // YYYY-MM-DD
  overallScore: number;
  breakdown: LessonBreakdown;
  weakAreas: string[];
  focusAreas: string[];
  lessonType: string;
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

  const grammarBase = normalizeSection(grammarRaw, g, 'Grammar');
  const vocabularyBase = normalizeSection(vocabularyRaw, v, 'Vocabulary');
  const fluencyBase = normalizeSection(fluencyRaw, f);
  const writingBase = normalizeSection(writingRaw, w);

  return {
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

function normalizeLessonHistory(raw: unknown): LessonHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const obj = item as Partial<LessonHistoryEntry>;
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
          : Math.round(
              (breakdown.grammar.score +
                breakdown.vocabulary.score +
                breakdown.fluency.score +
                breakdown.writing.score) /
                4,
            );

      return {
        date: typeof obj?.date === 'string' ? obj.date : '',
        overallScore,
        breakdown,
        weakAreas: toStringList(obj?.weakAreas),
        focusAreas: toStringList(obj?.focusAreas),
        lessonType: typeof obj?.lessonType === 'string' ? obj.lessonType : 'Lesson',
        scores: legacyScores,
      };
    })
    .filter((entry) => !!entry.date);
}

export function lessonTypeLabel(lessonType: LessonType): string {
  switch (lessonType) {
    case 'Grammar':
      return 'Grammar';
    case 'Vocab':
      return 'Vocabulary';
    case 'Your Day':
      return 'Your Day';
  }
}

export function scoreBarColor(score: number): string {
  if (score >= 90) return '#34D399';
  if (score >= 75) return '#FBBF24';
  return '#F87171';
}

/** Overall session score (0–100). */
export function overallLessonScore(entry: LessonHistoryEntry): number {
  return entry.overallScore;
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
  const next = [...current, entry].slice(-10);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  const dayLessons = lessons.filter((e) => e.date === date);
  if (!dayLessons.length) return null;
  return Math.max(...dayLessons.map((e) => overallLessonScore(e)));
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
  const dayLessons = lessons.filter((e) => e.date === date);
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
  const todays = history.filter((e) => e.date === today);
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
    days.push({
      date,
      dayLabel: DAY_LABELS[d.getDay()],
      score: combinedDayScore(lessonScore, drillScore),
      activityType: dayActivityType(lessonScore, drillScore),
    });
  }

  return days;
}

/** B1→B2 label from average score across the last 10 sessions. */
export function getProgressionLevel(history: LessonHistoryEntry[]): string | null {
  const recent = history.slice(-10);
  if (!recent.length) return null;
  const avg = recent.reduce((sum, e) => sum + overallLessonScore(e), 0) / recent.length;
  if (avg < 60) return 'B1 Beginner';
  if (avg < 70) return 'B1 Developing';
  if (avg < 80) return 'B1 Confident';
  if (avg < 90) return 'B1 Strong';
  return 'B2 Emerging';
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
