import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { analyzeLessonPhases, evaluateSpeakingFluency } from '@/lib/claude';
import { conversationToJaviMessages } from '@/lib/lesson-session';
import { checkIsOnline } from '@/lib/network-status';
import {
  deletePendingAudioFile,
  expireOldPendingTasks,
  getPendingAudioTasks,
  type PendingAudioTask,
  updatePendingAudioTask,
} from '@/lib/pending-audio-storage';
import { getPendingLessonSummaries, updatePendingLessonSummary } from '@/lib/offline-lesson';
import { markLessonSpeakingExpired, updateLessonHistorySpeaking } from '@/lib/practice-storage';
import type { SpeakingEvaluation } from '@/lib/lesson-session';
import type { SpeakingHistoryRecord } from '@/lib/practice-storage';
import { computeSpeakingCombinedScore } from '@/lib/speaking-score';
import { transcribeSpanishAudio } from '@/lib/whisper';

let syncInProgress = false;

async function notifySpeakingEvaluated(task: PendingAudioTask, combinedScore: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dateLabel = task.lessonDate;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎤 Speaking evaluated!',
        body: `Your speaking from ${dateLabel} has been evaluated! You scored ${combinedScore}% — tap to see feedback.`,
        data: { type: 'speaking-evaluated', lessonDate: task.lessonDate, lessonType: task.lessonType },
      },
      trigger: null,
    });
  } catch {
    // Non-blocking.
  }
}

async function processTask(task: PendingAudioTask, notify: boolean): Promise<boolean> {
  const transcripts: string[] = [];
  for (const path of task.audioPaths) {
    const result = await transcribeSpanishAudio(path);
    if (!result.ok) {
      return false;
    }
    transcripts.push(result.text);
  }

  const speakingMessages = [...task.speakingConversation];
  let transcriptIdx = 0;
  for (let i = 0; i < speakingMessages.length; i += 1) {
    if (speakingMessages[i].role === 'user' && transcriptIdx < transcripts.length) {
      speakingMessages[i] = {
        ...speakingMessages[i],
        spanish: transcripts[transcriptIdx],
      };
      transcriptIdx += 1;
    }
  }

  const evalJson = await evaluateSpeakingFluency(
    task.lessonTypeEnum,
    task.writingPrompt,
    transcripts,
    conversationToJaviMessages(speakingMessages),
  );

  const combinedScore = computeSpeakingCombinedScore({
    fluencyScore: evalJson.fluencyScore,
    confidenceScore: evalJson.confidenceScore,
    vocabularyRangeScore: evalJson.vocabularyRangeScore,
    naturalFlowScore: evalJson.naturalFlowScore,
  });

  const speakingEvalJson = {
    score: combinedScore,
    fluencyScore: evalJson.fluencyScore,
    confidenceScore: evalJson.confidenceScore,
    vocabularyRangeScore: evalJson.vocabularyRangeScore,
    naturalFlowScore: evalJson.naturalFlowScore,
    pronunciationNotes: evalJson.pronunciationNotes,
    feedback: evalJson.feedback,
  };

  const analysisJson = await analyzeLessonPhases(
    task.lessonTypeEnum,
    conversationToJaviMessages(task.warmUpConversation),
    conversationToJaviMessages(speakingMessages),
    task.writingScores,
    speakingEvalJson,
    task.lessonFocusLabel,
  );

  const speakingRecord: SpeakingHistoryRecord = {
    fluencyScore: evalJson.fluencyScore,
    confidenceScore: evalJson.confidenceScore,
    vocabularyRangeScore: evalJson.vocabularyRangeScore,
    naturalFlowScore: evalJson.naturalFlowScore,
    combinedScore,
    javiFeedback: evalJson.feedback,
    exchangeCount: transcripts.length,
    pendingEvaluation: false,
  };

  await updateLessonHistorySpeaking(
    task.lessonDate,
    task.lessonType,
    speakingRecord,
    analysisJson.overallScore ?? combinedScore,
  );

  await updatePendingAudioTask(task.id, { processed: true });
  await Promise.all(task.audioPaths.map((p) => deletePendingAudioFile(p)));

  const speakingEvaluation: SpeakingEvaluation = {
    fluencyScore: evalJson.fluencyScore,
    confidenceScore: evalJson.confidenceScore,
    vocabularyRangeScore: evalJson.vocabularyRangeScore,
    naturalFlowScore: evalJson.naturalFlowScore,
    combinedScore,
    score: combinedScore,
    javiFeedback: evalJson.feedback,
    feedback: evalJson.feedback,
    pronunciationNotes: evalJson.pronunciationNotes,
    exchangeCount: transcripts.length,
    pendingEvaluation: false,
  };

  const summaries = await getPendingLessonSummaries();
  for (const summary of summaries) {
    if (
      summary.lessonDate === task.lessonDate &&
      summary.lessonType === task.lessonType &&
      summary.speakingEvaluation.pendingEvaluation
    ) {
      await updatePendingLessonSummary(summary.id, { speakingEvaluation });
    }
  }

  if (notify) {
    await notifySpeakingEvaluated(task, combinedScore);
  }

  return true;
}

export async function processPendingAudioTasks(options?: {
  notify?: boolean;
}): Promise<{ processed: number; expired: number }> {
  if (syncInProgress || Platform.OS === 'web') {
    return { processed: 0, expired: 0 };
  }

  const online = await checkIsOnline();
  if (!online) {
    return { processed: 0, expired: 0 };
  }

  syncInProgress = true;
  let processed = 0;

  try {
    const afterExpiry = await expireOldPendingTasks();
    const expired = afterExpiry.filter((t) => t.expired).length;

    for (const task of afterExpiry) {
      if (task.processed || task.expired) continue;

      try {
        const ok = await processTask(task, options?.notify ?? false);
        if (ok) processed += 1;
      } catch {
        // Leave task for next sync attempt.
      }
    }

    return { processed, expired };
  } finally {
    syncInProgress = false;
  }
}
