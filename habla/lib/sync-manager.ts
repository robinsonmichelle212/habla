import { Platform } from 'react-native';

import { analyzeLessonPhases } from '@/lib/claude';
import { conversationToJaviMessages } from '@/lib/lesson-session';
import { checkIsOnline } from '@/lib/network-status';
import {
  getUnprocessedLessonSummaries,
  updatePendingLessonSummary,
} from '@/lib/offline-lesson';
import { processPendingAudioTasks } from '@/lib/pending-audio-sync';
import { getPendingAudioTasks } from '@/lib/pending-audio-storage';
import { processPendingWritingTasks } from '@/lib/pending-writing-sync';
import { getPendingWritingTasks } from '@/lib/pending-writing-storage';
import { updateLessonHistorySpeaking } from '@/lib/practice-storage';

export type SyncResult = {
  writingProcessed: number;
  audioProcessed: number;
  summariesProcessed: number;
  audioExpired: number;
};

const LAST_ONLINE_KEY = 'habla.lastOnlineAt';

let syncInProgress = false;
const syncListeners = new Set<(syncing: boolean) => void>();

export function subscribeSyncStatus(listener: (syncing: boolean) => void): () => void {
  syncListeners.add(listener);
  listener(syncInProgress);
  return () => syncListeners.delete(listener);
}

function setSyncing(value: boolean): void {
  syncInProgress = value;
  syncListeners.forEach((listener) => listener(value));
}

export async function getLastOnlineAt(): Promise<number | null> {
  const raw = await import('@react-native-async-storage/async-storage').then((m) =>
    m.default.getItem(LAST_ONLINE_KEY),
  );
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function touchLastOnlineAt(): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(LAST_ONLINE_KEY, String(Date.now()));
}

export async function getPendingSyncCounts(): Promise<{
  writing: number;
  audio: number;
  summaries: number;
}> {
  const [writingTasks, audioTasks, summaries] = await Promise.all([
    getPendingWritingTasks(),
    getPendingAudioTasks(),
    getUnprocessedLessonSummaries(),
  ]);

  return {
    writing: writingTasks.filter((t) => !t.evaluated).length,
    audio: audioTasks.filter((t) => !t.processed && !t.expired).length,
    summaries: summaries.length,
  };
}

async function processPendingLessonSummaries(): Promise<number> {
  const items = await getUnprocessedLessonSummaries();
  let processed = 0;

  for (const item of items) {
    if (item.speakingEvaluation.pendingEvaluation || item.writingEvaluation.pendingEvaluation) {
      continue;
    }

    try {
      const speaking = item.speakingEvaluation;
      const writingScores = {
        grammarScore: item.writingEvaluation.grammarScore,
        vocabularyScore: item.writingEvaluation.vocabularyScore,
        fluencyScore: item.writingEvaluation.fluencyScore,
        structureScore: item.writingEvaluation.structureScore,
      };

      const combinedScore = speaking.combinedScore ?? 0;
      const speakingEvalJson = {
        score: combinedScore,
        fluencyScore: speaking.fluencyScore ?? 0,
        confidenceScore: speaking.confidenceScore ?? 0,
        vocabularyRangeScore: speaking.vocabularyRangeScore ?? 0,
        naturalFlowScore: speaking.naturalFlowScore ?? 0,
        pronunciationNotes: speaking.pronunciationNotes ?? [],
        feedback: speaking.javiFeedback,
      };

      const analysisJson = await analyzeLessonPhases(
        item.lessonTypeEnum,
        conversationToJaviMessages(item.warmUpConversation),
        conversationToJaviMessages(item.speakingConversation),
        writingScores,
        speakingEvalJson,
        item.lessonFocusLabel,
      );

      await updateLessonHistorySpeaking(
        item.lessonDate,
        item.lessonType,
        {
          fluencyScore: speaking.fluencyScore,
          confidenceScore: speaking.confidenceScore,
          vocabularyRangeScore: speaking.vocabularyRangeScore,
          naturalFlowScore: speaking.naturalFlowScore,
          combinedScore: speaking.combinedScore,
          javiFeedback: speaking.javiFeedback,
          exchangeCount: speaking.exchangeCount,
          pendingEvaluation: false,
        },
        analysisJson.overallScore ?? combinedScore,
      );

      await updatePendingLessonSummary(item.id, { processed: true });
      processed += 1;
    } catch {
      // Retry later.
    }
  }

  return processed;
}

export async function runPendingSync(options?: { notify?: boolean }): Promise<SyncResult> {
  if (syncInProgress || Platform.OS === 'web') {
    return { writingProcessed: 0, audioProcessed: 0, summariesProcessed: 0, audioExpired: 0 };
  }

  const online = await checkIsOnline();
  if (!online) {
    return { writingProcessed: 0, audioProcessed: 0, summariesProcessed: 0, audioExpired: 0 };
  }

  setSyncing(true);
  try {
    await touchLastOnlineAt();

    const writing = await processPendingWritingTasks({ notify: options?.notify });
    const audio = await processPendingAudioTasks({ notify: options?.notify });
    const summariesProcessed = await processPendingLessonSummaries();

    return {
      writingProcessed: writing.processed,
      audioProcessed: audio.processed,
      summariesProcessed,
      audioExpired: audio.expired,
    };
  } finally {
    setSyncing(false);
  }
}
