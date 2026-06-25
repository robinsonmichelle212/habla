import type { BonusRoundId, LevelUnlockRecord, RoundLevel } from '@/lib/gem-shop';

export const UNLOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ExpiryUrgency = 'normal' | 'amber' | 'red';

export type ExpiredUnlockNotice = {
  roundId: BonusRoundId;
  level: RoundLevel;
};

export function formatExpiryCountdown(expiresAt: number, now = Date.now()): string {
  const ms = Math.max(0, expiresAt - now);
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} min${mins === 1 ? '' : 's'}`;
}

export function formatExpiryCountdownShort(expiresAt: number, now = Date.now()): string {
  const ms = Math.max(0, expiresAt - now);
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${mins} min${mins === 1 ? '' : 's'}`;
}

export function getExpiryUrgency(expiresAt: number, now = Date.now()): ExpiryUrgency {
  const ms = Math.max(0, expiresAt - now);
  if (ms < 60 * 60 * 1000) return 'red';
  if (ms < 6 * 60 * 60 * 1000) return 'amber';
  return 'normal';
}

export function isUnlockRecordActive(record: LevelUnlockRecord, now = Date.now()): boolean {
  return !record.completed && record.expiresAt > now;
}

export function getActivePendingUnlock(
  unlocks: LevelUnlockRecord[],
  now = Date.now(),
): LevelUnlockRecord | null {
  return unlocks.find((u) => isUnlockRecordActive(u, now)) ?? null;
}

export function getCompletedLevels(unlocks: LevelUnlockRecord[]): RoundLevel[] {
  return unlocks
    .filter((u) => u.completed)
    .map((u) => u.level)
    .sort((a, b) => a - b);
}

export function highestCompletedLevel(unlocks: LevelUnlockRecord[]): number {
  const completed = getCompletedLevels(unlocks);
  return completed.length ? completed[completed.length - 1] : 0;
}

export function isLevelCompletedInUnlocks(unlocks: LevelUnlockRecord[], level: RoundLevel): boolean {
  return unlocks.some((u) => u.level === level && u.completed);
}

export function canPlayLevel(unlocks: LevelUnlockRecord[], level: RoundLevel, now = Date.now()): boolean {
  if (isLevelCompletedInUnlocks(unlocks, level)) return true;
  const pending = getActivePendingUnlock(unlocks, now);
  return pending?.level === level;
}

export function getLevelUnlockRecord(
  unlocks: LevelUnlockRecord[],
  level: RoundLevel,
): LevelUnlockRecord | null {
  return unlocks.find((u) => u.level === level) ?? null;
}
