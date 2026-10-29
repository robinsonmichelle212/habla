import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  requestGrammarGameSequence,
  requestStructureGameSequence,
  requestVocabGameSequence,
} from '@/lib/claude';
import type { DailyVocabWord } from '@/lib/daily-vocab-intro';
import { checkIsOnline } from '@/lib/network-status';
import { BLANK_MARKER, type GameRound, type GameSequence } from '@/components/sentence-game/types';
import { withTimeout } from '@/lib/with-timeout';

const VOCAB_CACHE_KEY = 'habla.vocabGameCache.v1';
const GRAMMAR_CACHE_KEY = 'habla.grammarGameCache.v1';
const CACHE_CAP = 10;
const GAME_TIMEOUT_MS = 15_000;

export type GrammarGameTopic = {
  topic: string;
  topicSpanish: string;
  weekNumber: number;
  focusVerbs: string[];
  weekSummary: string;
};

export type StructureGameTopic = {
  id: number;
  title: string;
  summary: string;
  focus: string;
  examples: readonly string[];
};

type CacheEntry = {
  key: string;
  sequence: GameSequence;
  savedAt: number;
};

function cacheKeyForWords(words: DailyVocabWord[]): string {
  return words
    .map((w) => w.spanish.trim().toLowerCase())
    .filter(Boolean)
    .join('|');
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseRoundsPayload(raw: unknown): unknown[] {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(stripMarkdownFences(raw));
      return parseRoundsPayload(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rounds?: unknown }).rounds)) {
    return (raw as { rounds: unknown[] }).rounds;
  }
  return [];
}

function uniqueId(rawId: unknown, index: number, usedIds: Set<string>, prefix: string): string {
  let id = asNonEmptyString(rawId) ?? `${prefix}-${index + 1}`;
  if (usedIds.has(id)) id = `${id}-${index + 1}`;
  usedIds.add(id);
  return id;
}

function tokenList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function sameTokenBag(tiles: string[], correctAnswer: string): boolean {
  const expected = correctAnswer.trim().split(/\s+/).filter(Boolean);
  if (tiles.length !== expected.length) return false;
  const left = [...tiles].sort();
  const right = [...expected].sort();
  return left.every((token, index) => token === right[index]);
}

function shuffleTokens(tokens: string[]): string[] {
  if (tokens.length < 2) return [...tokens];
  const original = tokens.join('\u0000');
  let next = [...tokens];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    next = [...tokens];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.join('\u0000') !== original) return next;
  }
  return [...tokens.slice(1), tokens[0]];
}

function normalizeSlotRound(raw: unknown, index: number, usedIds: Set<string>): GameRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const prompt = asNonEmptyString(row.prompt) ?? 'Complete the sentence';
  const sentenceTemplate = asNonEmptyString(row.sentenceTemplate);
  const correctAnswer = asNonEmptyString(row.correctAnswer);
  const options = tokenList(row.options);

  if (!sentenceTemplate || !sentenceTemplate.includes(BLANK_MARKER)) return null;
  if (options.length < 3) return null;
  if (!correctAnswer || !options.includes(correctAnswer)) return null;
  if (row.mode != null && row.mode !== 'slot') return null;

  return {
    id: uniqueId(row.id, index, usedIds, 'vocab-round'),
    mode: 'slot',
    prompt,
    sentenceTemplate,
    options: options.slice(0, 4),
    correctAnswer,
  };
}

function normalizeTilesRound(raw: unknown, index: number, usedIds: Set<string>): GameRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const tokens = tokenList(row.tokens);
  if (tokens.length < 3 || tokens.length > 8) return null;
  if (row.mode != null && row.mode !== 'tiles') return null;

  const correctAnswer = tokens.join(' ');
  const tiles = shuffleTokens(tokens);
  if (!sameTokenBag(tiles, correctAnswer)) return null;

  const hint = asNonEmptyString(row.meaning) ?? asNonEmptyString(row.hint);
  return {
    id: uniqueId(row.id, index, usedIds, 'grammar-round'),
    mode: 'tiles',
    prompt: asNonEmptyString(row.prompt) ?? 'Build the sentence',
    tiles,
    correctAnswer,
    hint: hint ?? undefined,
  };
}

function normalizeSwapRound(
  raw: unknown,
  index: number,
  usedIds: Set<string>,
  sharedTemplate: string,
): GameRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const sentenceTemplate =
    asNonEmptyString(row.sentenceTemplate) ?? sharedTemplate;
  const prompt = asNonEmptyString(row.prompt);
  const correctAnswer = asNonEmptyString(row.correctAnswer);
  const options = tokenList(row.options);

  if (!prompt) return null;
  if (!sentenceTemplate || !sentenceTemplate.includes(BLANK_MARKER)) return null;
  if (options.length < 3) return null;
  if (!correctAnswer || !options.includes(correctAnswer)) return null;
  if (row.mode != null && row.mode !== 'swap') return null;

  return {
    id: uniqueId(row.id, index, usedIds, 'structure-round'),
    mode: 'swap',
    prompt,
    sentenceTemplate,
    options: options.slice(0, 3),
    correctAnswer,
  };
}

function takeValidRounds(rounds: GameRound[]): GameSequence | null {
  const sliced = rounds.slice(0, 5);
  if (sliced.length < 3) return null;
  return { rounds: sliced };
}

function validateSlotSequence(raw: unknown): GameSequence | null {
  const usedIds = new Set<string>();
  const rounds = parseRoundsPayload(raw)
    .map((item, index) => normalizeSlotRound(item, index, usedIds))
    .filter((round): round is GameRound => round != null)
    .slice(0, 6);
  if (rounds.length < 3) return null;
  return { rounds };
}

function validateTilesSequence(raw: unknown): GameSequence | null {
  const usedIds = new Set<string>();
  return takeValidRounds(
    parseRoundsPayload(raw)
      .map((item, index) => normalizeTilesRound(item, index, usedIds))
      .filter((round): round is GameRound => round != null),
  );
}

function validateSwapSequence(raw: unknown): GameSequence | null {
  const sharedTemplate =
    raw && typeof raw === 'object'
      ? asNonEmptyString((raw as { sentenceTemplate?: unknown }).sentenceTemplate)
      : null;
  const usedIds = new Set<string>();
  const rounds = parseRoundsPayload(raw)
    .map((item, index) =>
      normalizeSwapRound(item, index, usedIds, sharedTemplate ?? ''),
    )
    .filter((round): round is GameRound => round != null);

  if (!rounds.length) return takeValidRounds(rounds);
  const skeleton = sharedTemplate || rounds[0].sentenceTemplate || '';
  const aligned = rounds.map((round) => ({ ...round, sentenceTemplate: skeleton }));
  if (!skeleton.includes(BLANK_MARKER)) return null;
  return takeValidRounds(aligned);
}

async function readCache(storageKey: string): Promise<CacheEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CacheEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as CacheEntry).key === 'string' &&
        Array.isArray((entry as CacheEntry).sequence?.rounds),
    );
  } catch {
    return [];
  }
}

async function writeCache(storageKey: string, entries: CacheEntry[]): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(entries.slice(0, CACHE_CAP)));
}

async function getCachedSequence(storageKey: string, key: string): Promise<GameSequence | null> {
  if (!key) return null;
  const entries = await readCache(storageKey);
  const hit = entries.find((entry) => entry.key === key);
  return hit?.sequence?.rounds?.length ? hit.sequence : null;
}

async function saveCachedSequence(
  storageKey: string,
  key: string,
  sequence: GameSequence,
): Promise<void> {
  if (!key) return;
  const entries = await readCache(storageKey);
  const next = [
    { key, sequence, savedAt: Date.now() },
    ...entries.filter((entry) => entry.key !== key),
  ];
  await writeCache(storageKey, next);
}

async function loadOrGenerate(
  storageKey: string,
  cacheKey: string,
  request: () => Promise<unknown>,
  validate: (raw: unknown) => GameSequence | null,
  label: string,
): Promise<GameSequence | null> {
  try {
    if (!cacheKey) return null;
    const cached = await getCachedSequence(storageKey, cacheKey);
    const online = await checkIsOnline();
    if (!online) return cached;
    if (cached) return cached;

    const raw = await withTimeout(request(), GAME_TIMEOUT_MS, label);
    const sequence = validate(raw);
    if (!sequence) return null;
    await saveCachedSequence(storageKey, cacheKey, sequence);
    return sequence;
  } catch {
    return null;
  }
}

export async function generateVocabGameSequence(
  words: DailyVocabWord[],
  dialect: string,
): Promise<GameSequence | null> {
  const usable = words.filter((w) => w.spanish.trim());
  if (!usable.length) return null;

  return loadOrGenerate(
    VOCAB_CACHE_KEY,
    cacheKeyForWords(usable),
    () =>
      requestVocabGameSequence({
        words: usable.map((w) => ({
          spanish: w.spanish,
          english: w.english,
          partOfSpeech: w.partOfSpeech,
        })),
        dialect,
      }),
    validateSlotSequence,
    'vocab-game-sequence',
  );
}

export async function generateGrammarGameSequence(
  topic: GrammarGameTopic,
  dialect: string,
): Promise<GameSequence | null> {
  const name = topic.topic.trim();
  if (!name) return null;

  return loadOrGenerate(
    GRAMMAR_CACHE_KEY,
    `grammar:${topic.weekNumber}:${name.toLowerCase()}:${dialect}`,
    () =>
      requestGrammarGameSequence({
        topic: name,
        topicSpanish: topic.topicSpanish,
        weekNumber: topic.weekNumber,
        focusVerbs: topic.focusVerbs,
        weekSummary: topic.weekSummary,
        dialect,
      }),
    validateTilesSequence,
    'grammar-game-sequence',
  );
}

export async function generateStructureGameSequence(
  topic: StructureGameTopic,
  dialect: string,
): Promise<GameSequence | null> {
  const title = topic.title.trim();
  if (!title) return null;

  return loadOrGenerate(
    GRAMMAR_CACHE_KEY,
    `structure:${topic.id}:${title.toLowerCase()}:${dialect}`,
    () =>
      requestStructureGameSequence({
        id: topic.id,
        title,
        summary: topic.summary,
        focus: topic.focus,
        examples: [...topic.examples],
        dialect,
      }),
    validateSwapSequence,
    'structure-game-sequence',
  );
}
