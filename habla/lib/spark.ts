import {
  askJaviSparkReply,
} from '@/lib/claude';
import { syncStreakReminder } from '@/lib/streak-notifications';
import {
  upsertLessonHistoryEntry,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { formatLocalDate, recordSparkCompleted, type StreakState } from '@/lib/streak';

export type SparkTimeOfDay = 'morning' | 'lunch' | 'afternoon' | 'evening';

const OPENINGS: Record<SparkTimeOfDay, string> = {
  morning: '¿Cómo amaneciste hoy?',
  lunch: '¿Qué has comido hoy?',
  afternoon: '¿Cómo va el día?',
  evening: '¿Cómo estuvo tu día?',
};

const FALLBACK_CLOSING = 'Bien dicho. Hasta mañana. 🔥';

export function sparkTimeOfDay(now: Date = new Date()): SparkTimeOfDay {
  const hour = now.getHours();
  if (hour < 11) return 'morning';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function sparkOpeningSpanish(now: Date = new Date()): string {
  return OPENINGS[sparkTimeOfDay(now)];
}

export async function getSparkClosingReply(
  userMessage: string,
  openingSpanish: string,
): Promise<string> {
  const trimmed = userMessage.trim();
  if (!trimmed) return FALLBACK_CLOSING;
  try {
    const reply = await askJaviSparkReply(trimmed, openingSpanish);
    return reply.trim() || FALLBACK_CLOSING;
  } catch {
    return FALLBACK_CLOSING;
  }
}

function emptyStreakSessionBreakdown(): LessonHistoryEntry['breakdown'] {
  return {
    grammar: { score: 0, topic: 'Streak session', details: [] },
    vocabulary: { score: 0, topic: 'Streak session', details: [] },
    fluency: { score: 0, details: [] },
    writing: { score: 0, details: [] },
  };
}

export function createSparkHistoryEntry(date: string = formatLocalDate()): LessonHistoryEntry {
  return {
    date,
    lessonType: 'streak_session',
    type: 'streak_session',
    completed: true,
    streakSession: true,
    // Legacy flag for dual-read during migration.
    spark: true,
    overallScore: null,
    breakdown: emptyStreakSessionBreakdown(),
    weakAreas: [],
    focusAreas: [],
  };
}

export type SparkCompleteResult = {
  streak: StreakState;
};

/** Persist streak-session day: streak only — no gems, XP, scores, or milestones. */
export async function completeSparkSession(
  date: string = formatLocalDate(),
): Promise<SparkCompleteResult> {
  await upsertLessonHistoryEntry(createSparkHistoryEntry(date));
  const { state } = await recordSparkCompleted(date);
  await syncStreakReminder().catch(() => {});
  return { streak: state };
}
