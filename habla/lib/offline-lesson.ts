import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import type {
  LessonAnalysis,
  LessonConversationTurn,
  SpeakingEvaluation,
  WritingEvaluation,
} from '@/lib/lesson-session';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';

export const PENDING_LESSON_SUMMARIES_KEY = 'pendingLessonSummaries';

export type PendingLessonSummary = {
  id: string;
  lessonDate: string;
  lessonType: string;
  lessonTypeEnum: LessonType;
  lessonFocusLabel: string;
  warmUpConversation: LessonConversationTurn[];
  speakingConversation: LessonConversationTurn[];
  writingPrompt: string;
  writingEvaluation: WritingEvaluation;
  speakingEvaluation: SpeakingEvaluation;
  createdAt: number;
  processed: boolean;
};

export function buildPendingWritingEvaluation(originalText: string): WritingEvaluation {
  return {
    originalText,
    correctedText: originalText,
    grammarScore: 0,
    vocabularyScore: 0,
    fluencyScore: 0,
    feedback:
      '¡Bien hecho! Tu respuesta ha sido guardada. Javi la revisará en breve.\nWriting saved 💾 — Javi will review it shortly.',
    corrections: [],
    pendingEvaluation: true,
  };
}

export function buildOfflineLessonAnalysis(
  lessonType: LessonType,
  lessonFocus: LessonFocusContext,
  writingResult: WritingEvaluation,
  writingPrompt: string,
  speakingPending = false,
): LessonAnalysis {
  const writingPending = writingResult.pendingEvaluation === true;
  const writingAvg = writingPending
    ? 0
    : Math.round(
        (writingResult.grammarScore + writingResult.vocabularyScore + writingResult.fluencyScore) /
          3,
      );
  const topic = lessonFocusLabel(lessonFocus);
  const baseBreakdown = {
    grammar: {
      score: writingPending ? 0 : writingResult.grammarScore,
      topic,
      details: writingPending ? ['Writing evaluation pending'] : [],
      didWell: writingPending ? [] : ['Completed the grammar writing task'],
      workOn: writingPending ? ['Writing will be scored when back online'] : [],
      focusThisWeek: [`Practise ${topic} in three short sentences`],
      mistakes: [],
    },
    vocabulary: {
      score: writingPending ? 0 : writingResult.vocabularyScore,
      topic: 'Vocabulary',
      details: [],
      didWell: writingPending ? [] : ['Used lesson vocabulary in writing'],
      workOn: writingPending ? ['Vocabulary feedback pending'] : [],
      focusThisWeek: ['Review new words from today before your next lesson'],
    },
    fluency: {
      score: speakingPending ? 0 : writingResult.fluencyScore,
      details: speakingPending ? ['Speaking evaluation pending'] : [],
      didWell: speakingPending ? [] : ['Finished the speaking phase'],
      workOn: speakingPending ? ['Speaking will be scored when back online'] : [],
      focusThisWeek: ['Say one full answer aloud without stopping'],
      description: speakingPending
        ? 'Speaking will be scored once your recordings are processed.'
        : undefined,
    },
    writing: {
      score: writingAvg,
      details: writingPending ? ['Evaluation pending when back online'] : [],
      didWell: writingPending ? [] : ['Submitted your writing responses'],
      workOn: writingPending ? ['Writing feedback pending'] : [],
      focusThisWeek: ['Rewrite one sentence from today without notes'],
    },
  };

  const strongAreas: string[] = [];
  const weakAreas: string[] = [];
  if (writingPending) weakAreas.push('Writing evaluation pending');
  if (speakingPending) weakAreas.push('Speaking evaluation pending');
  if (!strongAreas.length) strongAreas.push('Lesson saved while offline');

  return {
    strongAreas,
    weakAreas,
    focusAreas: [topic],
    correctnessScore: writingAvg,
    overallScore: writingAvg,
    encouragingMessage: writingPending || speakingPending
      ? 'Lesson saved. Full feedback coming when back online.'
      : '¡Buen trabajo! / Great work completing your lesson.',
    breakdown: mergeWritingIntoBreakdown(baseBreakdown, writingResult, writingPrompt),
  };
}

async function readSummaries(): Promise<PendingLessonSummary[]> {
  const raw = await AsyncStorage.getItem(PENDING_LESSON_SUMMARIES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingLessonSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSummaries(items: PendingLessonSummary[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_LESSON_SUMMARIES_KEY, JSON.stringify(items));
}

export async function addPendingLessonSummary(summary: PendingLessonSummary): Promise<void> {
  const items = await readSummaries();
  items.push(summary);
  await writeSummaries(items);
}

export async function getPendingLessonSummaries(): Promise<PendingLessonSummary[]> {
  return readSummaries();
}

export async function updatePendingLessonSummary(
  id: string,
  patch: Partial<PendingLessonSummary>,
): Promise<void> {
  const items = await readSummaries();
  await writeSummaries(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

export async function getUnprocessedLessonSummaries(): Promise<PendingLessonSummary[]> {
  const items = await readSummaries();
  return items.filter((item) => !item.processed).sort((a, b) => a.createdAt - b.createdAt);
}
