import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { markLessonSpeakingExpired } from '@/lib/practice-storage';

import type { LessonType } from '@/lib/claude';
import type { LessonConversationTurn } from '@/lib/lesson-session';

export const PENDING_AUDIO_TASKS_KEY = 'pendingAudioTasks';
const PENDING_AUDIO_DIR = `${documentDirectory ?? ''}habla/pending_audio/`;
const EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingAudioTask = {
  id: string;
  audioPaths: string[];
  lessonDate: string;
  lessonType: string;
  grammarTopic: string;
  phase: 'speaking';
  recordedAt: number;
  processed: boolean;
  expired?: boolean;
  writingPrompt: string;
  writingScores: {
    grammarScore: number;
    vocabularyScore: number;
    fluencyScore: number;
    structureScore?: number;
  };
  lessonFocusLabel: string;
  warmUpConversation: LessonConversationTurn[];
  speakingConversation: LessonConversationTurn[];
  lessonTypeEnum: LessonType;
};

export function getPendingAudioDirectory(): string {
  return PENDING_AUDIO_DIR;
}

export async function ensurePendingAudioDirectory(): Promise<void> {
  if (Platform.OS === 'web' || !documentDirectory) return;
  const info = await getInfoAsync(PENDING_AUDIO_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(PENDING_AUDIO_DIR, { intermediates: true });
  }
}

export async function saveRecordingToPendingAudio(tempUri: string): Promise<string | null> {
  if (Platform.OS === 'web' || !documentDirectory) return null;
  await ensurePendingAudioDirectory();
  const dest = `${PENDING_AUDIO_DIR}${Date.now()}-${Math.random().toString(36).slice(2, 7)}.m4a`;
  await copyAsync({ from: tempUri, to: dest });
  return dest;
}

export async function deletePendingAudioFile(path: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const info = await getInfoAsync(path);
    if (info.exists) {
      await deleteAsync(path, { idempotent: true });
    }
  } catch {
    // Non-blocking cleanup.
  }
}

async function readPendingTasks(): Promise<PendingAudioTask[]> {
  const raw = await AsyncStorage.getItem(PENDING_AUDIO_TASKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingAudioTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePendingTasks(tasks: PendingAudioTask[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_AUDIO_TASKS_KEY, JSON.stringify(tasks));
}

export async function getPendingAudioTasks(): Promise<PendingAudioTask[]> {
  return readPendingTasks();
}

export async function addPendingAudioTask(task: PendingAudioTask): Promise<void> {
  const tasks = await readPendingTasks();
  tasks.push(task);
  await writePendingTasks(tasks);
}

export async function updatePendingAudioTask(
  id: string,
  patch: Partial<PendingAudioTask>,
): Promise<void> {
  const tasks = await readPendingTasks();
  const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await writePendingTasks(next);
}

export async function expireOldPendingTasks(): Promise<PendingAudioTask[]> {
  const now = Date.now();
  const tasks = await readPendingTasks();
  let changed = false;

  const next = tasks.map((task) => {
    if (task.processed || task.expired) return task;
    if (now - task.recordedAt <= EXPIRE_AFTER_MS) return task;
    changed = true;
    void Promise.all(task.audioPaths.map((p) => deletePendingAudioFile(p)));
    void markLessonSpeakingExpired(task.lessonDate, task.lessonType);
    return { ...task, expired: true, processed: true };
  });

  if (changed) {
    await writePendingTasks(next);
  }
  return next;
}
