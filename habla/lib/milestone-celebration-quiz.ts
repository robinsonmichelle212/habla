import AsyncStorage from '@react-native-async-storage/async-storage';

import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { getLastSummary } from '@/lib/last-summary-storage';
import { getLevelBarometer } from '@/lib/level-progress';
import type { MilestoneCelebration, MilestoneId } from '@/lib/milestones';
import { getLessonHistory } from '@/lib/practice-storage';
import { getSavedVocabulary } from '@/lib/saved-vocabulary';
import { getStreakState, formatLocalDate } from '@/lib/streak';
import type { MilestoneQuizQuestion } from '@/lib/milestone-quiz-generator';

const QUIZ_RECORDS_KEY = 'milestoneCelebrationQuizzes';
const DRILL_QUEUE_KEY = 'milestoneQuizDrillQueue';

export type MilestoneQuizTriggerId =
  | 'streak-14'
  | 'streak-30'
  | 'streak-100'
  | 'level-up'
  | 'grammar-complete';

export type MilestoneQuizStatus = 'pending' | 'skipped' | 'completed';

export type MilestoneQuizAnswer = {
  questionId: string;
  userAnswer: string;
  correct: boolean;
};

export type MilestoneQuizRecord = {
  id: string;
  triggerId: MilestoneQuizTriggerId;
  milestoneLabel: string;
  achievedDate: string;
  status: MilestoneQuizStatus;
  questionCount: number;
  levelLabel?: string;
  correctCount?: number;
  gemsEarned?: number;
  completedAt?: string;
  questions?: MilestoneQuizQuestion[];
  answers?: MilestoneQuizAnswer[];
  daysPractising?: number;
};

export type MilestoneQuizContext = {
  milestone: string;
  completedGrammarWeeks: { week: number; topic: string }[];
  savedVocabulary: { spanish: string; english: string }[];
  lessonTypes: string[];
  yourDayTopics: string[];
  javiPhrases: { spanish: string; english: string }[];
  currentLevel: string;
  levelLabel?: string;
};

const QUIZ_TRIGGER_PRIORITY: MilestoneQuizTriggerId[] = [
  'streak-100',
  'grammar-complete',
  'streak-30',
  'streak-14',
  'level-up',
];

const MILESTONE_TO_TRIGGER: Partial<Record<MilestoneId, MilestoneQuizTriggerId>> = {
  'streak-14': 'streak-14',
  'streak-30': 'streak-30',
  'streak-100': 'streak-100',
  'level-up': 'level-up',
  'grammar-complete': 'grammar-complete',
};

export const JAVI_QUIZ_INTRO =
  "This isn't a test. There's no failing here. I just want to show you something — how much Spanish is already living in your head. ¿Listos? Let's go.";

export function questionCountForTrigger(triggerId: MilestoneQuizTriggerId): number {
  switch (triggerId) {
    case 'streak-14':
    case 'level-up':
      return 10;
    case 'streak-30':
      return 15;
    case 'streak-100':
    case 'grammar-complete':
      return 20;
  }
}

export function milestoneLabelForTrigger(
  triggerId: MilestoneQuizTriggerId,
  levelLabel?: string,
): string {
  switch (triggerId) {
    case 'streak-14':
      return '14 day streak';
    case 'streak-30':
      return '30 day streak';
    case 'streak-100':
      return '100 day streak';
    case 'grammar-complete':
      return 'Grammar curriculum complete';
    case 'level-up':
      return levelLabel ? `Level up to ${levelLabel}` : 'Level up';
  }
}

export function calculateMilestoneQuizGems(correct: number, total: number): {
  attemptGems: number;
  correctGems: number;
  perfectBonus: number;
  totalGems: number;
} {
  const attemptGems = 5;
  const correctGems = correct;
  const perfectBonus = correct === total && total > 0 ? 20 : 0;
  return {
    attemptGems,
    correctGems,
    perfectBonus,
    totalGems: attemptGems + correctGems + perfectBonus,
  };
}

export function javiReactionForScore(correct: number, total: number): string {
  if (total <= 0) {
    return "You showed up — that's what matters. ¡Sigue así!";
  }
  if (correct === total) {
    return "Perfecto. Every single one. I'm not surprised — you've worked hard for this. ¡Enhorabuena!";
  }
  if (correct >= Math.ceil(total * 0.7)) {
    return `Look at that. ${correct} out of ${total}. That's ${correct} Spanish words that belong to you now. Keep going.`;
  }
  if (correct >= Math.ceil(total * 0.5)) {
    return `More than half — and every one of those is a word that wasn't there before. ¡Bien hecho!`;
  }
  return "You know what? These are hard. And you attempted every single one. That's how it gets easier. ¡Sigue así!";
}

function normalizeRecord(raw: unknown): MilestoneQuizRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<MilestoneQuizRecord>;
  if (!o.id || !o.triggerId || !o.milestoneLabel || !o.achievedDate || !o.status) return null;
  return {
    id: o.id,
    triggerId: o.triggerId as MilestoneQuizTriggerId,
    milestoneLabel: o.milestoneLabel,
    achievedDate: o.achievedDate,
    status: o.status as MilestoneQuizStatus,
    questionCount: Math.max(1, Math.trunc(Number(o.questionCount) || 10)),
    levelLabel: typeof o.levelLabel === 'string' ? o.levelLabel : undefined,
    correctCount: o.correctCount != null ? Math.trunc(Number(o.correctCount)) : undefined,
    gemsEarned: o.gemsEarned != null ? Math.trunc(Number(o.gemsEarned)) : undefined,
    completedAt: typeof o.completedAt === 'string' ? o.completedAt : undefined,
    questions: Array.isArray(o.questions) ? (o.questions as MilestoneQuizQuestion[]) : undefined,
    answers: Array.isArray(o.answers) ? (o.answers as MilestoneQuizAnswer[]) : undefined,
    daysPractising: o.daysPractising != null ? Math.trunc(Number(o.daysPractising)) : undefined,
  };
}

export async function getMilestoneQuizRecords(): Promise<MilestoneQuizRecord[]> {
  const raw = await AsyncStorage.getItem(QUIZ_RECORDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).filter((r): r is MilestoneQuizRecord => r != null);
  } catch {
    return [];
  }
}

async function saveMilestoneQuizRecords(records: MilestoneQuizRecord[]): Promise<void> {
  await AsyncStorage.setItem(QUIZ_RECORDS_KEY, JSON.stringify(records));
}

export async function getMilestoneQuizById(id: string): Promise<MilestoneQuizRecord | null> {
  const records = await getMilestoneQuizRecords();
  return records.find((r) => r.id === id) ?? null;
}

export async function getNextPendingMilestoneQuiz(): Promise<MilestoneQuizRecord | null> {
  const records = await getMilestoneQuizRecords();
  const pending = records.filter((r) => r.status === 'pending');
  if (!pending.length) return null;
  pending.sort((a, b) => {
    const pa = QUIZ_TRIGGER_PRIORITY.indexOf(a.triggerId);
    const pb = QUIZ_TRIGGER_PRIORITY.indexOf(b.triggerId);
    if (pa !== pb) return pa - pb;
    return a.achievedDate.localeCompare(b.achievedDate);
  });
  return pending[0] ?? null;
}

export async function getPendingMilestoneQuizzes(): Promise<MilestoneQuizRecord[]> {
  const records = await getMilestoneQuizRecords();
  return records.filter((r) => r.status === 'pending');
}

function celebrationToTriggers(
  celebrations: MilestoneCelebration[],
  levelLabel?: string,
): { triggerId: MilestoneQuizTriggerId; levelLabel?: string }[] {
  const out: { triggerId: MilestoneQuizTriggerId; levelLabel?: string }[] = [];
  for (const c of celebrations) {
    const trigger = MILESTONE_TO_TRIGGER[c.id];
    if (!trigger) continue;
    out.push({
      triggerId: trigger,
      levelLabel: trigger === 'level-up' ? levelLabel : undefined,
    });
  }
  return out;
}

export async function queueMilestoneQuizzesFromCelebrations(
  celebrations: MilestoneCelebration[],
  options?: { levelLabel?: string; achievedDate?: string },
): Promise<MilestoneQuizRecord | null> {
  const achievedDate = options?.achievedDate ?? formatLocalDate();
  const triggers = celebrationToTriggers(celebrations, options?.levelLabel);
  if (!triggers.length) return null;

  const records = await getMilestoneQuizRecords();
  const existingIds = new Set(records.map((r) => r.id));

  const sorted = [...triggers].sort(
    (a, b) =>
      QUIZ_TRIGGER_PRIORITY.indexOf(a.triggerId) - QUIZ_TRIGGER_PRIORITY.indexOf(b.triggerId),
  );

  for (const item of sorted) {
    const id = `${item.triggerId}-${achievedDate}`;
    if (existingIds.has(id)) continue;
    records.push({
      id,
      triggerId: item.triggerId,
      milestoneLabel: milestoneLabelForTrigger(item.triggerId, item.levelLabel ?? options?.levelLabel),
      achievedDate,
      status: 'pending',
      questionCount: questionCountForTrigger(item.triggerId),
      levelLabel: item.levelLabel ?? options?.levelLabel,
    });
    existingIds.add(id);
  }

  await saveMilestoneQuizRecords(records);
  return getNextPendingMilestoneQuiz();
}

export async function skipMilestoneQuiz(id: string): Promise<void> {
  const records = await getMilestoneQuizRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  records[idx] = { ...records[idx], status: 'skipped' };
  await saveMilestoneQuizRecords(records);
}

export async function completeMilestoneQuiz(
  id: string,
  payload: {
    questions: MilestoneQuizQuestion[];
    answers: MilestoneQuizAnswer[];
    correctCount: number;
    gemsEarned: number;
    daysPractising: number;
  },
): Promise<void> {
  const records = await getMilestoneQuizRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  records[idx] = {
    ...records[idx],
    status: 'completed',
    questions: payload.questions,
    answers: payload.answers,
    correctCount: payload.correctCount,
    gemsEarned: payload.gemsEarned,
    daysPractising: payload.daysPractising,
    completedAt: formatLocalDate(),
  };
  await saveMilestoneQuizRecords(records);
}

export async function storeMilestoneQuizQuestions(
  id: string,
  questions: MilestoneQuizQuestion[],
): Promise<void> {
  const records = await getMilestoneQuizRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  records[idx] = { ...records[idx], questions };
  await saveMilestoneQuizRecords(records);
}

function daysSinceFirstLesson(dates: string[]): number {
  if (!dates.length) return 1;
  const sorted = [...dates].sort();
  const first = new Date(`${sorted[0]}T12:00:00`);
  const today = new Date(`${formatLocalDate()}T12:00:00`);
  const diff = Math.floor((today.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export async function gatherMilestoneQuizContext(
  record: MilestoneQuizRecord,
): Promise<MilestoneQuizContext> {
  const [vocab, history, curriculum, lastSummary] = await Promise.all([
    getSavedVocabulary(),
    getLessonHistory(),
    resolveGrammarCurriculum(),
    getLastSummary(),
  ]);

  const barometer = getLevelBarometer(history);
  const completedGrammarWeeks = [...new Set(curriculum.completedWeeks)]
    .sort((a, b) => a - b)
    .map((week) => ({
      week,
      topic: getWeekDefinition(week).topic,
    }));

  const lessonTypes = [...new Set(history.filter((e) => !e.placeholder).map((e) => e.lessonType))];

  const yourDayTopics = history
    .filter((e) => !e.placeholder && e.lessonType.toLowerCase().includes('your day'))
    .flatMap((e) => [e.breakdown.vocabulary.topic, e.breakdown.grammar.topic, ...e.focusAreas])
    .filter((t) => t && t.trim().length > 0)
    .slice(0, 8);

  const javiPhrases: { spanish: string; english: string }[] = [];
  for (const word of vocab.filter((w) => w.isPhrase || w.source === 'phrase' || w.source === 'conversation').slice(0, 8)) {
    javiPhrases.push({ spanish: word.spanish, english: word.english });
  }

  const session = lastSummary?.session;
  if (session) {
    const turns = [
      ...(session.warmUpConversation ?? []),
      ...(session.speakingConversation ?? []),
      ...(session.conversation ?? []),
    ];
    for (const turn of turns) {
      if (turn.role !== 'assistant') continue;
      const spanish = turn.spanish?.trim();
      const english = turn.translation?.trim();
      if (spanish && english && javiPhrases.length < 12) {
        javiPhrases.push({ spanish, english });
      }
    }
  }

  for (const entry of history.filter((e) => !e.placeholder).slice(-5)) {
    for (const word of entry.breakdown.vocabulary.wordsCorrect ?? []) {
      if (javiPhrases.length >= 12) break;
      javiPhrases.push({ spanish: word.spanish, english: word.english });
    }
  }

  return {
    milestone: record.milestoneLabel,
    completedGrammarWeeks,
    savedVocabulary: vocab.slice(0, 20).map((w) => ({ spanish: w.spanish, english: w.english })),
    lessonTypes,
    yourDayTopics: [...new Set(yourDayTopics)].slice(0, 6),
    javiPhrases: javiPhrases.slice(0, 10),
    currentLevel: barometer?.band.label ?? 'B1 Beginner',
    levelLabel: record.levelLabel,
  };
}

export async function getDaysPractisingForQuiz(): Promise<number> {
  const [history, streak] = await Promise.all([getLessonHistory(), getStreakState()]);
  return Math.max(streak.currentStreak, daysSinceFirstLesson(history.map((e) => e.date)));
}

export async function queueMissedQuizItemsForDrills(
  misses: { drillTag: string; explanation: string }[],
): Promise<void> {
  if (!misses.length) return;
  const raw = await AsyncStorage.getItem(DRILL_QUEUE_KEY);
  let existing: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed.filter((t): t is string => typeof t === 'string');
      }
    } catch {
      existing = [];
    }
  }
  const merged = [...existing];
  for (const miss of misses) {
    const tip = `Review from milestone quiz: ${miss.drillTag} — ${miss.explanation}`;
    if (!merged.includes(tip)) merged.push(tip);
  }
  await AsyncStorage.setItem(DRILL_QUEUE_KEY, JSON.stringify(merged.slice(-10)));
}

export async function getMilestoneQuizDrillQueue(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DRILL_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}

export function isQuizEligibleCelebration(id: MilestoneId): boolean {
  return id in MILESTONE_TO_TRIGGER;
}
