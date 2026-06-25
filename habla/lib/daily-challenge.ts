import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'dailyChallenge';
const TYPE_HISTORY_KEY = 'dailyChallengeTypeHistory';
const TEXT_HISTORY_KEY = 'dailyChallengeHistory';
const MAX_TYPE_HISTORY = 6;
const MAX_TEXT_HISTORY = 7;

export const CHALLENGE_TYPES = [
  'NARRATION',
  'OBSERVATION',
  'DECISION',
  'EMOTION',
  'GRAMMAR_APPLICATION',
  'VOCABULARY',
  'STRUCTURE',
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export type DailyChallenge = {
  date: string;
  text: string;
  type: ChallengeType;
  completed: boolean;
};

export type DailyChallengeSummaryInput = {
  lessonType: LessonType;
  lessonFocus?: string;
  grammarTopic?: string;
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  encouragingMessage?: string;
  overallScore?: number;
};

export const CHALLENGE_TYPE_TEMPLATES: Record<
  ChallengeType,
  { label: string; template: string; hint: string }
> = {
  NARRATION: {
    label: 'Narration',
    template: 'When you [everyday action] narrate each step in Spanish internally.',
    hint: 'Pick a concrete everyday action tied to today\'s lesson (e.g. making coffee, getting ready, commuting).',
  },
  OBSERVATION: {
    label: 'Observation',
    template:
      'For the next hour when you see any object say its Spanish name in your head.',
    hint: 'Mention a category of objects from today\'s vocabulary or setting if relevant.',
  },
  DECISION: {
    label: 'Decision',
    template:
      'Make your next small decision in Spanish. Prefiero... Quiero... Voy a...',
    hint: 'Suggest a realistic small decision context related to the lesson theme.',
  },
  EMOTION: {
    label: 'Emotion',
    template:
      'Next time you feel any emotion say it in Spanish first. Estoy... Tengo... Qué...',
    hint: 'Connect to feelings that might come up in today\'s lesson topic.',
  },
  GRAMMAR_APPLICATION: {
    label: 'Grammar application',
    template:
      "Use today's grammar topic [current week topic] in your internal monologue 3 times today.",
    hint: 'Replace [current week topic] with the exact grammar focus from today\'s lesson.',
  },
  VOCABULARY: {
    label: 'Vocabulary',
    template:
      "Pick 3 words from today's lesson and use them in a sentence in your head before you sleep.",
    hint: 'Name or imply vocabulary from today\'s lesson theme.',
  },
  STRUCTURE: {
    label: 'Structure',
    template:
      'Today when you think of any English sentence quickly flip the adjective to after the noun as Spanish does.',
    hint: 'Give one quick example using a structure point from today\'s lesson if possible.',
  },
};

const ROTATION_ORDER: ChallengeType[] = [...CHALLENGE_TYPES];

function normalizeType(value: unknown): ChallengeType | null {
  if (typeof value !== 'string') return null;
  return CHALLENGE_TYPES.includes(value as ChallengeType) ? (value as ChallengeType) : null;
}

function normalizeChallenge(raw: unknown): DailyChallenge | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<DailyChallenge>;
  const text = typeof obj.text === 'string' ? obj.text.trim() : '';
  const date = typeof obj.date === 'string' ? obj.date : '';
  const type = normalizeType(obj.type) ?? 'NARRATION';
  if (!text || !date) return null;
  return {
    date,
    text,
    type,
    completed: Boolean(obj.completed),
  };
}

export function preferredChallengeTypeForLesson(lessonType: LessonType): ChallengeType {
  switch (lessonType) {
    case 'Grammar':
      return 'GRAMMAR_APPLICATION';
    case 'Vocab':
      return 'VOCABULARY';
    case 'Structure':
      return 'STRUCTURE';
    case 'Your Day':
      return 'NARRATION';
    case 'Read':
      return 'VOCABULARY';
  }
}

export async function getRecentChallengeTypes(): Promise<ChallengeType[]> {
  const raw = await AsyncStorage.getItem(TYPE_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeType)
      .filter((t): t is ChallengeType => t != null)
      .slice(0, MAX_TYPE_HISTORY);
  } catch {
    return [];
  }
}

/** Pick next type: match lesson when possible; use all 7 types before any repeats. */
export function selectChallengeType(
  lessonType: LessonType,
  recentTypes: ChallengeType[],
): ChallengeType {
  const preferred = preferredChallengeTypeForLesson(lessonType);
  const used = new Set(recentTypes.slice(0, MAX_TYPE_HISTORY));
  const unused = ROTATION_ORDER.filter((t) => !used.has(t));

  if (unused.length === 0) {
    return preferred;
  }

  if (unused.includes(preferred)) {
    return preferred;
  }

  const yourDayFallbacks: ChallengeType[] = ['NARRATION', 'DECISION', 'EMOTION', 'OBSERVATION'];
  if (lessonType === 'Your Day') {
    const match = yourDayFallbacks.find((t) => unused.includes(t));
    if (match) return match;
  }

  for (const type of ROTATION_ORDER) {
    if (unused.includes(type)) return type;
  }

  return unused[0] ?? preferred;
}

async function appendTypeHistory(type: ChallengeType): Promise<void> {
  const recent = await getRecentChallengeTypes();
  const next = [type, ...recent.filter((t) => t !== type)].slice(0, MAX_TYPE_HISTORY);
  await AsyncStorage.setItem(TYPE_HISTORY_KEY, JSON.stringify(next));
}

async function loadRecentChallengeTexts(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(TEXT_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TEXT_HISTORY);
  } catch {
    return [];
  }
}

async function appendChallengeTextHistory(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const recent = await loadRecentChallengeTexts();
  const next = [trimmed, ...recent.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_TEXT_HISTORY,
  );
  await AsyncStorage.setItem(TEXT_HISTORY_KEY, JSON.stringify(next));
}

export async function getRecentChallengeTexts(): Promise<string[]> {
  return loadRecentChallengeTexts();
}

export async function getDailyChallenge(): Promise<DailyChallenge | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeChallenge(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getTodaysChallenge(): Promise<DailyChallenge | null> {
  const challenge = await getDailyChallenge();
  const today = formatLocalDate();
  if (!challenge || challenge.date !== today) return null;
  return challenge;
}

export async function saveDailyChallenge(
  text: string,
  type: ChallengeType,
  date: string = formatLocalDate(),
): Promise<DailyChallenge> {
  const trimmed = text.trim();
  const challenge: DailyChallenge = {
    date,
    text: trimmed,
    type,
    completed: false,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
  await appendTypeHistory(type);
  await appendChallengeTextHistory(trimmed);
  return challenge;
}

export async function completeDailyChallenge(): Promise<{
  alreadyCompleted: boolean;
  challenge: DailyChallenge | null;
}> {
  const today = formatLocalDate();
  const current = await getDailyChallenge();
  if (!current || current.date !== today) {
    return { alreadyCompleted: false, challenge: null };
  }
  if (current.completed) {
    return { alreadyCompleted: true, challenge: current };
  }

  const updated: DailyChallenge = { ...current, completed: true };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return { alreadyCompleted: false, challenge: updated };
}

export async function resolveChallengeTypeForLesson(lessonType: LessonType): Promise<ChallengeType> {
  const recentTypes = await getRecentChallengeTypes();
  return selectChallengeType(lessonType, recentTypes);
}
