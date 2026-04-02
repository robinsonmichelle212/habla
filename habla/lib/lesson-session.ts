import type { LessonType, JaviMessage } from '@/lib/claude';

export type LessonConversationTurn = {
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

export type LessonAnalysis = {
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  correctnessScore: number; // 0-100
  encouragingMessage: string; // Spanish then English
};

export type DrillExercise = {
  id: string;
  prompt: string;
  expectedAnswer?: string;
};

export type WritingTask = {
  prompt: string;
};

export type WritingCorrection = {
  mistake: string;
  correction: string;
  explanation: string;
};

export type WritingEvaluation = {
  originalText: string;
  correctedText: string;
  grammarScore: number; // 0-100
  vocabularyScore: number; // 0-100
  fluencyScore: number; // 0-100
  feedback: string;
  corrections: WritingCorrection[];
};

export type LessonSessionState = {
  lessonType?: LessonType;
  conversation: LessonConversationTurn[];
  analysis?: LessonAnalysis;
  drills?: DrillExercise[];
  writingTask?: WritingTask;
  writingEvaluation?: WritingEvaluation;
};

let state: LessonSessionState = {
  conversation: [],
};

export function setLessonSession(next: Partial<LessonSessionState>) {
  state = {
    ...state,
    ...next,
  };
}

export function getLessonSession(): LessonSessionState {
  return state;
}

export function resetLessonSession() {
  state = { conversation: [] };
}

export function conversationToJaviMessages(conversation: LessonConversationTurn[]): JaviMessage[] {
  return conversation
    .map((t) => ({ role: t.role, content: t.spanish?.trim() || '' }))
    .filter((t) => t.content.length > 0);
}

