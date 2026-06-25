import { getErrorDNA, type ErrorDNACategory, type ErrorDNAItem } from '@/lib/error-dna';
import {
  countUnlockedLevels,
  getAffordableNextLevels,
  getGemShopProgress,
  getLevelCost,
  getNextUnlockLevel,
  getRoundDef,
  isLevelPlayable,
  type BonusRoundId,
  type RoundLevel,
} from '@/lib/gem-shop';
import { getActivePendingUnlock } from '@/lib/gem-shop-expiry';
import { getLevelBarometer } from '@/lib/level-progress';
import { getLessonHistory } from '@/lib/practice-storage';

export type ShopRecommendation = {
  roundId: BonusRoundId;
  roundName: string;
  roundEmoji: string;
  level: RoundLevel;
  cost: number;
  reason: string;
  canAfford: boolean;
};

const CATEGORY_ROUND_MAP: Record<ErrorDNACategory, BonusRoundId> = {
  grammar: 'quiz',
  writing: 'immersion',
  vocabulary: 'music',
  speaking: 'shadowing',
  structure: 'quiz',
  'word-order': 'quiz',
};

const ROUND_WEAK_AREA_LABEL: Partial<Record<BonusRoundId, string>> = {
  quiz: 'grammar and knowledge gaps',
  shadowing: 'speaking confidence and pronunciation',
  roleplay: 'real-world conversation skills',
  slang: 'informal Spanish and street expressions',
  immersion: 'writing and thinking in Spanish',
  music: 'vocabulary and listening',
  culture: 'cultural context and comprehension',
  film: 'dialogue comprehension and register',
};

function topErrorCategory(errors: ErrorDNAItem[]): ErrorDNACategory | null {
  if (!errors.length) return null;
  const sorted = [...errors].sort((a, b) => b.occurrences - a.occurrences);
  return sorted[0]?.category ?? null;
}

function recommendRoundFromErrors(errors: ErrorDNAItem[]): BonusRoundId {
  const category = topErrorCategory(errors);
  if (category) return CATEGORY_ROUND_MAP[category];
  return 'shadowing';
}

export async function getShopRecommendation(gemTotal: number): Promise<ShopRecommendation | null> {
  const [errors, progress, affordable, history] = await Promise.all([
    getErrorDNA(),
    getGemShopProgress(),
    getAffordableNextLevels(gemTotal),
    getLessonHistory(),
  ]);

  const bar = getLevelBarometer(history);
  const avgScore = bar?.averageScore ?? 0;

  if (countUnlockedLevels(progress) === 0) {
    const def = getRoundDef('quiz');
    const cost = getLevelCost('quiz', 1);
    return {
      roundId: 'quiz',
      roundName: def.name,
      roundEmoji: def.emoji,
      level: 1,
      cost,
      canAfford: gemTotal >= cost,
      reason: 'the perfect gateway round to start your bonus journey',
    };
  }

  let roundId: BonusRoundId;

  if (avgScore < 55) {
    roundId = 'quiz';
  } else if (errors.some((e) => e.category === 'speaking' && e.occurrences >= 2)) {
    roundId = 'shadowing';
  } else if (errors.some((e) => (e.category === 'word-order' || e.category === 'structure') && e.occurrences >= 2)) {
    roundId = 'quiz';
  } else if (errors.some((e) => e.category === 'vocabulary' && e.occurrences >= 2)) {
    roundId = 'music';
  } else if (errors.some((e) => e.category === 'writing' && e.occurrences >= 2)) {
    roundId = 'immersion';
  } else {
    roundId = recommendRoundFromErrors(errors);
  }

  const nextUnlock = getNextUnlockLevel(progress, roundId);
  const pending = getActivePendingUnlock(progress[roundId].unlocks);
  const completed = progress[roundId].unlocks.filter((u) => u.completed).map((u) => u.level);
  const replayLevel = completed.length ? (Math.max(...completed) as RoundLevel) : 1;
  const level: RoundLevel = pending?.level ?? nextUnlock ?? replayLevel;
  const cost = nextUnlock && !pending ? getLevelCost(roundId, nextUnlock) : 0;

  const def = getRoundDef(roundId);
  const weakLabel = ROUND_WEAK_AREA_LABEL[roundId] ?? 'your current weak areas';
  const affordableMatch = affordable.find((t) => t.roundId === roundId && t.level === level);
  const playable = isLevelPlayable(progress, roundId, level);

  return {
    roundId,
    roundName: def.name,
    roundEmoji: def.emoji,
    level,
    cost: affordableMatch?.cost ?? cost,
    canAfford: Boolean(affordableMatch) || playable,
    reason: `matches your ${weakLabel}`,
  };
}
