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

export type GameGenerateOptions = {
  /** Skip Claude and return a local sequence (demo / offline). */
  localOnly?: boolean;
};

const STOCK_VOCAB: Pick<DailyVocabWord, 'spanish' | 'english' | 'exampleSpanish'>[] = [
  { spanish: 'el mercado', english: 'the market', exampleSpanish: 'Voy al mercado por la mañana.' },
  { spanish: 'el trabajo', english: 'work', exampleSpanish: 'Tengo mucho trabajo hoy.' },
  { spanish: 'la casa', english: 'the house', exampleSpanish: 'Vivo en una casa pequeña.' },
  { spanish: 'el tiempo', english: 'the weather / time', exampleSpanish: 'Hoy hace buen tiempo.' },
];

const OPTION_FILLERS = ['casa', 'tiempo', 'amigo', 'trabajo', 'ciudad', 'agua', 'grande', 'rojo'];

const GRAMMAR_FALLBACK_SENTENCES: { tokens: string[]; meaning: string }[] = [
  { tokens: ['Hoy', 'tengo', 'clase', 'de', 'español'], meaning: 'Today I have Spanish class' },
  { tokens: ['Ella', 'está', 'en', 'casa'], meaning: 'She is at home' },
  { tokens: ['Nosotros', 'vamos', 'al', 'parque'], meaning: 'We go to the park' },
  { tokens: ['Tú', 'eres', 'muy', 'amable'], meaning: 'You are very kind' },
];

const STRUCTURE_FALLBACK_ROUNDS: {
  prompt: string;
  sentenceTemplate: string;
  options: string[];
  correctAnswer: string;
}[] = [
  {
    prompt: 'The red car',
    sentenceTemplate: `El coche ${BLANK_MARKER}`,
    options: ['rojo', 'roja', 'red'],
    correctAnswer: 'rojo',
  },
  {
    prompt: 'I am tired',
    sentenceTemplate: `${BLANK_MARKER} cansado`,
    options: ['Estoy', 'Soy', 'Tengo'],
    correctAnswer: 'Estoy',
  },
  {
    prompt: 'I like coffee',
    sentenceTemplate: `Me ${BLANK_MARKER} el café`,
    options: ['gusta', 'gusto', 'quiero'],
    correctAnswer: 'gusta',
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueChoices(correct: string, extras: string[], minCount: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [correct, ...extras, ...OPTION_FILLERS]) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= Math.max(minCount, 4)) break;
  }
  return out;
}

function vocabSentenceTemplate(word: VocabSeed): string {
  const spanish = word.spanish.trim();
  const example = word.exampleSpanish.trim();
  if (example && spanish) {
    const full = new RegExp(escapeRegExp(spanish), 'i');
    if (full.test(example)) return example.replace(full, BLANK_MARKER);
  }
  return `Hoy practico ${BLANK_MARKER}.`;
}

type VocabSeed = Pick<DailyVocabWord, 'spanish' | 'english' | 'exampleSpanish'>;

function padVocabWords(words: DailyVocabWord[]): VocabSeed[] {
  const usable: VocabSeed[] = words.filter((w) => w.spanish.trim());
  if (usable.length >= 3) return usable.slice(0, 5);
  const seen = new Set(usable.map((w) => w.spanish.trim().toLowerCase()));
  const padded = [...usable];
  for (const stock of STOCK_VOCAB) {
    if (padded.length >= 3) break;
    if (seen.has(stock.spanish.toLowerCase())) continue;
    padded.push(stock);
  }
  return padded;
}

function buildVocabFallbackSequence(words: DailyVocabWord[]): GameSequence | null {
  const bank = padVocabWords(words);
  const usedIds = new Set<string>();
  const rounds: GameRound[] = [];
  for (let index = 0; index < bank.length; index += 1) {
    const word = bank[index];
    const distractors = bank.filter((_, i) => i !== index).map((item) => item.spanish);
    const options = uniqueChoices(word.spanish, distractors, 3);
    if (options.length < 3) continue;
    rounds.push({
      id: uniqueId(`vocab-demo-${index + 1}`, index, usedIds, 'vocab-round'),
      mode: 'slot',
      prompt: 'Complete the sentence',
      sentenceTemplate: vocabSentenceTemplate(word),
      options: options.slice(0, 4),
      correctAnswer: word.spanish,
      hint: word.english || undefined,
    });
  }
  return takeValidRounds(rounds);
}

function buildGrammarFallbackSequence(topic: GrammarGameTopic): GameSequence | null {
  const usedIds = new Set<string>();
  const hint = topic.topicSpanish.trim() || topic.topic.trim() || undefined;
  const rounds: GameRound[] = GRAMMAR_FALLBACK_SENTENCES.map((sentence, index) => {
    const correctAnswer = sentence.tokens.join(' ');
    return {
      id: uniqueId(`grammar-demo-${index + 1}`, index, usedIds, 'grammar-round'),
      mode: 'tiles' as const,
      prompt: 'Build the sentence',
      tiles: shuffleTokens(sentence.tokens),
      correctAnswer,
      hint: sentence.meaning || hint,
    };
  });
  return takeValidRounds(rounds);
}

function spanishFromExample(example: string): { english: string; spanish: string } | null {
  const parts = example.split('→');
  const english = (parts[0] ?? '').trim();
  const spanish = (parts[1] ?? parts[0] ?? '')
    .replace(/\s*\(.*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = spanish.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  return { english, spanish };
}

function buildStructureFallbackSequence(topic: StructureGameTopic): GameSequence | null {
  const usedIds = new Set<string>();
  const fromExamples: GameRound[] = [];
  for (let index = 0; index < topic.examples.length; index += 1) {
    const parsed = spanishFromExample(topic.examples[index]);
    if (!parsed) continue;
    const tokens = parsed.spanish.split(/\s+/).filter(Boolean);
    const answer = tokens[tokens.length - 1]?.replace(/[¿?¡!.,;:]+$/g, '') ?? '';
    if (!answer) continue;
    const prefix = tokens.slice(0, -1).join(' ');
    const options = uniqueChoices(answer, OPTION_FILLERS, 3);
    if (options.length < 3) continue;
    fromExamples.push({
      id: uniqueId(`structure-demo-${index + 1}`, index, usedIds, 'structure-round'),
      mode: 'swap',
      prompt: parsed.english || topic.title,
      sentenceTemplate: `${prefix} ${BLANK_MARKER}`.trim(),
      options: options.slice(0, 3),
      correctAnswer: answer,
    });
  }

  const canned: GameRound[] = STRUCTURE_FALLBACK_ROUNDS.map((round, index) => ({
    id: uniqueId(`structure-stock-${index + 1}`, index, usedIds, 'structure-round'),
    mode: 'swap' as const,
    prompt: round.prompt,
    sentenceTemplate: round.sentenceTemplate,
    options: round.options,
    correctAnswer: round.correctAnswer,
  }));

  return takeValidRounds([...fromExamples, ...canned]);
}

export async function generateVocabGameSequence(
  words: DailyVocabWord[],
  dialect: string,
  options?: GameGenerateOptions,
): Promise<GameSequence | null> {
  const fallback = buildVocabFallbackSequence(words);
  if (options?.localOnly) return fallback;

  const usable = words.filter((w) => w.spanish.trim());
  if (!usable.length) return fallback;

  return (
    (await loadOrGenerate(
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
    )) ?? fallback
  );
}

export async function generateGrammarGameSequence(
  topic: GrammarGameTopic,
  dialect: string,
  options?: GameGenerateOptions,
): Promise<GameSequence | null> {
  const fallback = buildGrammarFallbackSequence(topic);
  if (options?.localOnly) return fallback;

  const name = topic.topic.trim();
  if (!name) return fallback;

  return (
    (await loadOrGenerate(
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
    )) ?? fallback
  );
}

export async function generateStructureGameSequence(
  topic: StructureGameTopic,
  dialect: string,
  options?: GameGenerateOptions,
): Promise<GameSequence | null> {
  const fallback = buildStructureFallbackSequence(topic);
  if (options?.localOnly) return fallback;

  const title = topic.title.trim();
  if (!title) return fallback;

  return (
    (await loadOrGenerate(
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
    )) ?? fallback
  );
}
