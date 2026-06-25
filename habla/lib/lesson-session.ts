import type { LessonType, JaviMessage } from '@/lib/claude';
import type { ReadComprehensionEvaluation, ReadingSessionContent } from '@/lib/read-with-javi';
import type { LessonFocusContext } from '@/lib/lesson-focus';

export type LessonConversationTurn = {
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

export type LessonBreakdown = {
  grammar: {
    score: number;
    topic: string;
    details: string[];
    lessonDescription?: string;
    mistakes?: { mistake: string; correction: string; explanation: string }[];
  };
  vocabulary: {
    score: number;
    topic: string;
    details: string[];
    wordsCorrect?: { spanish: string; english: string }[];
    wordsToRevisit?: { spanish: string; english: string }[];
  };
  fluency: {
    score: number;
    details: string[];
    description?: string;
    positivePatterns?: string[];
    negativePatterns?: string[];
    sentenceNotes?: string[];
    weeklyTips?: string[];
  };
  writing: {
    score: number;
    details: string[];
    originalText?: string;
    correctedText?: string;
    corrections?: WritingCorrection[];
    accentIssues?: string[];
    structuralFeedback?: string[];
    writingPrompt?: string;
  };
  structure?: {
    score: number;
    topic: string;
    details: string[];
    lessonDescription?: string;
    wordOrderMistakes?: { mistake: string; correction: string; explanation: string }[];
  };
  reading?: {
    score: number;
    topic: string;
    textType: string;
    details: string[];
    wordsLearned?: { spanish: string; english: string }[];
    grammarPatterns?: string[];
  };
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
  grammarScore: number;
  vocabularyScore: number;
  fluencyScore: number;
  structureScore?: number;
  feedback: string;
  corrections: WritingCorrection[];
  accentIssues?: string[];
  structuralFeedback?: string[];
  wordOrderErrors?: WritingCorrection[];
};

export type SpeakingEvaluation = {
  attempt1Score: number;
  attempt2Score: number | null;
  combinedScore: number;
  improved: boolean;
  javiFeedback: string;
  /** Overall speaking score — same as combinedScore */
  score: number;
  accuracyVsWritten?: number;
  correctionsApplied?: boolean;
  pronunciationNotes?: string[];
  feedback?: string;
  exchangeCount?: number;
};

export type LessonSessionState = {
  lessonType?: LessonType;
  lessonFocus?: LessonFocusContext;
  warmUpConversation: LessonConversationTurn[];
  speakingConversation: LessonConversationTurn[];
  /** @deprecated use warmUpConversation + speakingConversation */
  conversation: LessonConversationTurn[];
  analysis?: LessonAnalysis;
  drills?: DrillExercise[];
  writingTask?: WritingTask;
  writingEvaluation?: WritingEvaluation;
  speakingEvaluation?: SpeakingEvaluation;
  readingSession?: ReadingSessionContent;
  comprehensionEvaluation?: ReadComprehensionEvaluation;
  culturalNoteSaved?: string;
  wordsSavedFromReading?: { spanish: string; english: string }[];
};

let state: LessonSessionState = {
  warmUpConversation: [],
  speakingConversation: [],
  conversation: [],
};

export function setLessonSession(next: Partial<LessonSessionState>) {
  state = {
    ...state,
    ...next,
    warmUpConversation: next.warmUpConversation ?? state.warmUpConversation ?? [],
    speakingConversation: next.speakingConversation ?? state.speakingConversation ?? [],
    conversation: next.conversation ?? state.conversation ?? [],
  };
}

export function getLessonSession(): LessonSessionState {
  return state;
}

export function resetLessonSession() {
  state = { warmUpConversation: [], speakingConversation: [], conversation: [] };
}

export function conversationToJaviMessages(conversation: LessonConversationTurn[]): JaviMessage[] {
  return conversation
    .map((t) => ({ role: t.role, content: t.spanish?.trim() || '' }))
    .filter((t) => t.content.length > 0);
}

