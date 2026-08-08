import { getGemRoundPlayDates } from '@/lib/gem-shop';
import { mondayOfWeek } from '@/lib/lesson-type-nudge';
import {
  DAY_LETTER_LABELS,
  getDrillHistory,
  getLessonHistory,
  isPlaceholderLesson,
  isStreakSessionLesson,
} from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type DailyActivityKind = 'none' | 'lesson' | 'drill' | 'both' | 'spark' | 'gem';

export type DailyActivityDay = {
  date: string;
  dayLetter: string;
  kind: DailyActivityKind;
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Last 7 calendar days ending today — lesson/drill/streak-session/gem activity for the home screen row. */
export async function getLast7DaysActivity(
  today: string = formatLocalDate(),
): Promise<DailyActivityDay[]> {
  const [lessons, drills, gemDates] = await Promise.all([
    getLessonHistory(),
    getDrillHistory(),
    getGemRoundPlayDates(),
  ]);

  const end = parseLocalDate(today);
  const days: DailyActivityDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const date = formatLocalDate(d);
    const dayLetter = DAY_LETTER_LABELS[d.getDay()];

    const hasLesson = lessons.some(
      (l) => l.date === date && !isStreakSessionLesson(l) && !isPlaceholderLesson(l),
    );
    const hasOfflineLesson = lessons.some(
      (l) => l.date === date && isPlaceholderLesson(l) && !isStreakSessionLesson(l),
    );
    const hasStreakSession = lessons.some((l) => l.date === date && isStreakSessionLesson(l));
    const hasDrill = drills.some((dr) => dr.date === date);
    const hasGem = gemDates.has(date);

    let kind: DailyActivityKind = 'none';
    if (hasLesson && hasDrill) kind = 'both';
    else if (hasLesson || hasOfflineLesson) kind = 'lesson';
    else if (hasDrill) kind = 'drill';
    else if (hasStreakSession) kind = 'spark'; // internal kind id — renders ⚡ streak session
    else if (hasGem) kind = 'gem';

    days.push({ date, dayLetter, kind });
  }

  return days;
}

export type WeeklyActivitySummary = {
  fullLessons: number;
  drills: number;
  /** Streak-session days this week (legacy field name `sparks`). */
  sparks: number;
  streakSessions: number;
};

/** Honest weekly accounting for Progress: full lessons · drills · streak sessions. */
export async function getWeeklyActivitySummary(
  today: Date = new Date(),
): Promise<WeeklyActivitySummary> {
  const monday = mondayOfWeek(today);
  const [lessons, drills] = await Promise.all([getLessonHistory(), getDrillHistory()]);

  const lessonDates = new Set<string>();
  const streakSessionDates = new Set<string>();
  for (const e of lessons) {
    if (e.date < monday) continue;
    if (isStreakSessionLesson(e)) {
      streakSessionDates.add(e.date);
      continue;
    }
    if (!isPlaceholderLesson(e)) lessonDates.add(e.date);
  }

  const drillDates = new Set(drills.filter((d) => d.date >= monday).map((d) => d.date));
  const streakSessions = streakSessionDates.size;

  return {
    fullLessons: lessonDates.size,
    drills: drillDates.size,
    sparks: streakSessions,
    streakSessions,
  };
}
