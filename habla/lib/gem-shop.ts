import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  canPlayLevel as canPlayLevelInUnlocks,
  getActivePendingUnlock,
  getCompletedLevels,
  highestCompletedLevel,
  isLevelCompletedInUnlocks,
  UNLOCK_WINDOW_MS,
  type ExpiredUnlockNotice,
} from '@/lib/gem-shop-expiry';
import {
  cancelUnlockExpiryWarning,
  scheduleUnlockExpiryWarning,
} from '@/lib/gem-shop-notifications';
import { deductGems, getTotalGems } from '@/lib/gems';
import { getProfileBadges } from '@/lib/profile-badges';

const PROGRESS_KEY = 'gemShopProgress';
const TOTAL_SPENT_KEY = 'gemShopTotalSpent';
const LEGACY_UNLOCKS_KEY = 'gemShopUnlocks';

export type BonusRoundId =
  | 'quiz'
  | 'slang'
  | 'roleplay'
  | 'shadowing'
  | 'culture'
  | 'immersion'
  | 'music'
  | 'film';

export type RoundLevel = 1 | 2 | 3 | 4 | 5;

export const ROUND_LEVELS: RoundLevel[] = [1, 2, 3, 4, 5];

/** Level 1 base cost per round. Levels 2–5 = base × level number. */
export const ROUND_LEVEL1_COSTS: Record<BonusRoundId, number> = {
  quiz: 5,
  slang: 20,
  roleplay: 35,
  shadowing: 45,
  culture: 60,
  immersion: 75,
  music: 90,
  film: 100,
};

export const TOTAL_LEVEL_SLOTS = 8 * 5;

export type BonusRoundDef = {
  id: BonusRoundId;
  name: string;
  emoji: string;
  description: string;
};

export const BONUS_ROUNDS: BonusRoundDef[] = [
  {
    id: 'quiz',
    name: 'Quiz Round',
    emoji: '🧠',
    description: 'Fast-paced Spanish general knowledge quiz. Multiple choice by level.',
  },
  {
    id: 'slang',
    name: 'Slang Round',
    emoji: '🗣️',
    description: 'Real street Spanish — Spain and Argentina slang with drills and conversation.',
  },
  {
    id: 'roleplay',
    name: 'Role Play Round',
    emoji: '🎭',
    description: 'Javi becomes a character. Navigate a Spanish scenario by voice.',
  },
  {
    id: 'shadowing',
    name: 'Shadowing Round',
    emoji: '🗣️',
    description: 'Repeat after Javi — rhythm and pronunciation focus.',
  },
  {
    id: 'culture',
    name: 'Culture Round',
    emoji: '🍕',
    description: 'Cultural deep dive in Spanish — food, festivals, art, history and more.',
  },
  {
    id: 'immersion',
    name: 'Immersion Mode',
    emoji: '🔇',
    description: 'Full lesson with zero translations. Spanish only — for the brave.',
  },
  {
    id: 'music',
    name: 'Music Round',
    emoji: '🎵',
    description: 'Famous Spanish songs — lyrics, vocabulary and cultural context.',
  },
  {
    id: 'film',
    name: 'Film & TV Round',
    emoji: '🎬',
    description: 'Scenes from Spanish film and TV — dialogue, themes and discussion.',
  },
];

export type LevelUnlockRecord = {
  level: RoundLevel;
  unlockedAt: number;
  expiresAt: number;
  completed: boolean;
};

export type RoundProgress = {
  unlocks: LevelUnlockRecord[];
  totalPlays: number;
};

export type UrgentPendingUnlock = {
  roundId: BonusRoundId;
  roundName: string;
  level: RoundLevel;
  expiresAt: number;
};

export { UNLOCK_WINDOW_MS };
export type { ExpiredUnlockNotice } from '@/lib/gem-shop-expiry';

export type GemShopProgress = Record<BonusRoundId, RoundProgress>;

export type GemShopStats = {
  totalGemsSpent: number;
  roundsMastered: number;
  eliteBadgesEarned: number;
  mostPlayedRound: BonusRoundDef | null;
};

export type RoundShopState =
  | { kind: 'mastered' }
  | { kind: 'play'; level: RoundLevel }
  | {
      kind: 'unlock';
      level: RoundLevel;
      cost: number;
      previousCompletedLevel: RoundLevel | null;
    };

export type LevelUnlockTarget = {
  roundId: BonusRoundId;
  level: RoundLevel;
  cost: number;
};

let dismissedAffordableKey: string | null = null;
let pendingExpiredNotices: ExpiredUnlockNotice[] = [];

export function affordableTargetsKey(targets: LevelUnlockTarget[]): string {
  return targets
    .map((t) => `${t.roundId}:${t.level}`)
    .sort()
    .join('|');
}

/** Hide the home gems badge until affordable unlock options change (e.g. new gems earned). */
export function dismissShopBadge(affordable: LevelUnlockTarget[]): void {
  dismissedAffordableKey = affordableTargetsKey(affordable);
}

export function getRoundDef(id: BonusRoundId): BonusRoundDef {
  return BONUS_ROUNDS.find((r) => r.id === id) ?? BONUS_ROUNDS[0];
}

export function getLevelCost(roundId: BonusRoundId, level: RoundLevel): number {
  return ROUND_LEVEL1_COSTS[roundId] * level;
}

export function getRoundLevel1Cost(roundId: BonusRoundId): number {
  return ROUND_LEVEL1_COSTS[roundId];
}

export function parseRoundLevel(value: string | number | undefined): RoundLevel | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

function emptyRoundProgress(): RoundProgress {
  return { unlocks: [], totalPlays: 0 };
}

function normalizeUnlockRecord(raw: unknown): LevelUnlockRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<LevelUnlockRecord>;
  const level = parseRoundLevel(obj.level);
  if (!level) return null;
  const unlockedAt = Math.trunc(Number(obj.unlockedAt) || 0);
  const expiresAt = Math.trunc(Number(obj.expiresAt) || 0);
  return {
    level,
    unlockedAt,
    expiresAt,
    completed: Boolean(obj.completed),
  };
}

function migrateLegacyRoundProgress(raw: unknown): RoundProgress {
  if (!raw || typeof raw !== 'object') return emptyRoundProgress();
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.unlocks)) {
    const unlocks = obj.unlocks
      .map(normalizeUnlockRecord)
      .filter((u): u is LevelUnlockRecord => u != null);
    return {
      unlocks: dedupeUnlockRecords(unlocks),
      totalPlays: Math.max(0, Math.trunc(Number(obj.totalPlays) || 0)),
    };
  }

  const levelsCompleted = Array.isArray(obj.levelsCompleted)
    ? [...new Set(obj.levelsCompleted.filter((n) => typeof n === 'number' && n >= 1 && n <= 5))]
    : [];
  const highestLevel = Math.max(
    0,
    Math.min(5, Math.trunc(Number(obj.highestLevel) || 0)),
    ...(levelsCompleted as number[]),
  );
  const now = Date.now();
  const unlocks: LevelUnlockRecord[] = [];

  for (const level of levelsCompleted as RoundLevel[]) {
    unlocks.push({ level, unlockedAt: now, expiresAt: now, completed: true });
  }
  for (let l = 1; l <= highestLevel; l++) {
    if (!(levelsCompleted as number[]).includes(l)) {
      unlocks.push({
        level: l as RoundLevel,
        unlockedAt: now,
        expiresAt: now,
        completed: true,
      });
    }
  }

  return {
    unlocks: dedupeUnlockRecords(unlocks),
    totalPlays: Math.max(0, Math.trunc(Number(obj.totalPlays) || 0)),
  };
}

function dedupeUnlockRecords(unlocks: LevelUnlockRecord[]): LevelUnlockRecord[] {
  const byLevel = new Map<RoundLevel, LevelUnlockRecord>();
  for (const record of unlocks) {
    const existing = byLevel.get(record.level);
    if (!existing || (record.completed && !existing.completed) || record.unlockedAt > existing.unlockedAt) {
      byLevel.set(record.level, record);
    }
  }
  return [...byLevel.values()].sort((a, b) => a.level - b.level);
}

function applyRoundExpirations(
  roundId: BonusRoundId,
  round: RoundProgress,
  now = Date.now(),
): { round: RoundProgress; expired: ExpiredUnlockNotice[] } {
  const expired: ExpiredUnlockNotice[] = [];
  const kept: LevelUnlockRecord[] = [];

  for (const record of round.unlocks) {
    if (!record.completed && record.expiresAt <= now) {
      expired.push({ roundId, level: record.level });
      void cancelUnlockExpiryWarning(roundId, record.level);
      continue;
    }
    kept.push(record);
  }

  return {
    round: { ...round, unlocks: kept },
    expired,
  };
}

async function resyncUnlockExpiryNotifications(progress: GemShopProgress): Promise<void> {
  const now = Date.now();
  for (const round of BONUS_ROUNDS) {
    const pending = getActivePendingUnlock(progress[round.id].unlocks, now);
    if (pending) {
      await scheduleUnlockExpiryWarning(round.id, pending.level, pending.expiresAt);
    }
  }
}

function emptyProgress(): GemShopProgress {
  return {
    quiz: emptyRoundProgress(),
    slang: emptyRoundProgress(),
    roleplay: emptyRoundProgress(),
    shadowing: emptyRoundProgress(),
    culture: emptyRoundProgress(),
    immersion: emptyRoundProgress(),
    music: emptyRoundProgress(),
    film: emptyRoundProgress(),
  };
}

function normalizeRoundProgress(raw: unknown): RoundProgress {
  return migrateLegacyRoundProgress(raw);
}

async function migrateLegacyUnlocks(progress: GemShopProgress): Promise<GemShopProgress> {
  const raw = await AsyncStorage.getItem(LEGACY_UNLOCKS_KEY);
  if (!raw) return progress;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return progress;
    const next = { ...progress };
    for (const entry of parsed) {
      const roundId = entry?.roundId as BonusRoundId | undefined;
      if (!roundId || !(roundId in next)) continue;
      const existing = next[roundId];
      if (existing.unlocks.some((u) => u.level === 1)) continue;
      const now = Date.now();
      next[roundId] = {
        unlocks: [
          ...existing.unlocks,
          { level: 1, unlockedAt: now, expiresAt: now, completed: true },
        ],
        totalPlays: Math.max(existing.totalPlays, entry.playCount ?? 0),
      };
    }
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    await AsyncStorage.removeItem(LEGACY_UNLOCKS_KEY);
    return next;
  } catch {
    return progress;
  }
}

export function takeExpiredNotices(): ExpiredUnlockNotice[] {
  const notices = pendingExpiredNotices;
  pendingExpiredNotices = [];
  return notices;
}

export async function getGemShopProgress(): Promise<GemShopProgress> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  let progress = emptyProgress();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<GemShopProgress>;
      for (const round of BONUS_ROUNDS) {
        progress[round.id] = normalizeRoundProgress(parsed[round.id]);
      }
    } catch {
      progress = emptyProgress();
    }
  }
  progress = await migrateLegacyUnlocks(progress);

  const now = Date.now();
  let changed = false;
  const allExpired: ExpiredUnlockNotice[] = [];
  const next = { ...progress };

  for (const round of BONUS_ROUNDS) {
    const { round: cleaned, expired } = applyRoundExpirations(round.id, next[round.id], now);
    if (expired.length || cleaned.unlocks.length !== next[round.id].unlocks.length) {
      changed = true;
      next[round.id] = cleaned;
      allExpired.push(...expired);
    }
  }

  if (changed) {
    await saveProgress(next);
    pendingExpiredNotices.push(...allExpired);
    progress = next;
  }

  await resyncUnlockExpiryNotifications(progress);
  return progress;
}

async function saveProgress(progress: GemShopProgress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export async function getTotalGemsSpent(): Promise<number> {
  const spentRaw = await AsyncStorage.getItem(TOTAL_SPENT_KEY);
  return spentRaw ? Math.max(0, parseInt(spentRaw, 10) || 0) : 0;
}

/** @deprecated Use getGemShopProgress — kept for compatibility */
export async function getGemShopHistory(): Promise<{
  unlocks: { roundId: BonusRoundId; playCount: number }[];
  totalGemsSpent: number;
}> {
  const [progress, totalGemsSpent] = await Promise.all([getGemShopProgress(), getTotalGemsSpent()]);
  return {
    totalGemsSpent,
    unlocks: BONUS_ROUNDS.map((r) => ({
      roundId: r.id,
      playCount: progress[r.id].totalPlays,
    })),
  };
}

export function isLevelPlayable(
  progress: GemShopProgress,
  roundId: BonusRoundId,
  level: RoundLevel,
  now = Date.now(),
): boolean {
  return canPlayLevelInUnlocks(progress[roundId].unlocks, level, now);
}

/** @deprecated Use isLevelPlayable */
export function isLevelUnlocked(
  progress: GemShopProgress,
  roundId: BonusRoundId,
  level: RoundLevel,
  now = Date.now(),
): boolean {
  return isLevelPlayable(progress, roundId, level, now);
}

export function isLevelCompleted(progress: GemShopProgress, roundId: BonusRoundId, level: RoundLevel): boolean {
  return isLevelCompletedInUnlocks(progress[roundId].unlocks, level);
}

export function getNextUnlockLevel(
  progress: GemShopProgress,
  roundId: BonusRoundId,
  now = Date.now(),
): RoundLevel | null {
  if (getActivePendingUnlock(progress[roundId].unlocks, now)) return null;
  const next = (highestCompletedLevel(progress[roundId].unlocks) + 1) as RoundLevel;
  return next <= 5 ? next : null;
}

export function isRoundMastered(progress: GemShopProgress, roundId: BonusRoundId): boolean {
  return isLevelCompleted(progress, roundId, 5);
}

export function countMasteredRounds(progress: GemShopProgress): number {
  return BONUS_ROUNDS.reduce((count, round) => count + (isRoundMastered(progress, round.id) ? 1 : 0), 0);
}

export function getRoundShopState(
  progress: GemShopProgress,
  roundId: BonusRoundId,
  now = Date.now(),
): RoundShopState {
  if (isRoundMastered(progress, roundId)) {
    return { kind: 'mastered' };
  }

  const pending = getActivePendingUnlock(progress[roundId].unlocks, now);
  if (pending) {
    return { kind: 'play', level: pending.level };
  }

  const next = getNextUnlockLevel(progress, roundId, now);
  if (!next) {
    return { kind: 'mastered' };
  }

  const previousCompletedLevel =
    next > 1 && isLevelCompleted(progress, roundId, (next - 1) as RoundLevel)
      ? ((next - 1) as RoundLevel)
      : null;

  return {
    kind: 'unlock',
    level: next,
    cost: getLevelCost(roundId, next),
    previousCompletedLevel,
  };
}

export function canAffordRoundNextLevel(
  progress: GemShopProgress,
  roundId: BonusRoundId,
  gems: number,
  now = Date.now(),
): boolean {
  const state = getRoundShopState(progress, roundId, now);
  return state.kind === 'unlock' && gems >= state.cost;
}

export function countUnlockedLevels(progress: GemShopProgress, now = Date.now()): number {
  return BONUS_ROUNDS.reduce((sum, r) => {
    const round = progress[r.id];
    const completed = getCompletedLevels(round.unlocks).length;
    const pending = getActivePendingUnlock(round.unlocks, now) ? 1 : 0;
    return sum + completed + pending;
  }, 0);
}

export function getUrgentPendingUnlock(
  progress: GemShopProgress,
  now = Date.now(),
): UrgentPendingUnlock | null {
  let best: UrgentPendingUnlock | null = null;

  for (const round of BONUS_ROUNDS) {
    const pending = getActivePendingUnlock(progress[round.id].unlocks, now);
    if (!pending) continue;
    const candidate: UrgentPendingUnlock = {
      roundId: round.id,
      roundName: round.name,
      level: pending.level,
      expiresAt: pending.expiresAt,
    };
    if (!best || candidate.expiresAt < best.expiresAt) {
      best = candidate;
    }
  }

  return best;
}

export async function isRoundUnlocked(roundId: BonusRoundId): Promise<boolean> {
  const progress = await getGemShopProgress();
  return progress[roundId].unlocks.some((u) => u.completed || u.expiresAt > Date.now());
}

export async function isRoundLevelPlayable(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<boolean> {
  const progress = await getGemShopProgress();
  return isLevelPlayable(progress, roundId, level);
}

/** @deprecated Use isRoundLevelPlayable */
export async function isRoundLevelUnlocked(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<boolean> {
  return isRoundLevelPlayable(roundId, level);
}

export async function purchaseLevel(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<{ success: boolean; error?: string; gemsRemaining?: number }> {
  const progress = await getGemShopProgress();
  const nextLevel = getNextUnlockLevel(progress, roundId);

  if (isLevelPlayable(progress, roundId, level)) {
    return { success: true, gemsRemaining: await getTotalGems() };
  }

  if (nextLevel !== level) {
    return { success: false, error: 'Unlock previous level first' };
  }

  const cost = getLevelCost(roundId, level);
  const result = await deductGems(cost);
  if (!result.success) {
    return { success: false, error: 'Not enough gems' };
  }

  const now = Date.now();
  const record: LevelUnlockRecord = {
    level,
    unlockedAt: now,
    expiresAt: now + UNLOCK_WINDOW_MS,
    completed: false,
  };

  const updated = { ...progress };
  const round = updated[roundId];
  updated[roundId] = {
    ...round,
    unlocks: [...round.unlocks.filter((u) => u.level !== level), record],
  };
  await saveProgress(updated);
  await scheduleUnlockExpiryWarning(roundId, level, record.expiresAt);

  const spent = await getTotalGemsSpent();
  await AsyncStorage.setItem(TOTAL_SPENT_KEY, String(spent + cost));

  return { success: true, gemsRemaining: result.total };
}

/** @deprecated Use purchaseLevel */
export async function purchaseRound(roundId: BonusRoundId) {
  return purchaseLevel(roundId, 1);
}

export async function recordRoundPlayed(roundId: BonusRoundId, level: RoundLevel): Promise<void> {
  const progress = await getGemShopProgress();
  const round = progress[roundId];
  progress[roundId] = {
    ...round,
    totalPlays: round.totalPlays + 1,
  };
  await saveProgress(progress);
}

export async function recordLevelCompleted(roundId: BonusRoundId, level: RoundLevel): Promise<void> {
  const progress = await getGemShopProgress();
  const round = progress[roundId];
  const existing = round.unlocks.find((u) => u.level === level);
  const now = Date.now();

  const updatedRecord: LevelUnlockRecord = existing
    ? { ...existing, completed: true }
    : { level, unlockedAt: now, expiresAt: now, completed: true };

  progress[roundId] = {
    ...round,
    unlocks: [...round.unlocks.filter((u) => u.level !== level), updatedRecord],
  };
  await saveProgress(progress);
  await cancelUnlockExpiryWarning(roundId, level);
}

export async function getGemShopStats(): Promise<GemShopStats> {
  const [progress, totalGemsSpent, badges] = await Promise.all([
    getGemShopProgress(),
    getTotalGemsSpent(),
    getProfileBadges(),
  ]);

  const eliteBadgesEarned = badges.filter((b) => b.id.startsWith('elite-')).length;
  let mostPlayed: BonusRoundDef | null = null;
  let maxPlays = 0;
  for (const round of BONUS_ROUNDS) {
    const plays = progress[round.id].totalPlays;
    if (plays > maxPlays) {
      maxPlays = plays;
      mostPlayed = round;
    }
  }

  return {
    totalGemsSpent,
    roundsMastered: countMasteredRounds(progress),
    eliteBadgesEarned,
    mostPlayedRound: mostPlayed,
  };
}

export async function getAffordableNextLevels(gemTotal: number): Promise<LevelUnlockTarget[]> {
  const progress = await getGemShopProgress();
  const targets: LevelUnlockTarget[] = [];

  for (const round of BONUS_ROUNDS) {
    const next = getNextUnlockLevel(progress, round.id);
    if (!next) continue;
    const cost = getLevelCost(round.id, next);
    if (cost <= gemTotal) {
      targets.push({ roundId: round.id, level: next, cost });
    }
  }

  return targets.sort((a, b) => a.cost - b.cost);
}

/** @deprecated Use getAffordableNextLevels */
export async function getAffordableLockedRounds(gemTotal: number): Promise<BonusRoundDef[]> {
  const targets = await getAffordableNextLevels(gemTotal);
  const ids = new Set(targets.map((t) => t.roundId));
  return BONUS_ROUNDS.filter((r) => ids.has(r.id));
}

export function shouldShowShopBadge(affordable: LevelUnlockTarget[]): boolean {
  if (affordable.length === 0) return false;
  if (!dismissedAffordableKey) return true;
  return affordableTargetsKey(affordable) !== dismissedAffordableKey;
}

export function eliteBadgeId(roundId: BonusRoundId): string {
  return `elite-${roundId}`;
}

export function eliteBadgeLabel(roundId: BonusRoundId): string {
  return `Elite ${getRoundDef(roundId).name}`;
}
