import AsyncStorage from '@react-native-async-storage/async-storage';

import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { getLastSummary } from '@/lib/last-summary-storage';
import { resolveLevelBarometer } from '@/lib/level-progress';
import type { MilestoneCelebration, MilestoneId } from '@/lib/milestones';
import { getUserName } from '@/lib/onboarding-storage';
import { getLessonHistory } from '@/lib/practice-storage';
import { getSavedVocabulary } from '@/lib/saved-vocabulary';
import { getStreakState, formatLocalDate } from '@/lib/streak';
import type { MilestoneQuizQuestion } from '@/lib/milestone-quiz-generator';

const QUIZ_RECORDS_KEY = 'milestoneCelebrationQuizzes';
const DRILL_QUEUE_KEY = 'milestoneQuizDrillQueue';
const PENDING_CELEBRATION_QUIZ_KEY = 'pendingCelebrationQuiz';
const LAST_PROGRESSION_TEST_DATE_KEY = 'lastProgressionTestDate';
const PROGRESSION_CLASH_DAYS = 5;

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const start = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const end = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((end - start) / 86_400_000);
}

async function daysSinceLastProgressionTest(): Promise<number> {
  const last = await AsyncStorage.getItem(LAST_PROGRESSION_TEST_DATE_KEY);
  if (!last) return PROGRESSION_CLASH_DAYS;
  return daysBetween(last, formatLocalDate());
}

export type MilestoneQuizTriggerId =
  | 'streak-21'
  | 'streak-63'
  | 'streak-100'
  | 'grammar-complete'
  | 'streak-14'
  | 'streak-30'
  | 'level-up';

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
  userName: string;
  completedGrammarWeeks: { week: number; topic: string }[];
  savedVocabulary: { spanish: string; english: string }[];
  lessonTypes: string[];
  yourDayTopics: string[];
  javiPhrases: { spanish: string; english: string }[];
  currentLevel: string;
  levelLabel?: string;
};

export type CelebrationQuizCatalogItem = {
  triggerId: MilestoneQuizTriggerId;
  emoji: string;
  label: string;
  description: string;
};

export const CELEBRATION_QUIZ_CATALOG: CelebrationQuizCatalogItem[] = [
  {
    triggerId: 'streak-21',
    emoji: '🎉',
    label: '21 day celebration quiz',
    description: 'Present tense, early preterite, and your first themes — personalised for you.',
  },
  {
    triggerId: 'streak-63',
    emoji: '🔥',
    label: '63 day celebration quiz',
    description: 'Everything covered so far — roughly weeks 1–12 of the curriculum.',
  },
  {
    triggerId: 'streak-100',
    emoji: '🏆',
    label: '100 day celebration quiz',
    description: 'A comprehensive recap across everything you have learned.',
  },
  {
    triggerId: 'grammar-complete',
    emoji: '📚',
    label: 'Curriculum complete quiz',
    description: 'All 30 grammar weeks finished — the final celebration.',
  },
];

const QUIZ_TRIGGER_PRIORITY: MilestoneQuizTriggerId[] = [
  'streak-100',
  'grammar-complete',
  'streak-63',
  'streak-21',
];

const MILESTONE_TO_TRIGGER: Partial<Record<MilestoneId, MilestoneQuizTriggerId>> = {
  'streak-21': 'streak-21',
  'streak-63': 'streak-63',
  'streak-100': 'streak-100',
  'grammar-complete': 'grammar-complete',
};

const LEGACY_TRIGGER_MAP: Partial<Record<MilestoneQuizTriggerId, MilestoneQuizTriggerId>> = {
  'streak-14': 'streak-21',
  'streak-30': 'streak-63',
};

export const JAVI_QUIZ_INTRO =
  "This isn't a test. There's no failing here. I just want to show you something — how much Spanish is already living in your head. ¿Listos? Let's go.";

export function normalizeQuizTriggerId(
  triggerId: MilestoneQuizTriggerId,
): Exclude<MilestoneQuizTriggerId, 'streak-14' | 'streak-30' | 'level-up'> {
  if (triggerId === 'level-up') return 'streak-21';
  return (LEGACY_TRIGGER_MAP[triggerId] ?? triggerId) as Exclude<
    MilestoneQuizTriggerId,
    'streak-14' | 'streak-30' | 'level-up'
  >;
}

export function questionCountForTrigger(triggerId: MilestoneQuizTriggerId): number {
  const id = normalizeQuizTriggerId(triggerId);
  switch (id) {
    case 'streak-21':
      return 10;
    case 'streak-63':
      return 15;
    case 'streak-100':
    case 'grammar-complete':
      return 20;
  }
}

export function celebrationGemBonusForTrigger(triggerId: MilestoneQuizTriggerId): number {
  const id = normalizeQuizTriggerId(triggerId);
  switch (id) {
    case 'streak-21':
      return 21;
    case 'streak-63':
      return 63;
    case 'streak-100':
      return 100;
    case 'grammar-complete':
      return 0;
  }
}

export function quizPresentationForTrigger(triggerId: MilestoneQuizTriggerId): {
  title: string;
  javiMessage: string;
  eyebrow: string;
} {
  const id = normalizeQuizTriggerId(triggerId);
  switch (id) {
    case 'streak-21':
      return {
        eyebrow: '¡Tres semanas! 🎉',
        title: '21 day celebration quiz',
        javiMessage:
          'Tres semanas seguidas. Ya es un hábito.\nVamos a ver lo que has aprendido.',
      };
    case 'streak-63':
      return {
        eyebrow: '¡Nueve semanas! 🔥',
        title: '63 day celebration quiz',
        javiMessage: 'Nueve semanas de español.\nMira todo lo que sabes ahora.',
      };
    case 'streak-100':
      return {
        eyebrow: '¡Cien días! 🏆',
        title: '100 day celebration quiz',
        javiMessage:
          'Cien días. Extraordinario.\nEres de los pocos que llegan hasta aquí.',
      };
    case 'grammar-complete':
      return {
        eyebrow: 'One more thing before you go... 🎉',
        title: 'Curriculum complete quiz',
        javiMessage: JAVI_QUIZ_INTRO,
      };
  }
}

export function milestoneLabelForTrigger(
  triggerId: MilestoneQuizTriggerId,
  levelLabel?: string,
): string {
  const id = normalizeQuizTriggerId(triggerId);
  switch (id) {
    case 'streak-21':
      return '21 day streak';
    case 'streak-63':
      return '63 day streak';
    case 'streak-100':
      return '100 day streak';
    case 'grammar-complete':
      return 'Grammar curriculum complete';
    default:
      return levelLabel ? `Level up to ${levelLabel}` : 'Celebration quiz';
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
  const triggerId = o.triggerId as MilestoneQuizTriggerId;
  const normalizedTrigger = normalizeQuizTriggerId(triggerId);
  return {
    id: o.id,
    triggerId: normalizedTrigger,
    milestoneLabel: milestoneLabelForTrigger(normalizedTrigger, o.levelLabel),
    achievedDate: o.achievedDate,
    status: o.status as MilestoneQuizStatus,
    questionCount: Math.max(1, Math.trunc(Number(o.questionCount) || questionCountForTrigger(normalizedTrigger))),
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
    const pa = QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(a.triggerId));
    const pb = QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(b.triggerId));
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
): { triggerId: MilestoneQuizTriggerId }[] {
  const out: { triggerId: MilestoneQuizTriggerId }[] = [];
  for (const c of celebrations) {
    const trigger = MILESTONE_TO_TRIGGER[c.id];
    if (!trigger) continue;
    out.push({ triggerId: trigger });
  }
  return out;
}

async function storePendingCelebrationQuiz(triggerId: MilestoneQuizTriggerId): Promise<void> {
  const normalized = normalizeQuizTriggerId(triggerId);
  const existing = await AsyncStorage.getItem(PENDING_CELEBRATION_QUIZ_KEY);
  if (existing) {
    const existingRank = QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(existing as MilestoneQuizTriggerId));
    const nextRank = QUIZ_TRIGGER_PRIORITY.indexOf(normalized);
    if (existingRank >= 0 && nextRank >= 0 && existingRank <= nextRank) return;
  }
  await AsyncStorage.setItem(PENDING_CELEBRATION_QUIZ_KEY, normalized);
}

export async function queueMilestoneQuizByTrigger(
  triggerId: MilestoneQuizTriggerId,
  achievedDate: string = formatLocalDate(),
): Promise<MilestoneQuizRecord | null> {
  const normalized = normalizeQuizTriggerId(triggerId);
  const records = await getMilestoneQuizRecords();
  const id = `${normalized}-${achievedDate}`;
  if (records.some((r) => r.id === id)) {
    return getNextPendingMilestoneQuiz();
  }
  records.push({
    id,
    triggerId: normalized,
    milestoneLabel: milestoneLabelForTrigger(normalized),
    achievedDate,
    status: 'pending',
    questionCount: questionCountForTrigger(normalized),
  });
  await saveMilestoneQuizRecords(records);
  return getNextPendingMilestoneQuiz();
}

export async function processPendingCelebrationQuiz(): Promise<MilestoneQuizRecord | null> {
  const pending = await AsyncStorage.getItem(PENDING_CELEBRATION_QUIZ_KEY);
  if (!pending) return null;
  const daysSince = await daysSinceLastProgressionTest();
  if (daysSince < PROGRESSION_CLASH_DAYS) return null;
  await AsyncStorage.removeItem(PENDING_CELEBRATION_QUIZ_KEY);
  return queueMilestoneQuizByTrigger(pending as MilestoneQuizTriggerId);
}

export async function queueMilestoneQuizzesFromCelebrations(
  celebrations: MilestoneCelebration[],
  options?: { levelLabel?: string; achievedDate?: string },
): Promise<MilestoneQuizRecord | null> {
  const achievedDate = options?.achievedDate ?? formatLocalDate();
  const triggers = celebrationToTriggers(celebrations);
  if (!triggers.length) return null;

  const daysSince = await daysSinceLastProgressionTest();
  if (daysSince < PROGRESSION_CLASH_DAYS) {
    const sorted = [...triggers].sort(
      (a, b) =>
        QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(a.triggerId)) -
        QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(b.triggerId)),
    );
    await storePendingCelebrationQuiz(sorted[0]!.triggerId);
    return null;
  }

  const records = await getMilestoneQuizRecords();
  const existingIds = new Set(records.map((r) => r.id));

  const sorted = [...triggers].sort(
    (a, b) =>
      QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(a.triggerId)) -
      QUIZ_TRIGGER_PRIORITY.indexOf(normalizeQuizTriggerId(b.triggerId)),
  );

  for (const item of sorted) {
    const triggerId = normalizeQuizTriggerId(item.triggerId);
    const id = `${triggerId}-${achievedDate}`;
    if (existingIds.has(id)) continue;
    records.push({
      id,
      triggerId,
      milestoneLabel: milestoneLabelForTrigger(triggerId),
      achievedDate,
      status: 'pending',
      questionCount: questionCountForTrigger(triggerId),
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
  const [vocab, history, curriculum, lastSummary, userName] = await Promise.all([
    getSavedVocabulary(),
    getLessonHistory(),
    resolveGrammarCurriculum(),
    getLastSummary(),
    getUserName(),
  ]);

  const barometer = await resolveLevelBarometer(history);
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
    userName: userName?.trim() || 'there',
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
  misses: { drillTag: string; explanation: string; source?: string }[],
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
    const tip =
      miss.source === 'progression_test_error'
        ? `[progression_test_error] ${miss.drillTag} — ${miss.explanation}`
        : `Review from milestone quiz: ${miss.drillTag} — ${miss.explanation}`;
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
