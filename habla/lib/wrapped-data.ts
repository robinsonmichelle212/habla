import { calculateLessonGems, gemsForPracticeDrill, getTotalGems } from '@/lib/gems';
import { getErrorDNA, type ErrorDNAItem } from '@/lib/error-dna';
import { resolveGrammarCurriculum, getWeekDefinition } from '@/lib/grammar-curriculum';
import {
  getBandForScore,
  getRecentAverageScore,
  type LevelBand,
} from '@/lib/level-progress';
import {
  overallLessonScore,
  type DrillHistoryEntry,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { getSavedVocabulary, type SavedVocabWord } from '@/lib/saved-vocabulary';
import { formatLocalDate } from '@/lib/streak';

export type MonthKey = string; // YYYY-MM

export type WrappedCalendarDay = {
  date: string;
  dayOfMonth: number;
  active: boolean;
};

export type SpanishWrappedReport = {
  monthKey: MonthKey;
  monthLabel: string;
  generatedAt: string;
  seenAt: string | null;

  totalLessons: number;
  totalDrills: number;
  totalReadSessions: number;
  totalStructureLessons: number;
  favouriteLessonType: string;
  estimatedMinutes: number;
  estimatedHours: number;
  gemsEarnedThisMonth: number;
  currentGemTotal: number;

  longestStreakThisMonth: number;
  totalDaysActive: number;
  totalDaysMissed: number;
  daysInMonth: number;
  streakConsistencyPercent: number;
  calendarDays: WrappedCalendarDay[];

  averageScoreStart: number;
  averageScoreEnd: number;
  improvementPercent: number;
  bestSkill: string;
  mostImprovedSkill: string;
  needsWorkSkill: string;
  skillScoresEnd: Record<string, number>;

  levelAtStart: string;
  levelAtEnd: string;
  levelBandStart: LevelBand;
  levelBandEnd: LevelBand;
  levelledUp: boolean;
  progressInBand: number;

  wordsSavedThisMonth: number;
  wordsMasteredThisMonth: number;
  totalWordsInList: number;
  recentlyMasteredWords: { spanish: string; english: string }[];

  mostPersistentError: string | null;
  mostImprovedError: string | null;
  stillWorkingOnError: string | null;
  newErrorsThisMonth: string[];

  grammarWeeksCompleted: number;
  currentGrammarWeek: number;
  currentGrammarTopic: string;

  highestLessonScore: number;
  longestStreakOverall: number;
  mostSessionsInOneWeek: number;
  mostProductiveDayOfWeek: string;

  javiMessage: string;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function monthKeyFromParts(year: number, monthIndex: number): MonthKey {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function monthKeyFromDate(d: Date): MonthKey {
  return monthKeyFromParts(d.getFullYear(), d.getMonth());
}

export function previousMonthKey(from: Date = new Date()): MonthKey {
  const d = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  return monthKeyFromDate(d);
}

export function nextMonthFirstDay(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

export function daysUntilNextWrap(from: Date = new Date()): number {
  const next = nextMonthFirstDay(from);
  const ms = next.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function monthLabel(monthKey: MonthKey): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function isDateInMonth(dateStr: string, monthKey: MonthKey): boolean {
  return dateStr.startsWith(monthKey);
}

function parseMonthKey(monthKey: MonthKey): { year: number; monthIndex: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, monthIndex: m - 1 };
}

function daysInMonth(monthKey: MonthKey): number {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return new Date(year, monthIndex + 1, 0).getDate();
}

function filterLessons(lessons: LessonHistoryEntry[], monthKey: MonthKey): LessonHistoryEntry[] {
  return lessons.filter((l) => isDateInMonth(l.date, monthKey));
}

function filterDrills(drills: DrillHistoryEntry[], monthKey: MonthKey): DrillHistoryEntry[] {
  return drills.filter((d) => isDateInMonth(d.date, monthKey));
}

function lessonsBeforeMonth(lessons: LessonHistoryEntry[], monthKey: MonthKey): LessonHistoryEntry[] {
  return lessons.filter((l) => l.date < `${monthKey}-01`);
}

function lessonsThroughMonth(lessons: LessonHistoryEntry[], monthKey: MonthKey): LessonHistoryEntry[] {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const end = formatLocalDate(lastDay);
  return lessons.filter((l) => l.date <= end);
}

function activeDatesInMonth(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  monthKey: MonthKey,
): Set<string> {
  const dates = new Set<string>();
  for (const l of filterLessons(lessons, monthKey)) dates.add(l.date);
  for (const d of filterDrills(drills, monthKey)) dates.add(d.date);
  return dates;
}

function longestStreakInDates(sortedDates: string[]): number {
  if (!sortedDates.length) return 0;
  const unique = [...new Set(sortedDates)].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + 'T12:00:00');
    const cur = new Date(unique[i] + 'T12:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (gap === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function buildCalendarDays(monthKey: MonthKey, activeDates: Set<string>): WrappedCalendarDay[] {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const total = daysInMonth(monthKey);
  const days: WrappedCalendarDay[] = [];
  for (let d = 1; d <= total; d++) {
    const date = `${monthKey}-${String(d).padStart(2, '0')}`;
    days.push({ date, dayOfMonth: d, active: activeDates.has(date) });
  }
  return days;
}

function averageScore(lessons: LessonHistoryEntry[]): number {
  if (!lessons.length) return 0;
  const sum = lessons.reduce((s, l) => s + overallLessonScore(l), 0);
  return Math.round(sum / lessons.length);
}

function skillAverages(lessons: LessonHistoryEntry[]): Record<string, number> {
  if (!lessons.length) return {};
  const sums: Record<string, number> = {
    Grammar: 0,
    Vocabulary: 0,
    Fluency: 0,
    Writing: 0,
    Structure: 0,
  };
  let structureN = 0;
  for (const e of lessons) {
    sums.Grammar += e.breakdown.grammar.score;
    sums.Vocabulary += e.breakdown.vocabulary.score;
    sums.Fluency += e.breakdown.fluency.score;
    sums.Writing += e.breakdown.writing.score;
    if (e.breakdown.structure) {
      sums.Structure += e.breakdown.structure.score;
      structureN += 1;
    }
  }
  const n = lessons.length;
  const out: Record<string, number> = {
    Grammar: Math.round(sums.Grammar / n),
    Vocabulary: Math.round(sums.Vocabulary / n),
    Fluency: Math.round(sums.Fluency / n),
    Writing: Math.round(sums.Writing / n),
  };
  if (structureN > 0) out.Structure = Math.round(sums.Structure / structureN);
  return out;
}

function estimateGemsForMonth(
  monthLessons: LessonHistoryEntry[],
  monthDrills: DrillHistoryEntry[],
  vocabWords: SavedVocabWord[],
  monthKey: MonthKey,
): number {
  let total = 0;
  for (const l of monthLessons) {
    total += calculateLessonGems(overallLessonScore(l));
  }
  for (const d of monthDrills) {
    total += d.gemsEarned ?? gemsForPracticeDrill(d.score, d.totalQuestions);
  }
  for (const w of vocabWords) {
    if (isDateInMonth(w.dateSaved, monthKey)) total += 1;
    if (w.mastered && isDateInMonth(w.dateSaved, monthKey)) total += 2;
  }
  return total;
}

function analyseErrorsForMonth(
  errors: ErrorDNAItem[],
  monthKey: MonthKey,
): {
  mostPersistent: string | null;
  mostImproved: string | null;
  stillWorking: string | null;
  newErrors: string[];
} {
  const counts = new Map<string, number>();
  const newErrors: string[] = [];

  for (const item of errors) {
    const inMonth = item.appearanceDates.filter((d) => isDateInMonth(d, monthKey));
    if (inMonth.length) {
      counts.set(item.error, inMonth.length);
      const firstEver = [...item.appearanceDates].sort()[0];
      if (firstEver && isDateInMonth(firstEver, monthKey)) {
        newErrors.push(item.error);
      }
    }
  }

  let mostPersistent: string | null = null;
  let maxCount = 0;
  for (const [error, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostPersistent = error;
    }
  }

  let mostImproved: string | null = null;
  for (const item of errors) {
    if (item.improvingSince && isDateInMonth(item.improvingSince, monthKey)) {
      mostImproved = item.error;
      break;
    }
  }

  const stillWorking = mostPersistent;

  return {
    mostPersistent,
    mostImproved,
    stillWorking,
    newErrors: newErrors.slice(0, 5),
  };
}

function mostProductiveDayOfWeek(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  monthKey: MonthKey,
): string {
  const counts = new Array(7).fill(0) as number[];
  for (const l of filterLessons(lessons, monthKey)) {
    counts[new Date(l.date + 'T12:00:00').getDay()] += 1;
  }
  for (const d of filterDrills(drills, monthKey)) {
    counts[new Date(d.date + 'T12:00:00').getDay()] += 1;
  }
  const max = Math.max(...counts);
  if (max === 0) return '—';
  return DAY_NAMES[counts.indexOf(max)];
}

function sessionsInWeek(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  monthKey: MonthKey,
): number {
  const { year, monthIndex } = parseMonthKey(monthKey);
  let best = 0;
  const monthLessons = filterLessons(lessons, monthKey);
  const monthDrills = filterDrills(drills, monthKey);
  const allDates = [
    ...monthLessons.map((l) => l.date),
    ...monthDrills.map((d) => d.date),
  ];
  const uniqueWeeks = new Set<string>();
  for (const date of allDates) {
    const d = new Date(date + 'T12:00:00');
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    uniqueWeeks.add(key);
  }
  for (const weekKey of uniqueWeeks) {
    const start = new Date(weekKey + 'T12:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = formatLocalDate(start);
    const endStr = formatLocalDate(end);
    const count =
      monthLessons.filter((l) => l.date >= startStr && l.date <= endStr).length +
      monthDrills.filter((d) => d.date >= startStr && d.date <= endStr).length;
    best = Math.max(best, count);
  }
  return best;
}

function favouriteLessonType(monthLessons: LessonHistoryEntry[]): string {
  const counts = new Map<string, number>();
  for (const l of monthLessons) {
    const t = l.lessonType || 'Lesson';
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = '—';
  let max = 0;
  for (const [type, count] of counts) {
    if (count > max) {
      max = count;
      best = type;
    }
  }
  return best;
}

export async function buildWrappedReport(
  monthKey: MonthKey,
  javiMessage = '',
): Promise<SpanishWrappedReport> {
  const [lessons, drills, errors, vocab, gemTotal, curriculum] = await Promise.all([
    import('@/lib/practice-storage').then((m) => m.getLessonHistory()),
    import('@/lib/practice-storage').then((m) => m.getDrillHistory()),
    getErrorDNA(),
    getSavedVocabulary(),
    getTotalGems(),
    resolveGrammarCurriculum(),
  ]);

  const monthLessons = filterLessons(lessons, monthKey);
  const monthDrills = filterDrills(drills, monthKey);
  const activeDates = activeDatesInMonth(lessons, drills, monthKey);
  const totalDays = daysInMonth(monthKey);
  const daysActive = activeDates.size;
  const daysMissed = Math.max(0, totalDays - daysActive);

  const beforeMonth = lessonsBeforeMonth(lessons, monthKey);
  const throughMonth = lessonsThroughMonth(lessons, monthKey);

  const avgStart = averageScore(beforeMonth.length ? beforeMonth.slice(-5) : monthLessons.slice(0, 3));
  const avgEnd = averageScore(throughMonth.slice(-5).length ? throughMonth.slice(-5) : monthLessons);
  const improvement =
    avgStart > 0 ? Math.round(((avgEnd - avgStart) / avgStart) * 100) : avgEnd > 0 ? 100 : 0;

  const skillsBefore = skillAverages(beforeMonth.slice(-10));
  const skillsEnd = skillAverages(throughMonth.slice(-10).length ? throughMonth.slice(-10) : monthLessons);

  let bestSkill = '—';
  let needsWorkSkill = '—';
  let mostImprovedSkill = '—';
  let bestScore = -1;
  let worstScore = 101;
  let bestDelta = -Infinity;
  for (const [skill, score] of Object.entries(skillsEnd)) {
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
    if (score < worstScore) {
      worstScore = score;
      needsWorkSkill = skill;
    }
    const before = skillsBefore[skill] ?? score;
    const delta = score - before;
    if (delta > bestDelta) {
      bestDelta = delta;
      mostImprovedSkill = skill;
    }
  }

  const bandStart = getBandForScore(getRecentAverageScore(beforeMonth) ?? avgStart);
  const bandEnd = getBandForScore(getRecentAverageScore(throughMonth) ?? avgEnd);

  const wordsSaved = vocab.filter((w) => isDateInMonth(w.dateSaved, monthKey));
  const wordsMastered = vocab.filter(
    (w) => w.mastered && isDateInMonth(w.dateSaved, monthKey),
  );
  const recentlyMastered = vocab
    .filter((w) => w.mastered)
    .slice(-5)
    .map((w) => ({ spanish: w.spanish, english: w.english }));

  const errorAnalysis = analyseErrorsForMonth(errors, monthKey);

  const totalSessions = monthLessons.length + monthDrills.length;
  const estimatedMinutes = totalSessions * 15;

  const weekDef = getWeekDefinition(curriculum.currentWeek);
  const grammarWeeksInMonth = new Set(
    monthLessons.filter((l) => l.lessonType === 'Grammar').map((l) => l.date),
  ).size;

  const highestScore = monthLessons.reduce(
    (max, l) => Math.max(max, overallLessonScore(l)),
    0,
  );

  const activeDateList = [...activeDates].sort();
  const longestInMonth = longestStreakInDates(activeDateList);

  const gemsEarned = estimateGemsForMonth(monthLessons, monthDrills, vocab, monthKey);

  const progressInBand =
    bandEnd.index > bandStart.index
      ? 100
      : Math.round(((avgEnd - bandEnd.band.min) / Math.max(1, bandEnd.band.max - bandEnd.band.min)) * 100);

  return {
    monthKey,
    monthLabel: monthLabel(monthKey),
    generatedAt: formatLocalDate(),
    seenAt: null,

    totalLessons: monthLessons.length,
    totalDrills: monthDrills.length,
    totalReadSessions: monthLessons.filter((l) => l.lessonType === 'Read').length,
    totalStructureLessons: monthLessons.filter((l) => l.lessonType === 'Structure').length,
    favouriteLessonType: favouriteLessonType(monthLessons),
    estimatedMinutes,
    estimatedHours: Math.round((estimatedMinutes / 60) * 10) / 10,
    gemsEarnedThisMonth: gemsEarned,
    currentGemTotal: gemTotal,

    longestStreakThisMonth: longestInMonth,
    totalDaysActive: daysActive,
    totalDaysMissed: daysMissed,
    daysInMonth: totalDays,
    streakConsistencyPercent: totalDays > 0 ? Math.round((daysActive / totalDays) * 100) : 0,
    calendarDays: buildCalendarDays(monthKey, activeDates),

    averageScoreStart: avgStart,
    averageScoreEnd: avgEnd,
    improvementPercent: improvement,
    bestSkill,
    mostImprovedSkill,
    needsWorkSkill,
    skillScoresEnd: skillsEnd,

    levelAtStart: bandStart.band.label,
    levelAtEnd: bandEnd.band.label,
    levelBandStart: bandStart.band,
    levelBandEnd: bandEnd.band,
    levelledUp: bandEnd.index > bandStart.index,
    progressInBand: Math.max(0, Math.min(100, progressInBand)),

    wordsSavedThisMonth: wordsSaved.length,
    wordsMasteredThisMonth: wordsMastered.length,
    totalWordsInList: vocab.length,
    recentlyMasteredWords: recentlyMastered,

    mostPersistentError: errorAnalysis.mostPersistent,
    mostImprovedError: errorAnalysis.mostImproved,
    stillWorkingOnError: errorAnalysis.stillWorking,
    newErrorsThisMonth: errorAnalysis.newErrors,

    grammarWeeksCompleted: grammarWeeksInMonth,
    currentGrammarWeek: curriculum.currentWeek,
    currentGrammarTopic: weekDef.topic,

    highestLessonScore: highestScore,
    longestStreakOverall: longestInMonth,
    mostSessionsInOneWeek: sessionsInWeek(lessons, drills, monthKey),
    mostProductiveDayOfWeek: mostProductiveDayOfWeek(lessons, drills, monthKey),

    javiMessage,
  };
}

export function getFirstActivityDate(lessons: LessonHistoryEntry[], drills: DrillHistoryEntry[]): string | null {
  const dates = [...lessons.map((l) => l.date), ...drills.map((d) => d.date)].sort();
  return dates[0] ?? null;
}

export type WrappedTeaser = {
  daysUntil: number;
  nextWrapLabel: string;
  hasActivity: boolean;
};

export function buildWrappedTeaser(
  lessons: LessonHistoryEntry[],
  drills: DrillHistoryEntry[],
  existingWrapCount: number,
  from: Date = new Date(),
): WrappedTeaser | null {
  if (existingWrapCount > 0) return null;
  const first = getFirstActivityDate(lessons, drills);
  if (!first) {
    return {
      daysUntil: daysUntilNextWrap(from),
      nextWrapLabel: nextMonthFirstDay(from).toLocaleString(undefined, { month: 'long', day: 'numeric' }),
      hasActivity: false,
    };
  }
  return {
    daysUntil: daysUntilNextWrap(from),
    nextWrapLabel: nextMonthFirstDay(from).toLocaleString(undefined, { month: 'long', day: 'numeric' }),
    hasActivity: true,
  };
}
