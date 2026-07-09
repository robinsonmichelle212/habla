import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonType } from '@/lib/claude';
import type {
  LessonConversationTurn,
  SpeakingEvaluation,
  WritingEvaluation,
} from '@/lib/lesson-session';

const CHECKPOINT_KEY = 'habla.lessonCheckpoint';

export type LessonCheckpoint = {
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
  savedAt: number;
};

export async function saveLessonCheckpoint(checkpoint: LessonCheckpoint): Promise<void> {
  await AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

export async function getLessonCheckpoint(): Promise<LessonCheckpoint | null> {
  const raw = await AsyncStorage.getItem(CHECKPOINT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LessonCheckpoint;
    if (!parsed?.lessonDate || !parsed?.lessonType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLessonCheckpoint(): Promise<void> {
  await AsyncStorage.removeItem(CHECKPOINT_KEY);
}
