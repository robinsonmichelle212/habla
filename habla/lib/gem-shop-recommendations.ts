import { getErrorDNA, type ErrorDNACategory, type ErrorDNAItem } from '@/lib/error-dna';
import {
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
import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import {
  getLessonHistory,
  isPlaceholderLesson,
  isStreakSessionLesson,
  type LessonHistoryEntry,
} from '@/lib/practice-storage';
import { formatLocalDate } from '@/lib/streak';

export type ShopRecommendation = {
  roundId: BonusRoundId;
  roundName: string;
  roundEmoji: string;
  level: RoundLevel;
  cost: number;
  reason: string;
  canAfford: boolean;
};

type SkillId = 'grammar' | 'fluency' | 'writing' | 'speaking';

type SkillAverages = Record<SkillId, number | null>;

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const start = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const end = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((end - start) / 86_400_000);
}

function topErrorCategories(errors: ErrorDNAItem[], limit = 3): ErrorDNACategory[] {
  return [...errors]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit)
    .map((e) => e.category);
}

function scoredLessons(history: LessonHistoryEntry[]): LessonHistoryEntry[] {
  return history.filter((s) => !isPlaceholderLesson(s) && !isStreakSessionLesson(s));
}

function skillAveragesFromRecent(history: LessonHistoryEntry[]): SkillAverages {
  const recent = scoredLessons(history).slice(-3);
  const grammar: number[] = [];
  const fluency: number[] = [];
  const writing: number[] = [];
  const speaking: number[] = [];

  for (const s of recent) {
    if (typeof s.breakdown?.grammar?.score === 'number') grammar.push(s.breakdown.grammar.score);
    if (typeof s.breakdown?.fluency?.score === 'number') fluency.push(s.breakdown.fluency.score);
    if (typeof s.breakdown?.writing?.score === 'number') writing.push(s.breakdown.writing.score);
    const speakingScore = s.speaking?.combinedScore;
    if (typeof speakingScore === 'number') speaking.push(speakingScore);
  }

  return {
    grammar: average(grammar),
    fluency: average(fluency),
    writing: average(writing),
    speaking: average(speaking),
  };
}

function lowestSkills(avgs: SkillAverages): SkillId[] {
  const entries = (Object.entries(avgs) as [SkillId, number | null][]).filter(
    (entry): entry is [SkillId, number] => entry[1] != null,
  );
  if (!entries.length) return [];
  const min = Math.min(...entries.map(([, score]) => score));
  return entries.filter(([, score]) => score === min).map(([id]) => id);
}

function daysSinceLastRead(history: LessonHistoryEntry[], today: string): number | null {
  const reads = scoredLessons(history)
    .filter((s) => s.lessonType === 'Read')
    .map((s) => s.date)
    .sort();
  const last = reads.at(-1);
  if (!last) return null;
  return daysBetween(last, today);
}

function resolveRecommendedRound(input: {
  currentWeek: number;
  currentGrammarTopic: string;
  topErrors: ErrorDNACategory[];
  avgs: SkillAverages;
  daysSinceRead: number | null;
}): { roundId: BonusRoundId; reason: string } {
  const { currentWeek, currentGrammarTopic, topErrors, avgs, daysSinceRead } = input;
  const lowest = lowestSkills(avgs);
  const top = topErrors[0] ?? null;

  if (
    lowest.includes('speaking') ||
    lowest.includes('fluency') ||
    top === 'speaking'
  ) {
    return {
      roundId: 'shadowing',
      reason: 'Tu fluidez necesita práctica — el shadowing te ayudará.',
    };
  }

  if (
    lowest.includes('grammar') ||
    top === 'grammar' ||
    (currentWeek >= 1 && currentWeek <= 14 && Boolean(currentGrammarTopic))
  ) {
    return {
      roundId: 'quiz',
      reason: 'Refuerza la gramática de esta semana con el quiz.',
    };
  }

  if (lowest.includes('writing') || top === 'writing' || top === 'word-order') {
    return {
      roundId: 'roleplay',
      reason: 'La construcción de frases necesita trabajo — el role play te ayudará.',
    };
  }

  if (currentWeek >= 15) {
    return {
      roundId: 'culture',
      reason: 'En esta etapa el contexto cultural mejora tu comprensión.',
    };
  }

  if (daysSinceRead == null || daysSinceRead >= 5) {
    return {
      roundId: 'film',
      reason: 'Llevas varios días sin leer — el cine en español mejora la comprensión.',
    };
  }

  return {
    roundId: 'slang',
    reason: 'Buen trabajo esta semana — disfruta del español coloquial.',
  };
}

function pickLevelAndCost(
  roundId: BonusRoundId,
  progress: Awaited<ReturnType<typeof getGemShopProgress>>,
  gemTotal: number,
  affordable: Awaited<ReturnType<typeof getAffordableNextLevels>>,
): Pick<ShopRecommendation, 'level' | 'cost' | 'canAfford'> {
  const nextUnlock = getNextUnlockLevel(progress, roundId);
  const pending = getActivePendingUnlock(progress[roundId].unlocks);
  const completed = progress[roundId].unlocks.filter((u) => u.completed).map((u) => u.level);
  const replayLevel = completed.length ? (Math.max(...completed) as RoundLevel) : 1;
  const level: RoundLevel = pending?.level ?? nextUnlock ?? replayLevel;
  const cost = nextUnlock && !pending ? getLevelCost(roundId, nextUnlock) : 0;
  const affordableMatch = affordable.find((t) => t.roundId === roundId && t.level === level);
  const playable = isLevelPlayable(progress, roundId, level);

  return {
    level,
    cost: affordableMatch?.cost ?? cost,
    canAfford: Boolean(affordableMatch) || playable,
  };
}

/** Fresh recommendation every call — never cached. */
export async function getShopRecommendation(gemTotal: number): Promise<ShopRecommendation | null> {
  const today = formatLocalDate();
  const [errors, progress, affordable, history, curriculum] = await Promise.all([
    getErrorDNA(),
    getGemShopProgress(),
    getAffordableNextLevels(gemTotal),
    getLessonHistory(),
    resolveGrammarCurriculum(today),
  ]);

  const currentWeek = curriculum.currentWeek;
  const currentGrammarTopic = getWeekDefinition(currentWeek).topic;
  const topErrors = topErrorCategories(errors, 3);
  const avgs = skillAveragesFromRecent(history);
  const daysSinceRead = daysSinceLastRead(history, today);

  const { roundId, reason } = resolveRecommendedRound({
    currentWeek,
    currentGrammarTopic,
    topErrors,
    avgs,
    daysSinceRead,
  });

  const def = getRoundDef(roundId);
  const levelCost = pickLevelAndCost(roundId, progress, gemTotal, affordable);

  return {
    roundId,
    roundName: def.name,
    roundEmoji: def.emoji,
    reason,
    ...levelCost,
  };
}
