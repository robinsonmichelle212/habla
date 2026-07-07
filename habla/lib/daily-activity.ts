import { getGemRoundPlayDates } from '@/lib/gem-shop';
import {
  DAY_LETTER_LABELS,
  getDrillHistory,
  getLessonHistory,
  isPlaceholderLesson,
} from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type DailyActivityKind = 'none' | 'lesson' | 'drill' | 'both' | 'gem';

export type DailyActivityDay = {
  date: string;
  dayLetter: string;
  kind: DailyActivityKind;
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Last 7 calendar days ending today — lesson/drill/gem activity for the home screen row. */
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

    const hasLesson = lessons.some((l) => l.date === date && !isPlaceholderLesson(l));
    const hasOfflineLesson = lessons.some((l) => l.date === date && isPlaceholderLesson(l));
    const hasDrill = drills.some((dr) => dr.date === date);
    const hasGem = gemDates.has(date);

    let kind: DailyActivityKind = 'none';
    if (hasLesson && hasDrill) kind = 'both';
    else if (hasLesson || hasOfflineLesson) kind = 'lesson';
    else if (hasDrill) kind = 'drill';
    else if (hasGem) kind = 'gem';

    days.push({ date, dayLetter, kind });
  }

  return days;
}
