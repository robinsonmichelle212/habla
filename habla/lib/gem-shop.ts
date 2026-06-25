import AsyncStorage from '@react-native-async-storage/async-storage';

import { deductGems, getTotalGems } from '@/lib/gems';
import { getProfileBadges } from '@/lib/profile-badges';
import { formatLocalDate } from '@/lib/streak';

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

export type RoundProgress = {
  highestLevel: number;
  levelsCompleted: number[];
  totalPlays: number;
};

export type GemShopProgress = Record<BonusRoundId, RoundProgress>;

export type GemShopStats = {
  totalGemsSpent: number;
  roundsUnlocked: number;
  eliteBadgesEarned: number;
  mostPlayedRound: BonusRoundDef | null;
};

export type LevelUnlockTarget = {
  roundId: BonusRoundId;
  level: RoundLevel;
  cost: number;
};

let shopBadgeDismissedSession = false;

export function dismissShopBadgeForSession(): void {
  shopBadgeDismissedSession = true;
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
  return { highestLevel: 0, levelsCompleted: [], totalPlays: 0 };
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
  if (!raw || typeof raw !== 'object') return emptyRoundProgress();
  const obj = raw as Partial<RoundProgress>;
  const levelsCompleted = Array.isArray(obj.levelsCompleted)
    ? [...new Set(obj.levelsCompleted.filter((n) => n >= 1 && n <= 5))]
    : [];
  const highestLevel = Math.max(
    0,
    Math.min(5, Math.trunc(Number(obj.highestLevel) || 0)),
    ...levelsCompleted,
  );
  return {
    highestLevel,
    levelsCompleted: levelsCompleted.sort((a, b) => a - b),
    totalPlays: Math.max(0, Math.trunc(Number(obj.totalPlays) || 0)),
  };
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
      if (existing.highestLevel >= 1) continue;
      next[roundId] = {
        highestLevel: 1,
        levelsCompleted: existing.levelsCompleted.length ? existing.levelsCompleted : [1],
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
  return migrateLegacyUnlocks(progress);
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

export function isLevelUnlocked(progress: GemShopProgress, roundId: BonusRoundId, level: RoundLevel): boolean {
  return progress[roundId].highestLevel >= level;
}

export function isLevelCompleted(progress: GemShopProgress, roundId: BonusRoundId, level: RoundLevel): boolean {
  return progress[roundId].levelsCompleted.includes(level);
}

export function getNextUnlockLevel(progress: GemShopProgress, roundId: BonusRoundId): RoundLevel | null {
  const next = (progress[roundId].highestLevel + 1) as RoundLevel;
  return next <= 5 ? next : null;
}

export function countUnlockedLevels(progress: GemShopProgress): number {
  return BONUS_ROUNDS.reduce((sum, r) => sum + progress[r.id].highestLevel, 0);
}

export async function isRoundUnlocked(roundId: BonusRoundId): Promise<boolean> {
  const progress = await getGemShopProgress();
  return progress[roundId].highestLevel > 0;
}

export async function isRoundLevelUnlocked(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<boolean> {
  const progress = await getGemShopProgress();
  return isLevelUnlocked(progress, roundId, level);
}

export async function purchaseLevel(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<{ success: boolean; error?: string; gemsRemaining?: number }> {
  const progress = await getGemShopProgress();
  const nextLevel = getNextUnlockLevel(progress, roundId);

  if (isLevelUnlocked(progress, roundId, level)) {
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

  const updated = { ...progress };
  updated[roundId] = {
    ...updated[roundId],
    highestLevel: level,
  };
  await saveProgress(updated);

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
  const levelsCompleted = round.levelsCompleted.includes(level)
    ? round.levelsCompleted
    : [...round.levelsCompleted, level].sort((a, b) => a - b);
  progress[roundId] = {
    ...round,
    levelsCompleted,
    highestLevel: Math.max(round.highestLevel, level),
  };
  await saveProgress(progress);
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
    roundsUnlocked: countUnlockedLevels(progress),
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
  if (shopBadgeDismissedSession) return false;
  return affordable.length > 0;
}

export function eliteBadgeId(roundId: BonusRoundId): string {
  return `elite-${roundId}`;
}

export function eliteBadgeLabel(roundId: BonusRoundId): string {
  return `Elite ${getRoundDef(roundId).name}`;
}
