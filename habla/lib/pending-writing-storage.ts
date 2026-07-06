import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import type { LessonConversationTurn } from '@/lib/lesson-session';

export const PENDING_WRITING_TASKS_KEY = 'pendingWritingTasks';

export type PendingWritingTask = {
  id: string;
  writtenResponse: string;
  lessonDate: string;
  lessonType: string;
  grammarTopic: string;
  writingPrompt: string;
  submittedAt: number;
  evaluated: boolean;
  warmUpConversation: LessonConversationTurn[];
  lessonFocusLabel: string;
  lessonTypeEnum: LessonType;
};

async function readTasks(): Promise<PendingWritingTask[]> {
  const raw = await AsyncStorage.getItem(PENDING_WRITING_TASKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingWritingTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTasks(tasks: PendingWritingTask[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_WRITING_TASKS_KEY, JSON.stringify(tasks));
}

export async function getPendingWritingTasks(): Promise<PendingWritingTask[]> {
  return readTasks();
}

export async function addPendingWritingTask(task: PendingWritingTask): Promise<void> {
  const tasks = await readTasks();
  tasks.push(task);
  await writeTasks(tasks);
}

export async function updatePendingWritingTask(
  id: string,
  patch: Partial<PendingWritingTask>,
): Promise<void> {
  const tasks = await readTasks();
  await writeTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export async function getUnevaluatedWritingTasks(): Promise<PendingWritingTask[]> {
  const tasks = await readTasks();
  return tasks.filter((t) => !t.evaluated).sort((a, b) => a.submittedAt - b.submittedAt);
}
