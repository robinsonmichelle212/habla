import { mondayOfWeek } from '@/lib/lesson-type-nudge';
import {
  getLessonHistory,
  isPlaceholderLesson,
  isStreakSessionLesson,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { SKILL_KEYS, type SkillKey } from '@/lib/score-history';
import { daysBetween, formatLocalDate } from '@/lib/streak';

export type SkillScores = {
  grammar: number;
  vocabulary: number;
  fluency: number;
  writing: number;
};

export type ScoredSession = {
  date: string;
  scores: SkillScores;
};

export type WeeklyAverage = {
  weekStart: string;
  weekEnd: string;
  averages: SkillScores;
  sessionCount: number;
};

export type OutlierSession = ScoredSession & { reason: string };

export type WeekOverWeekChange = {
  skill: keyof SkillScores;
  previous: number;
  current: number;
  change: number;
};

const OUTLIER_DROP_POINTS = 15;
const TRAILING_WINDOW_DAYS = 7;
const MIN_EVALUABLE_SKILLS = 2;

const OUTLIER_REASON =
  'All four skills dropped over 15 points below your recent average — likely an off day, not a decline';

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function skillScore(entry: LessonHistoryEntry, skill: SkillKey): number | null {
  const section = entry.breakdown[skill];
  if (!section || typeof section.score !== 'number' || !Number.isFinite(section.score)) {
    return null;
  }
  return clampScore(section.score);
}

function toScoredSession(entry: LessonHistoryEntry): ScoredSession | null {
  if (isPlaceholderLesson(entry) || isStreakSessionLesson(entry)) return null;
  const grammar = skillScore(entry, 'grammar');
  const vocabulary = skillScore(entry, 'vocabulary');
  const fluency = skillScore(entry, 'fluency');
  const writing = skillScore(entry, 'writing');
  if (grammar == null || vocabulary == null || fluency == null || writing == null) return null;
  return {
    date: entry.date,
    scores: { grammar, vocabulary, fluency, writing },
  };
}

export function scoredSessionsFromLessonHistory(lessons: LessonHistoryEntry[]): ScoredSession[] {
  return lessons
    .map((entry) => toScoredSession(entry))
    .filter((session): session is ScoredSession => session != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Same AsyncStorage `lessonHistory` parse as the rest of the app (`getLessonHistory`). */
export async function getScoredSessions(): Promise<ScoredSession[]> {
  return scoredSessionsFromLessonHistory(await getLessonHistory());
}

function averageScores(sessions: ScoredSession[]): SkillScores | null {
  if (sessions.length === 0) return null;
  const sums: SkillScores = { grammar: 0, vocabulary: 0, fluency: 0, writing: 0 };
  for (const session of sessions) {
    for (const skill of SKILL_KEYS) {
      sums[skill] += session.scores[skill];
    }
  }
  const n = sessions.length;
  return {
    grammar: sums.grammar / n,
    vocabulary: sums.vocabulary / n,
    fluency: sums.fluency / n,
    writing: sums.writing / n,
  };
}

function roundScores(scores: SkillScores): SkillScores {
  return {
    grammar: Math.round(scores.grammar),
    vocabulary: Math.round(scores.vocabulary),
    fluency: Math.round(scores.fluency),
    writing: Math.round(scores.writing),
  };
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function sundayOfWeek(weekStart: string): string {
  const monday = parseLocalDate(weekStart);
  monday.setDate(monday.getDate() + 6);
  return formatLocalDate(monday);
}

function sessionKey(session: ScoredSession): string {
  const { date, scores } = session;
  return `${date}:${scores.grammar}:${scores.vocabulary}:${scores.fluency}:${scores.writing}`;
}

export function isOutlierSession(
  session: ScoredSession,
  trailingAverages: SkillScores,
): boolean {
  let evaluated = 0;
  for (const skill of SKILL_KEYS) {
    const trailing = trailingAverages[skill];
    if (typeof trailing !== 'number' || !Number.isFinite(trailing)) continue;
    evaluated += 1;
    if (!(session.scores[skill] < trailing - OUTLIER_DROP_POINTS)) {
      return false;
    }
  }
  return evaluated >= MIN_EVALUABLE_SKILLS;
}

export function getTrailingAverage(
  sessions: ScoredSession[],
  beforeDate: string,
  windowDays: number,
): SkillScores | null {
  const inWindow = sessions.filter((session) => {
    const gap = daysBetween(session.date, beforeDate);
    return gap >= 1 && gap <= windowDays;
  });
  return averageScores(inWindow);
}

export function flagOutliers(sessions: ScoredSession[]): OutlierSession[] {
  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const flagged: OutlierSession[] = [];

  for (const session of chronological) {
    const trailing = getTrailingAverage(chronological, session.date, TRAILING_WINDOW_DAYS);
    if (!trailing) continue;
    if (isOutlierSession(session, trailing)) {
      flagged.push({ ...session, reason: OUTLIER_REASON });
    }
  }

  return flagged;
}

export function getWeeklyAverages(
  sessions: ScoredSession[],
  excludeOutliers: OutlierSession[],
): WeeklyAverage[] {
  const excluded = new Set(excludeOutliers.map((session) => sessionKey(session)));
  const byWeek = new Map<string, ScoredSession[]>();

  for (const session of sessions) {
    if (excluded.has(sessionKey(session))) continue;
    const weekStart = mondayOfWeek(parseLocalDate(session.date));
    const list = byWeek.get(weekStart) ?? [];
    list.push(session);
    byWeek.set(weekStart, list);
  }

  const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
  const result: WeeklyAverage[] = [];

  for (const [weekStart, weekSessions] of weeks) {
    const averages = averageScores(weekSessions);
    if (!averages) continue;
    result.push({
      weekStart,
      weekEnd: sundayOfWeek(weekStart),
      averages: roundScores(averages),
      sessionCount: weekSessions.length,
    });
  }

  return result;
}

export function getWeekOverWeekChange(
  weeklyAverages: WeeklyAverage[],
): WeekOverWeekChange[] | null {
  if (weeklyAverages.length < 2) return null;
  const previous = weeklyAverages[weeklyAverages.length - 2];
  const current = weeklyAverages[weeklyAverages.length - 1];

  return SKILL_KEYS.map((skill) => {
    const prev = Math.round(previous.averages[skill]);
    const curr = Math.round(current.averages[skill]);
    return {
      skill,
      previous: prev,
      current: curr,
      change: curr - prev,
    };
  });
}
