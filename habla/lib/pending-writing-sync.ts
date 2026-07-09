import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { evaluateWriting } from '@/lib/claude';
import { conversationToJaviMessages } from '@/lib/lesson-session';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { checkIsOnline } from '@/lib/network-status';
import {
  getUnevaluatedWritingTasks,
  updatePendingWritingTask,
  type PendingWritingTask,
} from '@/lib/pending-writing-storage';
import { getPendingLessonSummaries, updatePendingLessonSummary } from '@/lib/offline-lesson';
import {
  getLessonHistory,
  hasLessonHistoryFor,
  updateLessonHistoryWriting,
} from '@/lib/practice-storage';
import { persistLessonProgress } from '@/lib/session-recovery';
import type { WritingEvaluation } from '@/lib/lesson-session';

export type WritingSyncResult = {
  processed: number;
  scores: { date: string; lessonType: string; score: number }[];
};

async function notifyWritingEvaluated(
  tasks: { date: string; lessonType: string; score: number }[],
): Promise<void> {
  if (Platform.OS === 'web' || tasks.length === 0) return;
  try {
    if (tasks.length === 1) {
      const t = tasks[0];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✍️ Writing evaluated!',
          body: `Javi has marked your writing from ${t.date}! You scored ${t.score}% — tap to see feedback.`,
          data: { type: 'writing-evaluated', lessonDate: t.date, lessonType: t.lessonType },
        },
        trigger: null,
      });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✍️ Offline work evaluated',
        body: `Javi has marked ${tasks.length} sessions from when you were offline.`,
        data: { type: 'writing-evaluated-batch', count: tasks.length },
      },
      trigger: null,
    });
  } catch {
    // Non-blocking.
  }
}

async function processWritingTask(task: PendingWritingTask): Promise<number | null> {
  const evalJson = await evaluateWriting(
    task.lessonTypeEnum,
    task.writingPrompt,
    conversationToJaviMessages(task.warmUpConversation),
    task.writtenResponse,
  );

  const evaluation: WritingEvaluation = {
    originalText: task.writtenResponse,
    correctedText: evalJson.correctedText,
    grammarScore: evalJson.grammarScore,
    vocabularyScore: evalJson.vocabularyScore,
    fluencyScore: evalJson.fluencyScore,
    structureScore: evalJson.structureScore,
    feedback: evalJson.feedback,
    corrections: Array.isArray(evalJson.corrections) ? evalJson.corrections : [],
    accentIssues: Array.isArray(evalJson.accentIssues) ? evalJson.accentIssues : [],
    structuralFeedback: Array.isArray(evalJson.structuralFeedback)
      ? evalJson.structuralFeedback
      : [],
    wordOrderErrors: Array.isArray(evalJson.wordOrderErrors) ? evalJson.wordOrderErrors : [],
    pendingEvaluation: false,
  };

  const writingAvg = Math.round(
    (evaluation.grammarScore + evaluation.vocabularyScore + evaluation.fluencyScore) / 3,
  );

  if (!(await hasLessonHistoryFor(task.lessonDate, task.lessonType))) {
    await persistLessonProgress({
      date: task.lessonDate,
      lessonType: task.lessonType,
      focusLabel: task.lessonFocusLabel,
      writing: evaluation,
      writingPrompt: task.writingPrompt,
      speaking: {
        fluencyScore: null,
        confidenceScore: null,
        vocabularyRangeScore: null,
        naturalFlowScore: null,
        combinedScore: null,
        score: null,
        javiFeedback: '',
        exchangeCount: 0,
        pendingEvaluation: false,
      },
    });
  }

  const history = await getLessonHistory();
  const hasEntry = history.some(
    (e) => e.date === task.lessonDate && e.lessonType === task.lessonType,
  );

  if (hasEntry) {
    const baseBreakdown = {
      grammar: {
        score: evaluation.grammarScore,
        topic: task.grammarTopic,
        details: [],
        mistakes: [],
      },
      vocabulary: {
        score: evaluation.vocabularyScore,
        topic: 'Vocabulary',
        details: [],
      },
      fluency: { score: evaluation.fluencyScore, details: [] },
      writing: { score: writingAvg, details: [] },
    };

    await updateLessonHistoryWriting(task.lessonDate, task.lessonType, {
      evaluation,
      breakdown: mergeWritingIntoBreakdown(baseBreakdown, evaluation, task.writingPrompt),
      overallScore: writingAvg,
    });
  }

  await updatePendingWritingTask(task.id, { evaluated: true });

  const summaries = await getPendingLessonSummaries();
  for (const summary of summaries) {
    if (
      summary.lessonDate === task.lessonDate &&
      summary.lessonType === task.lessonType &&
      summary.writingEvaluation.pendingEvaluation
    ) {
      await updatePendingLessonSummary(summary.id, { writingEvaluation: evaluation });
    }
  }

  return writingAvg;
}

export async function processPendingWritingTasks(options?: {
  notify?: boolean;
}): Promise<WritingSyncResult> {
  if (Platform.OS === 'web') {
    return { processed: 0, scores: [] };
  }

  const online = await checkIsOnline();
  if (!online) {
    return { processed: 0, scores: [] };
  }

  const tasks = await getUnevaluatedWritingTasks();
  let processed = 0;
  const scores: WritingSyncResult['scores'] = [];

  for (const task of tasks) {
    try {
      const score = await processWritingTask(task);
      if (score != null) {
        processed += 1;
        scores.push({ date: task.lessonDate, lessonType: task.lessonType, score });
      }
    } catch {
      // Retry on next sync.
    }
  }

  if (options?.notify && scores.length > 0) {
    await notifyWritingEvaluated(scores);
  }

  return { processed, scores };
}
