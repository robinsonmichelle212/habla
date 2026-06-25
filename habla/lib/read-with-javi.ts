import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LevelBandId } from '@/lib/level-progress';

const KEY_LAST_TEXT_TYPE = 'lastReadTextType';
const KEY_RECENT_TOPICS = 'readRecentTopics';
const MAX_RECENT_TOPICS = 5;

export const READ_TEXT_TYPES = [
  'news',
  'recipe',
  'story',
  'social',
  'letter',
  'lyrics',
] as const;

export type ReadTextType = (typeof READ_TEXT_TYPES)[number];

export const READ_TEXT_TYPE_LABELS: Record<ReadTextType, string> = {
  news: 'News headline & summary',
  recipe: 'Recipe',
  story: 'Short story excerpt',
  social: 'Social media post',
  letter: 'Letter or email',
  lyrics: 'Song lyrics excerpt',
};

export type ReadDifficultySpec = {
  tier: 'b1-low' | 'b1-mid' | 'b2-plus';
  wordCountMin: number;
  wordCountMax: number;
  tenseGuidance: string;
  vocabGuidance: string;
  sentenceGuidance: string;
  topicGuidance: string;
};

export function difficultySpecForBand(bandId: LevelBandId): ReadDifficultySpec {
  if (bandId === 'b1-beginner' || bandId === 'b1-developing') {
    return {
      tier: 'b1-low',
      wordCountMin: 80,
      wordCountMax: 100,
      tenseGuidance: 'Present and simple past (preterite) only',
      vocabGuidance: 'Top 1000 Spanish words only',
      sentenceGuidance: 'Short simple sentences',
      topicGuidance: 'Familiar everyday topics only',
    };
  }
  if (bandId === 'b1-confident' || bandId === 'b1-strong') {
    return {
      tier: 'b1-mid',
      wordCountMin: 100,
      wordCountMax: 150,
      tenseGuidance: 'Mix of tenses including imperfect',
      vocabGuidance: 'Mostly B1 with some B2 vocabulary introduced with context',
      sentenceGuidance: 'Longer, more complex sentences',
      topicGuidance: 'Wider range including culture and current events (not political)',
    };
  }
  return {
    tier: 'b2-plus',
    wordCountMin: 150,
    wordCountMax: 250,
    tenseGuidance: 'All tenses including subjunctive where natural',
    vocabGuidance: 'Authentic vocabulary range',
    sentenceGuidance: 'Complex sentence structures',
    topicGuidance: 'Abstract topics, opinion pieces, cultural commentary (not political)',
  };
}

function isReadTextType(value: string | null): value is ReadTextType {
  return !!value && (READ_TEXT_TYPES as readonly string[]).includes(value);
}

function pickNextInRotation<T extends string>(items: readonly T[], last: T | null): T {
  if (!last) return items[0];
  const idx = items.indexOf(last);
  if (idx === -1) return items[0];
  return items[(idx + 1) % items.length];
}

export async function selectReadTextType(): Promise<ReadTextType> {
  const last = await AsyncStorage.getItem(KEY_LAST_TEXT_TYPE);
  const next = pickNextInRotation(READ_TEXT_TYPES, isReadTextType(last) ? last : null);
  await AsyncStorage.setItem(KEY_LAST_TEXT_TYPE, next);
  return next;
}

export async function getRecentReadTopics(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_RECENT_TOPICS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string').slice(0, MAX_RECENT_TOPICS) : [];
  } catch {
    return [];
  }
}

export async function recordReadTopic(topic: string): Promise<void> {
  const normalized = topic.trim();
  if (!normalized) return;
  const recent = await getRecentReadTopics();
  const next = [normalized, ...recent.filter((t) => t.toLowerCase() !== normalized.toLowerCase())].slice(
    0,
    MAX_RECENT_TOPICS,
  );
  await AsyncStorage.setItem(KEY_RECENT_TOPICS, JSON.stringify(next));
}

export type ReadingVocabHighlight = {
  spanish: string;
  english: string;
  keywordMnemonic?: string;
};

export type ReadingComprehensionQuestion = {
  id: string;
  promptSpanish: string;
  promptEnglish?: string;
};

export type ReadingSessionContent = {
  textType: ReadTextType;
  title: string;
  topic: string;
  spanishText: string;
  vocabularyHighlights: ReadingVocabHighlight[];
  comprehensionQuestions: ReadingComprehensionQuestion[];
  grammarPatterns: string[];
  culturalNote?: string;
};

export type ReadComprehensionEvaluation = {
  score: number;
  feedback: string;
  responses: { questionId: string; feedback: string; score: number }[];
};
