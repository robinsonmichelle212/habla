import type { BonusRoundId } from '@/lib/gem-shop';
import { getLevelBarometer } from '@/lib/level-progress';
import { getLessonHistory } from '@/lib/practice-storage';

export type RoundLevel = 1 | 2 | 3 | 4 | 5;

export type RoundCalibration = {
  roundType: BonusRoundId;
  roundLevel: RoundLevel;
  currentLevelBand: string;
  targetDifficulty: string;
  questionCount: number;
  chatTurns: number;
  quizTimerSec: number;
  sessionMinutes: string;
};

const DIFFICULTY_LABELS: Record<RoundLevel, string> = {
  1: '2% below current band — confidence builder, shorter session',
  2: 'exact current level band — standard comfortable challenge',
  3: '10% above current band — stretch vocabulary and grammar',
  4: '20% above current band — hard, complex sentences, faster pace',
  5: '30% above current band — elite, near-native speed and complexity',
};

const SESSION_MINUTES: Record<RoundLevel, string> = {
  1: '5-7',
  2: '10-12',
  3: '12-15',
  4: '15',
  5: '15',
};

const QUIZ_COUNTS: Record<RoundLevel, number> = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 };
const SHADOWING_COUNTS: Record<RoundLevel, number> = { 1: 5, 2: 8, 3: 10, 4: 10, 5: 10 };
const CHAT_TURNS: Record<RoundLevel, number> = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
const QUIZ_TIMERS: Record<RoundLevel, number> = { 1: 20, 2: 15, 3: 15, 4: 12, 5: 10 };

export function shadowingCountForLevel(level: RoundLevel): number {
  return SHADOWING_COUNTS[level];
}

export async function buildRoundCalibration(
  roundType: BonusRoundId,
  roundLevel: RoundLevel,
): Promise<RoundCalibration> {
  const history = await getLessonHistory();
  const bar = getLevelBarometer(history);
  const currentLevelBand = bar?.band.label ?? 'B1 Confident';

  return {
    roundType,
    roundLevel,
    currentLevelBand,
    targetDifficulty: `${DIFFICULTY_LABELS[roundLevel]} (${currentLevelBand})`,
    questionCount: roundType === 'shadowing' ? SHADOWING_COUNTS[roundLevel] : QUIZ_COUNTS[roundLevel],
    chatTurns: CHAT_TURNS[roundLevel],
    quizTimerSec: QUIZ_TIMERS[roundLevel],
    sessionMinutes: SESSION_MINUTES[roundLevel],
  };
}

export function calibrationJsonBlock(cal: RoundCalibration): string {
  return JSON.stringify(
    {
      roundType: cal.roundType,
      roundLevel: cal.roundLevel,
      currentLevelBand: cal.currentLevelBand,
      targetDifficulty: cal.targetDifficulty,
    },
    null,
    2,
  );
}

export function levelContentGuide(cal: RoundCalibration): string {
  const { roundType, roundLevel } = cal;
  const guides: Record<BonusRoundId, Record<RoundLevel, string>> = {
    quiz: {
      1: 'Simple questions, obvious answers, present tense only.',
      2: 'Mix of tenses, some cultural knowledge required.',
      3: 'Complex questions, idiomatic expressions in options.',
      4: 'Advanced grammar in questions, nuanced cultural knowledge.',
      5: 'Near native complexity, specialist vocabulary, fast pace.',
    },
    slang: {
      1: '3 basic everyday slang words, simple context.',
      2: '5 slang expressions, Spain vs Argentina comparison.',
      3: '7 expressions including regional variations.',
      4: '8 expressions including colloquial grammar patterns.',
      5: '10 expressions, informal register, rapid fire usage.',
    },
    roleplay: {
      1: 'Simple tourist scenario, slow pace, Javi patient and helpful.',
      2: 'Social scenario, normal pace, occasional misunderstanding.',
      3: 'Complex scenario, fast pace, Javi uses slang.',
      4: 'Professional scenario, formal register required.',
      5: 'High stakes scenario, native speed, no patience for errors.',
    },
    shadowing: {
      1: '5 short phrases, slow speed, common vocabulary.',
      2: '8 sentences, normal speed, B1 vocabulary.',
      3: '10 sentences, slightly fast, some B2 vocabulary.',
      4: '10 sentences, fast, complex structures.',
      5: '10 sentences, native speed, full B2 complexity.',
    },
    culture: {
      1: 'Basic cultural facts, simple vocabulary, familiar topics.',
      2: 'Deeper cultural context, some historical references.',
      3: 'Complex cultural analysis, regional variations.',
      4: 'Academic level cultural discussion, abstract concepts.',
      5: 'Expert level, nuanced cultural debate in Spanish.',
    },
    immersion: {
      1: 'No translations but Javi speaks slowly and simply.',
      2: 'No translations, normal pace, B1 content.',
      3: 'No translations, faster pace, some B2 vocabulary.',
      4: 'No translations, fast pace, full B2 content.',
      5: 'No translations, native speed, full B2+ complexity.',
    },
    music: {
      1: 'Simple popular song, basic vocabulary, modern artist.',
      2: 'More complex lyrics, some idiomatic expressions.',
      3: 'Poetic language, metaphors, cultural depth.',
      4: 'Complex literary lyrics, regional expressions.',
      5: 'Poetry level lyrics, full cultural and historical analysis.',
    },
    film: {
      1: 'Simple scene, clear dialogue, familiar show.',
      2: 'More complex scene, some colloquial dialogue.',
      3: 'Emotionally complex scene, regional accents noted.',
      4: 'Fast dialogue, slang, cultural subtext.',
      5: 'Complex scene, multiple registers, director intent discussed.',
    },
  };
  return guides[roundType][roundLevel];
}
