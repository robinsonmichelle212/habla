import AsyncStorage from '@react-native-async-storage/async-storage';

import { addGems, deductGems } from '@/lib/gems';
import {
  getDrillHistory,
  getLessonHistory,
  isStreakSessionLesson,
} from '@/lib/practice-storage';
import { formatLocalDate, getStreakState } from '@/lib/streak';

export type RescueStatus = 'none' | 'pending' | 'expired';

export type RescueState = {
  status: RescueStatus;
  missedDate: string | null;
  deadline: string | null;
  gemsCost: number;
  purchasedAt: string | null;
  /** currentStreak as stored at purchase time (before any miss-reset). */
  streakAtPurchase: number | null;
};

export type RescueHistoryEntry = {
  redeemedAt: string;
  missedDateSaved: string;
};

export type RescueEligibility = {
  eligible: boolean;
  daysCompleted: number;
  daysNeeded: number;
  onCooldown: boolean;
  cooldownDaysRemaining: number;
};

const RESCUE_STATE_KEY = 'habla.streakRescue.v1';
const RESCUE_HISTORY_KEY = 'habla.streakRescueHistory.v1';

export const STREAK_RESCUE_COST_GEMS = 150;
export const RESCUE_ELIGIBILITY_WINDOW_DAYS = 30;
export const RESCUE_ELIGIBILITY_THRESHOLD_DAYS = 14;
export const RESCUE_REDEMPTION_COOLDOWN_DAYS = 30;

function emptyRescueState(): RescueState {
  return {
    status: 'none',
    missedDate: null,
    deadline: null,
    gemsCost: STREAK_RESCUE_COST_GEMS,
    purchasedAt: null,
    streakAtPurchase: null,
  };
}

/** Interpret YYYY-MM-DD as a local calendar date (same approach as lib/streak.ts). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  const ms = db.getTime() - da.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function addLocalDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function isYyyyMmDd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Deadline is stored as YYYY-MM-DD of the calendar day AFTER the miss.
 * Comparison is date-only (`today <= deadline`); that date includes local 23:59:59.
 */
function deadlineForMissedDate(missedDate: string): string {
  return addLocalDays(missedDate, 1);
}

function isWithinTrailingWindow(dateStr: string, today: string): boolean {
  if (!isYyyyMmDd(dateStr)) return false;
  const gap = daysBetween(dateStr, today);
  return gap >= 0 && gap < RESCUE_ELIGIBILITY_WINDOW_DAYS;
}

function normalizeRescueState(raw: unknown): RescueState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<RescueState>;
  const status = obj.status;
  if (status !== 'none' && status !== 'pending' && status !== 'expired') return null;
  const missedDate =
    typeof obj.missedDate === 'string' && isYyyyMmDd(obj.missedDate) ? obj.missedDate : null;
  const deadline =
    typeof obj.deadline === 'string' && isYyyyMmDd(obj.deadline) ? obj.deadline : null;
  const purchasedAt =
    typeof obj.purchasedAt === 'string' && isYyyyMmDd(obj.purchasedAt) ? obj.purchasedAt : null;
  const gemsCost =
    typeof obj.gemsCost === 'number' && Number.isFinite(obj.gemsCost)
      ? Math.max(0, Math.trunc(obj.gemsCost))
      : STREAK_RESCUE_COST_GEMS;
  const streakAtPurchase =
    typeof obj.streakAtPurchase === 'number' && Number.isFinite(obj.streakAtPurchase)
      ? Math.max(0, Math.trunc(obj.streakAtPurchase))
      : null;
  return { status, missedDate, deadline, gemsCost, purchasedAt, streakAtPurchase };
}

function normalizeHistoryEntry(raw: unknown): RescueHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<RescueHistoryEntry>;
  if (typeof obj.redeemedAt !== 'string' || !isYyyyMmDd(obj.redeemedAt)) return null;
  if (typeof obj.missedDateSaved !== 'string' || !isYyyyMmDd(obj.missedDateSaved)) return null;
  return { redeemedAt: obj.redeemedAt, missedDateSaved: obj.missedDateSaved };
}

async function readRescueHistory(): Promise<RescueHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(RESCUE_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeHistoryEntry(item))
      .filter((entry): entry is RescueHistoryEntry => entry != null);
  } catch {
    return [];
  }
}

async function saveRescueState(state: RescueState): Promise<void> {
  await AsyncStorage.setItem(RESCUE_STATE_KEY, JSON.stringify(state));
}

/**
 * Distinct calendar days in the trailing window that came from a full lesson
 * (`lessonHistory` / persistLessonComplete) or a practice drill (`drillHistory` /
 * recordQuickFirePractice). Spark / streak-session rows are excluded.
 */
export async function getQualifyingDaysInTrailingWindow(): Promise<number> {
  const today = formatLocalDate();
  const dates = new Set<string>();

  const lessons = await getLessonHistory();
  for (const entry of lessons) {
    if (!isWithinTrailingWindow(entry.date, today)) continue;
    if (isStreakSessionLesson(entry)) continue;
    dates.add(entry.date);
  }

  // Practice drills are stored on `drillHistory`, not `lessonHistory`.
  const drills = await getDrillHistory();
  for (const entry of drills) {
    if (!isWithinTrailingWindow(entry.date, today)) continue;
    dates.add(entry.date);
  }

  return dates.size;
}

export async function getLastRedemptionDate(): Promise<string | null> {
  const history = await readRescueHistory();
  if (history.length === 0) return null;
  let latest = history[0].redeemedAt;
  for (let i = 1; i < history.length; i++) {
    if (history[i].redeemedAt > latest) latest = history[i].redeemedAt;
  }
  return latest;
}

export async function isEligibleForRescue(): Promise<RescueEligibility> {
  const today = formatLocalDate();
  const daysCompleted = await getQualifyingDaysInTrailingWindow();
  const daysNeeded = Math.max(0, RESCUE_ELIGIBILITY_THRESHOLD_DAYS - daysCompleted);

  const lastRedemption = await getLastRedemptionDate();
  let onCooldown = false;
  let cooldownDaysRemaining = 0;
  if (lastRedemption) {
    const elapsed = daysBetween(lastRedemption, today);
    if (elapsed < RESCUE_REDEMPTION_COOLDOWN_DAYS) {
      onCooldown = true;
      cooldownDaysRemaining = RESCUE_REDEMPTION_COOLDOWN_DAYS - elapsed;
    }
  }

  return {
    eligible: daysCompleted >= RESCUE_ELIGIBILITY_THRESHOLD_DAYS && !onCooldown,
    daysCompleted,
    daysNeeded,
    onCooldown,
    cooldownDaysRemaining,
  };
}

export async function getCurrentRescueState(): Promise<RescueState> {
  const raw = await AsyncStorage.getItem(RESCUE_STATE_KEY);
  if (!raw) return emptyRescueState();
  try {
    const parsed = normalizeRescueState(JSON.parse(raw));
    return parsed ?? emptyRescueState();
  } catch {
    return emptyRescueState();
  }
}

export async function purchaseRescue(
  missedDate: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isYyyyMmDd(missedDate)) {
    return { success: false, error: 'invalid_missed_date' };
  }

  const eligibility = await isEligibleForRescue();
  if (!eligibility.eligible) {
    return { success: false, error: 'not_eligible' };
  }

  const current = await getCurrentRescueState();
  if (current.status === 'pending') {
    return { success: false, error: 'already_pending' };
  }

  const deducted = await deductGems(STREAK_RESCUE_COST_GEMS);
  if (!deducted.success) {
    return { success: false, error: 'insufficient_gems' };
  }

  const today = formatLocalDate();
  const streak = await getStreakState();
  const next: RescueState = {
    status: 'pending',
    missedDate,
    deadline: deadlineForMissedDate(missedDate),
    gemsCost: STREAK_RESCUE_COST_GEMS,
    purchasedAt: today,
    streakAtPurchase: streak.currentStreak,
  };
  await saveRescueState(next);
  return { success: true };
}

export async function resolveRescueOnLessonComplete(): Promise<{
  resolved: boolean;
  streakRestored?: number;
  streakAtPurchase?: number;
  missedDate?: string;
}> {
  const state = await getCurrentRescueState();
  if (state.status !== 'pending' || !state.deadline || !state.missedDate) {
    return { resolved: false };
  }

  const today = formatLocalDate();
  if (today > state.deadline) {
    return { resolved: false };
  }

  const streakAtPurchase =
    state.streakAtPurchase ?? (await getStreakState()).currentStreak;

  const history = await readRescueHistory();
  history.push({ redeemedAt: today, missedDateSaved: state.missedDate });
  await AsyncStorage.setItem(RESCUE_HISTORY_KEY, JSON.stringify(history));
  await saveRescueState(emptyRescueState());
  return {
    resolved: true,
    streakAtPurchase,
    missedDate: state.missedDate,
    streakRestored: streakAtPurchase + 1,
  };
}

export async function expireRescueIfPastDeadline(): Promise<{
  expired: boolean;
  gemsRefunded?: number;
}> {
  const state = await getCurrentRescueState();
  if (state.status !== 'pending' || !state.deadline) {
    return { expired: false };
  }

  const today = formatLocalDate();
  if (today <= state.deadline) {
    return { expired: false };
  }

  await addGems(STREAK_RESCUE_COST_GEMS);
  await saveRescueState(emptyRescueState());
  return { expired: true, gemsRefunded: STREAK_RESCUE_COST_GEMS };
}
