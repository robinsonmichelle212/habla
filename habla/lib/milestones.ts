import AsyncStorage from '@react-native-async-storage/async-storage';

import { awardBadge } from '@/lib/profile-badges';
import { addGems } from '@/lib/gems';
import {
  getGrammarCurriculum,
  resolveGrammarCurriculum,
  TOTAL_CURRICULUM_WEEKS,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import { getLessonHistory, overallLessonScore } from '@/lib/practice-storage';
import { addStars, formatLocalDate, getStreakState } from '@/lib/streak';

const MILESTONES_KEY = 'milestones';
const DAILY_SESSIONS_KEY = 'dailySessions';

export type MilestoneId =
  | 'three-sessions-day'
  | 'streak-7'
  | 'streak-14'
  | 'streak-30'
  | 'streak-100'
  | 'personal-best'
  | 'level-up'
  | 'grammar-complete';

export type SessionType = 'lesson' | 'drill' | 'bonus';

export type MilestoneRecord = {
  id: MilestoneId;
  name: string;
  achievedDate: string;
  gemsAwarded: number;
  starsAwarded?: number;
};

export type MilestoneCelebration = {
  id: MilestoneId;
  emoji: string;
  name: string;
  description: string;
  message: string;
  gemsAwarded: number;
  starsAwarded: number;
};

type MilestoneDef = {
  id: MilestoneId;
  name: string;
  emoji: string;
  description: string;
  message: string;
  gems: number;
  stars: number;
  /** once ever, once per day, or every trigger */
  repeat: 'once' | 'daily' | 'always';
  badge?: { id: string; label: string; emoji: string };
};

export const MILESTONE_DEFINITIONS: MilestoneDef[] = [
  {
    id: 'three-sessions-day',
    name: 'Three Sessions in a Day',
    emoji: '🌟',
    description: 'Complete three sessions in one calendar day — lessons, drills, or gem shop rounds.',
    message: 'Incredible effort today. Three sessions in one day. 🌟 +5 💎',
    gems: 5,
    stars: 0,
    repeat: 'daily',
  },
  {
    id: 'streak-7',
    name: '7 Day Streak',
    emoji: '🔥',
    description: 'Practice seven days in a row without missing a day.',
    message: 'One week straight. Javi is proud. 🔥+ 2 🌟 +10 💎',
    gems: 10,
    stars: 2,
    repeat: 'once',
  },
  {
    id: 'streak-14',
    name: '14 Day Streak',
    emoji: '🔥',
    description: 'Practice fourteen days in a row without missing a day.',
    message: 'Two weeks straight. This is becoming real. 🔥 +1 🌟 +15 💎',
    gems: 15,
    stars: 1,
    repeat: 'once',
  },
  {
    id: 'streak-30',
    name: '30 Day Streak',
    emoji: '🔥🔥',
    description: 'Keep your streak alive for thirty consecutive days.',
    message: 'Thirty days. This is no longer a habit — it\'s who you are. 🔥 + 5 🌟 +50 💎',
    gems: 50,
    stars: 5,
    repeat: 'once',
  },
  {
    id: 'streak-100',
    name: '100 Day Streak',
    emoji: '🌟',
    description: 'One hundred consecutive days of Spanish practice.',
    message: 'One hundred days. Extraordinary. +50 🌟 +200 💎',
    gems: 200,
    stars: 50,
    repeat: 'once',
    badge: { id: 'century', label: 'Century 💯', emoji: '💯' },
  },
  {
    id: 'personal-best',
    name: 'Personal Best',
    emoji: '🎯',
    description: 'Beat your highest ever lesson score.',
    message: '', // filled dynamically
    gems: 5,
    stars: 0,
    repeat: 'always',
  },
  {
    id: 'level-up',
    name: 'Level Up',
    emoji: '📈',
    description: 'Move up to a new B1→B2 level band.',
    message: '',
    gems: 25,
    stars: 3,
    repeat: 'always',
  },
  {
    id: 'grammar-complete',
    name: 'Grammar Curriculum Complete',
    emoji: '📚',
    description: 'Complete all 20 weeks of the grammar curriculum.',
    message:
      'You completed the full grammar curriculum. Every tense. Every week. That\'s remarkable. 📚 +100 💎',
    gems: 100,
    stars: 0,
    repeat: 'once',
    badge: { id: 'grammar-master', label: 'Grammar Master 📚', emoji: '📚' },
  },
];

function defFor(id: MilestoneId): MilestoneDef {
  return MILESTONE_DEFINITIONS.find((d) => d.id === id)!;
}

type DailySessions = { date: string; count: number };

async function readDailySessions(): Promise<DailySessions> {
  const raw = await AsyncStorage.getItem(DAILY_SESSIONS_KEY);
  if (!raw) return { date: '', count: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<DailySessions>;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : '',
      count: Math.max(0, Math.trunc(Number(parsed.count) || 0)),
    };
  } catch {
    return { date: '', count: 0 };
  }
}

async function writeDailySessions(data: DailySessions): Promise<void> {
  await AsyncStorage.setItem(DAILY_SESSIONS_KEY, JSON.stringify(data));
}

export async function getMilestoneHistory(): Promise<MilestoneRecord[]> {
  const raw = await AsyncStorage.getItem(MILESTONES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const records: MilestoneRecord[] = [];
    for (const item of parsed) {
      const o = item as Partial<MilestoneRecord>;
      if (!o.id || !o.name || !o.achievedDate) continue;
      records.push({
        id: o.id as MilestoneId,
        name: o.name,
        achievedDate: o.achievedDate,
        gemsAwarded: Math.max(0, Math.trunc(Number(o.gemsAwarded) || 0)),
        starsAwarded:
          o.starsAwarded != null ? Math.max(0, Math.trunc(Number(o.starsAwarded))) : undefined,
      });
    }
    return records;
  } catch {
    return [];
  }
}

async function appendMilestoneRecord(record: MilestoneRecord): Promise<void> {
  const history = await getMilestoneHistory();
  await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify([...history, record]));
}

function hasAchievedOnce(history: MilestoneRecord[], id: MilestoneId): boolean {
  return history.some((r) => r.id === id);
}

function achievedToday(history: MilestoneRecord[], id: MilestoneId, today: string): boolean {
  return history.some((r) => r.id === id && r.achievedDate === today);
}

async function grantMilestone(
  id: MilestoneId,
  today: string,
  overrides?: Partial<Pick<MilestoneCelebration, 'message' | 'description'>>,
): Promise<MilestoneCelebration | null> {
  const def = defFor(id);
  const history = await getMilestoneHistory();

  if (def.repeat === 'once' && hasAchievedOnce(history, id)) return null;
  if (def.repeat === 'daily' && achievedToday(history, id, today)) return null;

  if (def.gems > 0) await addGems(def.gems);
  if (def.stars > 0) await addStars(def.stars);
  if (def.badge) await awardBadge(def.badge.id, def.badge.label, def.badge.emoji);

  const record: MilestoneRecord = {
    id,
    name: def.name,
    achievedDate: today,
    gemsAwarded: def.gems,
    starsAwarded: def.stars > 0 ? def.stars : undefined,
  };
  await appendMilestoneRecord(record);

  return {
    id,
    emoji: def.emoji,
    name: def.name,
    description: overrides?.description ?? def.description,
    message: overrides?.message ?? def.message,
    gemsAwarded: def.gems,
    starsAwarded: def.stars,
  };
}

export async function recordSessionAndCheckMilestones(
  type: SessionType,
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration[]> {
  const celebrations: MilestoneCelebration[] = [];

  let daily = await readDailySessions();
  if (daily.date !== today) {
    daily = { date: today, count: 0 };
  }
  daily.count += 1;
  await writeDailySessions(daily);

  if (daily.count >= 3) {
    const c = await grantMilestone('three-sessions-day', today);
    if (c) celebrations.push(c);
  }

  return celebrations;
}

export async function checkStreakMilestones(
  currentStreak: number,
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration[]> {
  const celebrations: MilestoneCelebration[] = [];
  const map: Record<number, MilestoneId> = {
    7: 'streak-7',
    14: 'streak-14',
    30: 'streak-30',
    100: 'streak-100',
  };
  const id = map[currentStreak];
  if (!id) return celebrations;
  const c = await grantMilestone(id, today);
  if (c) celebrations.push(c);
  return celebrations;
}

export async function checkPersonalBestMilestone(
  newScore: number,
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration | null> {
  const history = await getLessonHistory();
  if (history.length === 0) return null;

  const previousBest = Math.max(...history.map((e) => overallLessonScore(e)));
  if (newScore <= previousBest) return null;

  const def = defFor('personal-best');
  const message = `New personal best! ${Math.round(newScore)}% — your best ever. 🎯 +5 💎`;
  return grantMilestone('personal-best', today, { message });
}

export async function checkLevelUpMilestone(
  newLevelLabel: string,
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration | null> {
  const message = `You levelled up to ${newLevelLabel}. Javi can see the progress. 📈 +25 💎`;
  return grantMilestone('level-up', today, { message });
}

export function isGrammarCurriculumComplete(state: GrammarCurriculumState): boolean {
  return state.completedWeeks.includes(TOTAL_CURRICULUM_WEEKS);
}

export async function checkGrammarCompleteMilestone(
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration | null> {
  const state = await resolveGrammarCurriculum(today);
  if (!isGrammarCurriculumComplete(state)) return null;
  return grantMilestone('grammar-complete', today);
}

export type MilestoneProgressItem = {
  id: MilestoneId;
  name: string;
  emoji: string;
  description: string;
  achieved: boolean;
  achievedDate?: string;
  progressLabel: string;
  progressPercent: number;
  timesAchieved?: number;
};

function isMilestoneAchieved(
  def: MilestoneDef,
  history: MilestoneRecord[],
  today: string,
): boolean {
  if (def.repeat === 'daily') return achievedToday(history, def.id, today);
  if (def.repeat === 'once') return hasAchievedOnce(history, def.id);
  return false;
}

export async function getMilestoneProgress(): Promise<MilestoneProgressItem[]> {
  const [history, streak, daily, curriculum, lessonHistory] = await Promise.all([
    getMilestoneHistory(),
    getStreakState(),
    readDailySessions(),
    getGrammarCurriculum(),
    getLessonHistory(),
  ]);
  const today = formatLocalDate();
  const dailyCount = daily.date === today ? daily.count : 0;
  const completedWeeks = new Set(curriculum.completedWeeks);
  const grammarWeeksDone = completedWeeks.size;
  const lessonBest =
    lessonHistory.length > 0
      ? Math.max(...lessonHistory.map((e) => overallLessonScore(e)))
      : null;

  return MILESTONE_DEFINITIONS.map((def) => {
    const records = history.filter((r) => r.id === def.id);
    const latest = records[records.length - 1];
    const achieved = isMilestoneAchieved(def, history, today);

    let progressLabel = '';
    let progressPercent = 0;

    switch (def.id) {
      case 'three-sessions-day':
        progressLabel = achieved
          ? 'Achieved today ✅'
          : `${Math.min(dailyCount, 3)}/3 sessions today`;
        progressPercent = Math.round((Math.min(dailyCount, 3) / 3) * 100);
        break;
      case 'streak-7':
        progressLabel = achieved
          ? `Achieved ${latest?.achievedDate ?? ''}`
          : `Currently on day ${streak.currentStreak}`;
        progressPercent = Math.min(100, Math.round((streak.currentStreak / 7) * 100));
        break;
      case 'streak-14':
        progressLabel = achieved
          ? `Achieved ${latest?.achievedDate ?? ''}`
          : `Currently on day ${streak.currentStreak}`;
        progressPercent = Math.min(100, Math.round((streak.currentStreak / 14) * 100));
        break;
      case 'streak-30':
        progressLabel = achieved
          ? `Achieved ${latest?.achievedDate ?? ''}`
          : `Currently on day ${streak.currentStreak}`;
        progressPercent = Math.min(100, Math.round((streak.currentStreak / 30) * 100));
        break;
      case 'streak-100':
        progressLabel = achieved
          ? `Achieved ${latest?.achievedDate ?? ''}`
          : `Currently on day ${streak.currentStreak}`;
        progressPercent = Math.min(100, Math.round((streak.currentStreak / 100) * 100));
        break;
      case 'personal-best': {
        const pbCount = records.length;
        progressLabel =
          lessonBest != null
            ? `Best lesson score: ${Math.round(lessonBest)}%`
            : 'Complete a lesson to set your first score';
        if (pbCount > 0) {
          progressLabel += ` · beaten ${pbCount} time${pbCount === 1 ? '' : 's'}`;
        }
        progressPercent = lessonBest != null ? 100 : 0;
        break;
      }
      case 'level-up': {
        const levelCount = records.length;
        progressLabel =
          levelCount > 0
            ? `Levelled up ${levelCount} time${levelCount === 1 ? '' : 's'}`
            : 'Keep practising to reach the next band';
        progressPercent = levelCount > 0 ? 100 : 0;
        break;
      }
      case 'grammar-complete':
        progressLabel = achieved
          ? 'All 20 weeks complete ✅'
          : `Week ${curriculum.currentWeek} of ${TOTAL_CURRICULUM_WEEKS}`;
        progressPercent = Math.round((grammarWeeksDone / TOTAL_CURRICULUM_WEEKS) * 100);
        break;
    }

    return {
      id: def.id,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      achieved,
      achievedDate: latest?.achievedDate,
      progressLabel,
      progressPercent,
      timesAchieved: def.id === 'personal-best' ? records.length : undefined,
    };
  });
}

/** Session + streak + grammar checks after lesson history is saved. */
export async function milestonesOnLessonComplete(
  currentStreak: number,
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration[]> {
  const results: MilestoneCelebration[] = [];
  results.push(...(await recordSessionAndCheckMilestones('lesson', today)));
  results.push(...(await checkStreakMilestones(currentStreak, today)));
  const grammar = await checkGrammarCompleteMilestone(today);
  if (grammar) results.push(grammar);
  return results;
}

/** Run milestone checks after a practice drill session. */
export async function milestonesAfterDrill(
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration[]> {
  return recordSessionAndCheckMilestones('drill', today);
}

/** Run milestone checks after a gem shop bonus round. */
export async function milestonesAfterBonusRound(
  today: string = formatLocalDate(),
): Promise<MilestoneCelebration[]> {
  return recordSessionAndCheckMilestones('bonus', today);
}
