import AsyncStorage from '@react-native-async-storage/async-storage';

import { deductGems, getTotalGems } from '@/lib/gems';
import { formatLocalDate } from '@/lib/streak';

const UNLOCKS_KEY = 'gemShopUnlocks';
const HISTORY_KEY = 'gemShopHistory';
const TOTAL_SPENT_KEY = 'gemShopTotalSpent';

export type BonusRoundId =
  | 'quiz'
  | 'slang'
  | 'roleplay'
  | 'shadowing'
  | 'culture'
  | 'immersion'
  | 'music'
  | 'film';

export type BonusRoundDef = {
  id: BonusRoundId;
  name: string;
  emoji: string;
  description: string;
  cost: number;
};

export const BONUS_ROUNDS: BonusRoundDef[] = [
  {
    id: 'quiz',
    name: 'Quiz Round',
    emoji: '🧠',
    description: 'Fast-paced Spanish general knowledge quiz. 10 multiple choice questions.',
    cost: 20,
  },
  {
    id: 'slang',
    name: 'Slang Round',
    emoji: '🗣️',
    description: 'Real street Spanish — Spain and Argentina slang with drills and conversation.',
    cost: 30,
  },
  {
    id: 'roleplay',
    name: 'Role Play Round',
    emoji: '🎭',
    description: 'Javi becomes a character. Navigate a Spanish scenario by voice.',
    cost: 35,
  },
  {
    id: 'shadowing',
    name: 'Shadowing Round',
    emoji: '🗣️',
    description: 'Repeat after Javi — 10 sentences, rhythm and pronunciation focus.',
    cost: 40,
  },
  {
    id: 'culture',
    name: 'Culture Round',
    emoji: '🍕',
    description: 'Cultural deep dive in Spanish — food, festivals, art, history and more.',
    cost: 40,
  },
  {
    id: 'immersion',
    name: 'Immersion Mode',
    emoji: '🔇',
    description: 'Full lesson with zero translations. Spanish only — for the brave.',
    cost: 45,
  },
  {
    id: 'music',
    name: 'Music Round',
    emoji: '🎵',
    description: 'Famous Spanish songs — lyrics, vocabulary and cultural context.',
    cost: 50,
  },
  {
    id: 'film',
    name: 'Film & TV Round',
    emoji: '🎬',
    description: 'Scenes from Spanish film and TV — dialogue, themes and discussion.',
    cost: 75,
  },
];

export type RoundUnlockRecord = {
  roundId: BonusRoundId;
  unlockedAt: string;
  playCount: number;
  lastPlayedAt: string | null;
};

export type GemShopHistory = {
  unlocks: RoundUnlockRecord[];
  totalGemsSpent: number;
};

let shopBadgeDismissedSession = false;

export function dismissShopBadgeForSession(): void {
  shopBadgeDismissedSession = true;
}

export function isShopBadgeDismissedThisSession(): boolean {
  return shopBadgeDismissedSession;
}

export function getRoundDef(id: BonusRoundId): BonusRoundDef {
  return BONUS_ROUNDS.find((r) => r.id === id) ?? BONUS_ROUNDS[0];
}

async function loadUnlocks(): Promise<RoundUnlockRecord[]> {
  const raw = await AsyncStorage.getItem(UNLOCKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u) => u && typeof u.roundId === 'string') as RoundUnlockRecord[];
  } catch {
    return [];
  }
}

async function saveUnlocks(unlocks: RoundUnlockRecord[]): Promise<void> {
  await AsyncStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
}

export async function getGemShopHistory(): Promise<GemShopHistory> {
  const [unlocks, spentRaw] = await Promise.all([
    loadUnlocks(),
    AsyncStorage.getItem(TOTAL_SPENT_KEY),
  ]);
  const totalGemsSpent = spentRaw ? Math.max(0, parseInt(spentRaw, 10) || 0) : 0;
  return { unlocks, totalGemsSpent };
}

export async function isRoundUnlocked(roundId: BonusRoundId): Promise<boolean> {
  const unlocks = await loadUnlocks();
  return unlocks.some((u) => u.roundId === roundId);
}

export async function getUnlockRecord(roundId: BonusRoundId): Promise<RoundUnlockRecord | null> {
  const unlocks = await loadUnlocks();
  return unlocks.find((u) => u.roundId === roundId) ?? null;
}

export async function purchaseRound(roundId: BonusRoundId): Promise<{
  success: boolean;
  error?: string;
  gemsRemaining?: number;
}> {
  const def = getRoundDef(roundId);
  if (await isRoundUnlocked(roundId)) {
    return { success: true, gemsRemaining: await getTotalGems() };
  }

  const result = await deductGems(def.cost);
  if (!result.success) {
    return { success: false, error: 'Not enough gems' };
  }

  const unlocks = await loadUnlocks();
  unlocks.push({
    roundId,
    unlockedAt: formatLocalDate(),
    playCount: 0,
    lastPlayedAt: null,
  });
  await saveUnlocks(unlocks);

  const history = await getGemShopHistory();
  await AsyncStorage.setItem(TOTAL_SPENT_KEY, String(history.totalGemsSpent + def.cost));

  return { success: true, gemsRemaining: result.total };
}

export async function recordRoundPlayed(roundId: BonusRoundId): Promise<void> {
  const unlocks = await loadUnlocks();
  const today = formatLocalDate();
  const idx = unlocks.findIndex((u) => u.roundId === roundId);
  if (idx >= 0) {
    unlocks[idx] = {
      ...unlocks[idx],
      playCount: unlocks[idx].playCount + 1,
      lastPlayedAt: today,
    };
  } else {
    unlocks.push({
      roundId,
      unlockedAt: today,
      playCount: 1,
      lastPlayedAt: today,
    });
  }
  await saveUnlocks(unlocks);
}

export async function getAffordableLockedRounds(gemTotal: number): Promise<BonusRoundDef[]> {
  const unlocks = await loadUnlocks();
  const unlockedIds = new Set(unlocks.map((u) => u.roundId));
  return BONUS_ROUNDS.filter((r) => !unlockedIds.has(r.id) && r.cost <= gemTotal);
}

export function shouldShowShopBadge(gemTotal: number, affordable: BonusRoundDef[]): boolean {
  if (shopBadgeDismissedSession) return false;
  return affordable.length > 0;
}
