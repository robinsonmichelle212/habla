import type { LessonType, JaviMessage } from '@/lib/claude';
import type { LessonFocusContext } from '@/lib/lesson-focus';

export type LessonConversationTurn = {
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

export type LessonBreakdown = {
  grammar: { score: number; topic: string; details: string[] };
  vocabulary: { score: number; topic: string; details: string[] };
  fluency: { score: number; details: string[] };
  writing: { score: number; details: string[] };
};

export type LessonAnalysis = {
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  correctnessScore: number; // 0-100
  overallScore: number;
  encouragingMessage: string; // Spanish then English
  breakdown: LessonBreakdown;
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
  lessonFocus?: LessonFocusContext;
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

