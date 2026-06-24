import AsyncStorage from '@react-native-async-storage/async-storage';

import { lookupVocabularyWord } from '@/lib/claude';
import { addGems } from '@/lib/gems';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'savedVocabulary';
const MASTERY_STREAK_KEY = 'vocabMasteryStreak';
const LONGEST_MASTERY_STREAK_KEY = 'vocabLongestMasteryStreak';

export type VocabDifficulty = 'B1' | 'B2';

export type SavedVocabWord = {
  spanish: string;
  english: string;
  exampleSpanish: string;
  exampleEnglish: string;
  difficulty: VocabDifficulty;
  dateSaved: string;
  timesCorrect: number;
  timesSeen: number;
  consecutiveCorrect: number;
  mastered: boolean;
};

export type SavedVocabQuestion = {
  id: string;
  type: 'vocab_meaning' | 'vocab_translate' | 'vocab_fill_blank';
  prompt: string;
  expectedAnswer: string;
  acceptableAnswers?: string[];
  spanish: string;
  english: string;
  exampleSpanish: string;
  exampleEnglish: string;
};

export type VocabMasteryEvent = {
  spanish: string;
  gemsAwarded: number;
};

export type VocabStats = {
  saved: number;
  mastered: number;
  inProgress: number;
  longestMasteryStreak: number;
  currentMasteryStreak: number;
};

function normalizeWord(raw: unknown): SavedVocabWord | null {
  const o = raw as Partial<SavedVocabWord>;
  const spanish = typeof o.spanish === 'string' ? o.spanish.trim() : '';
  if (!spanish) return null;
  return {
    spanish,
    english: typeof o.english === 'string' ? o.english.trim() : '',
    exampleSpanish: typeof o.exampleSpanish === 'string' ? o.exampleSpanish.trim() : '',
    exampleEnglish: typeof o.exampleEnglish === 'string' ? o.exampleEnglish.trim() : '',
    difficulty: o.difficulty === 'B2' ? 'B2' : 'B1',
    dateSaved: typeof o.dateSaved === 'string' ? o.dateSaved : formatLocalDate(),
    timesCorrect: Math.max(0, Math.trunc(Number(o.timesCorrect) || 0)),
    timesSeen: Math.max(0, Math.trunc(Number(o.timesSeen) || 0)),
    consecutiveCorrect: Math.max(0, Math.trunc(Number(o.consecutiveCorrect) || 0)),
    mastered: Boolean(o.mastered),
  };
}

export async function getSavedVocabulary(): Promise<SavedVocabWord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeWord).filter((w): w is SavedVocabWord => w != null);
  } catch {
    return [];
  }
}

async function saveAll(words: SavedVocabWord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

export function getActiveVocabulary(words: SavedVocabWord[]): SavedVocabWord[] {
  return words.filter((w) => !w.mastered);
}

export function getMasteredVocabulary(words: SavedVocabWord[]): SavedVocabWord[] {
  return words.filter((w) => w.mastered);
}

export async function getVocabStats(): Promise<VocabStats> {
  const words = await getSavedVocabulary();
  const [currentStreak, longestStreak] = await Promise.all([
    AsyncStorage.getItem(MASTERY_STREAK_KEY),
    AsyncStorage.getItem(LONGEST_MASTERY_STREAK_KEY),
  ]);
  const mastered = words.filter((w) => w.mastered).length;
  return {
    saved: words.length,
    mastered,
    inProgress: words.length - mastered,
    currentMasteryStreak: Math.max(0, parseInt(currentStreak ?? '0', 10) || 0),
    longestMasteryStreak: Math.max(0, parseInt(longestStreak ?? '0', 10) || 0),
  };
}

function wordKey(spanish: string): string {
  return spanish.trim().toLowerCase();
}

export async function saveVocabularyWord(spanishInput: string): Promise<{
  word: SavedVocabWord;
  alreadyExists: boolean;
}> {
  const spanish = spanishInput.trim();
  const existing = await getSavedVocabulary();
  const dup = existing.find((w) => wordKey(w.spanish) === wordKey(spanish));
  if (dup) {
    return { word: dup, alreadyExists: true };
  }

  const lookup = await lookupVocabularyWord(spanish);
  const word: SavedVocabWord = {
    spanish: lookup.spanish || spanish,
    english: lookup.english,
    exampleSpanish: lookup.exampleSpanish,
    exampleEnglish: lookup.exampleEnglish,
    difficulty: lookup.difficulty === 'B2' ? 'B2' : 'B1',
    dateSaved: formatLocalDate(),
    timesCorrect: 0,
    timesSeen: 0,
    consecutiveCorrect: 0,
    mastered: false,
  };
  await saveAll([...existing, word]);
  await addGems(1);
  return { word, alreadyExists: false };
}

const QUESTION_FORMATS: SavedVocabQuestion['type'][] = [
  'vocab_meaning',
  'vocab_translate',
  'vocab_fill_blank',
];

function pickFormat(index: number): SavedVocabQuestion['type'] {
  return QUESTION_FORMATS[index % QUESTION_FORMATS.length];
}

function englishVariants(english: string): string[] {
  return english
    .split(/[/,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildFillBlank(word: SavedVocabWord): { prompt: string; answer: string } {
  const escaped = word.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const conjugated = word.exampleSpanish.match(new RegExp(`\\b${escaped}\\w*\\b`, 'i'));
  const blanked = conjugated
    ? word.exampleSpanish.replace(conjugated[0], '___')
    : `___ (${word.exampleEnglish})`;
  const answer = conjugated ? conjugated[0] : word.spanish;
  return {
    prompt: `Fill in the blank: ${blanked}`,
    answer,
  };
}

export function buildSavedVocabQuestions(
  words: SavedVocabWord[],
  count: number,
): SavedVocabQuestion[] {
  const pool = [...words].sort(() => Math.random() - 0.5).slice(0, count);
  return pool.map((word, i) => {
    const format = pickFormat(i);
    const id = `vocab-${wordKey(word.spanish)}-${format}`;

    if (format === 'vocab_meaning') {
      return {
        id,
        type: format,
        prompt: `What does '${word.spanish}' mean?`,
        expectedAnswer: englishVariants(word.english)[0] ?? word.english,
        acceptableAnswers: englishVariants(word.english),
        spanish: word.spanish,
        english: word.english,
        exampleSpanish: word.exampleSpanish,
        exampleEnglish: word.exampleEnglish,
      };
    }

    if (format === 'vocab_translate') {
      const primary = englishVariants(word.english)[0] ?? word.english;
      return {
        id,
        type: format,
        prompt: `How do you say '${primary}' in Spanish?`,
        expectedAnswer: word.spanish,
        acceptableAnswers: [word.spanish],
        spanish: word.spanish,
        english: word.english,
        exampleSpanish: word.exampleSpanish,
        exampleEnglish: word.exampleEnglish,
      };
    }

    const fill = buildFillBlank(word);
    return {
      id,
      type: format,
      prompt: fill.prompt,
      expectedAnswer: fill.answer,
      acceptableAnswers: [word.spanish, fill.answer],
      spanish: word.spanish,
      english: word.english,
      exampleSpanish: word.exampleSpanish,
      exampleEnglish: word.exampleEnglish,
    };
  });
}

function normalizeDrillAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[¿?¡!.,;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

export function checkSavedVocabAnswer(question: SavedVocabQuestion, userAnswer: string): boolean {
  const normalizedUser = normalizeDrillAnswer(userAnswer);
  if (!normalizedUser) return false;

  const candidates = [question.expectedAnswer, ...(question.acceptableAnswers ?? [])]
    .map(normalizeDrillAnswer)
    .filter(Boolean);

  return candidates.some(
    (c) => normalizedUser === c || normalizedUser.includes(c) || c.includes(normalizedUser),
  );
}

async function bumpMasteryStreak(): Promise<number> {
  const current = Math.max(0, parseInt((await AsyncStorage.getItem(MASTERY_STREAK_KEY)) ?? '0', 10) || 0);
  const longest = Math.max(
    0,
    parseInt((await AsyncStorage.getItem(LONGEST_MASTERY_STREAK_KEY)) ?? '0', 10) || 0,
  );
  const next = current + 1;
  await AsyncStorage.setItem(MASTERY_STREAK_KEY, String(next));
  if (next > longest) {
    await AsyncStorage.setItem(LONGEST_MASTERY_STREAK_KEY, String(next));
  }
  return next;
}

async function resetMasteryStreak(): Promise<void> {
  await AsyncStorage.setItem(MASTERY_STREAK_KEY, '0');
}

/** Update word stats after a drill answer. Returns mastery event if newly mastered. */
export async function recordVocabDrillAnswer(
  spanish: string,
  correct: boolean,
): Promise<VocabMasteryEvent | null> {
  const words = await getSavedVocabulary();
  const key = wordKey(spanish);
  const idx = words.findIndex((w) => wordKey(w.spanish) === key);
  if (idx === -1) return null;

  const word = { ...words[idx] };
  word.timesSeen += 1;

  if (correct) {
    word.timesCorrect += 1;
    word.consecutiveCorrect += 1;
  } else {
    word.consecutiveCorrect = 0;
    await resetMasteryStreak();
  }

  if (!word.mastered && word.consecutiveCorrect >= 5) {
    word.mastered = true;
    words[idx] = word;
    await saveAll(words);
    await bumpMasteryStreak();
    const gemsAwarded = 2;
    await addGems(gemsAwarded);
    return { spanish: word.spanish, gemsAwarded };
  }

  words[idx] = word;
  await saveAll(words);
  return null;
}

export const VOCAB_DRILL_SLOTS = 3;
export const WEAK_AREA_DRILL_SLOTS = 7;

export type PracticeQuestion =
  | { kind: 'quick'; question: import('@/lib/claude').QuickFireQuestion }
  | { kind: 'vocab'; question: SavedVocabQuestion };

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mixPracticeQuestions(
  weakQuestions: import('@/lib/claude').QuickFireQuestion[],
  vocabQuestions: SavedVocabQuestion[],
): PracticeQuestion[] {
  const quick = weakQuestions.map((q) => ({ kind: 'quick' as const, question: q }));
  const vocab = vocabQuestions.map((q) => ({ kind: 'vocab' as const, question: q }));
  return shuffle([...quick, ...vocab]);
}

export function practiceQuestionPrompt(p: PracticeQuestion): string {
  return p.kind === 'quick' ? p.question.prompt : p.question.prompt;
}

export function practiceQuestionId(p: PracticeQuestion): string {
  return p.kind === 'quick' ? p.question.id : p.question.id;
}
