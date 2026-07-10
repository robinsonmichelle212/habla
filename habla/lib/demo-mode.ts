import type { LessonAnalysis, DrillExercise, SpeakingEvaluation, WritingEvaluation } from '@/lib/lesson-session';
import { lessonFocusLabel, type LessonFocusContext } from '@/lib/lesson-focus';

export const DEMO_SESSION_NOTICE = 'Demo session — not saved to your progress 🎭';

export function demoTopicLabel(focus: LessonFocusContext): string {
  return lessonFocusLabel(focus);
}

export function demoWarmUpOpening(topic: string): { spanish: string; translation: string } {
  const spanish = `Demo mode: Hola! Vamos a practicar el ${topic}. Esta es una lección de demostración.`;
  return {
    spanish,
    translation: `Demo mode: Hi! Let's practice ${topic}. This is a demo lesson.`,
  };
}

export const DEMO_WRITING_PROMPT =
  'Escribe dos o tres frases en español sobre tu día. (Modo demo)';

export function demoWritingEvaluation(text: string): WritingEvaluation {
  return {
    originalText: text,
    correctedText: text,
    grammarScore: 85,
    vocabularyScore: 80,
    fluencyScore: 82,
    structureScore: 78,
    feedback:
      'Demo evaluation: Good effort! Grammar: 85% · Vocabulary: 80% · Fluency: 82% · Writing: 78%',
    corrections: [
      {
        mistake: '—',
        correction: '—',
        explanation: 'No corrections in demo mode.',
      },
    ],
    accentIssues: [],
    structuralFeedback: [],
    wordOrderErrors: [],
  };
}

export function demoSpeakingEvaluation(): SpeakingEvaluation {
  const fluencyScore = 80;
  const confidenceScore = 75;
  const vocabularyRangeScore = 78;
  const naturalFlowScore = 77;
  const combinedScore = Math.round(
    (fluencyScore + confidenceScore + vocabularyRangeScore + naturalFlowScore) / 4,
  );
  const feedback = 'Demo mode: Speaking registered. Fluency: 80% · Confidence: 75%';
  return {
    fluencyScore,
    confidenceScore,
    vocabularyRangeScore,
    naturalFlowScore,
    combinedScore,
    score: combinedScore,
    javiFeedback: feedback,
    feedback,
    exchangeCount: 1,
    pronunciationNotes: [],
  };
}

export function demoLessonAnalysis(): LessonAnalysis {
  return {
    strongAreas: [
      'Good vocabulary range',
      'Confident sentence construction',
      'Effective use of target grammar',
    ],
    weakAreas: ['Demo mode — no real weak areas identified'],
    focusAreas: ['Demo mode — continue with curriculum'],
    correctnessScore: 82,
    overallScore: 78,
    encouragingMessage: '¡Buen trabajo! / Great work completing your demo lesson.',
    breakdown: {
      grammar: { score: 85, topic: 'Grammar', details: [], mistakes: [] },
      vocabulary: { score: 80, topic: 'Vocabulary', details: [] },
      fluency: { score: 80, details: [], description: 'Demo speaking' },
      writing: { score: 78, details: [] },
    },
  };
}

export const DEMO_DAILY_CHALLENGE = 'Demo challenge: Think of one Spanish word right now.';

export const DEMO_DRILLS: DrillExercise[] = [
  {
    id: 'demo-1',
    prompt: "Conjugate 'hablar' in present tense, yo form",
    expectedAnswer: 'hablo',
  },
  {
    id: 'demo-2',
    prompt: "What does 'tener' mean?",
    expectedAnswer: 'to have',
  },
  {
    id: 'demo-3',
    prompt: 'Ser or Estar? Yo ___ cansado',
    expectedAnswer: 'estoy',
  },
  {
    id: 'demo-4',
    prompt: 'Translate: I went to the shops',
    expectedAnswer: 'Fui a las tiendas',
  },
  {
    id: 'demo-5',
    prompt: "What is the preterite of 'ir', él form?",
    expectedAnswer: 'fue',
  },
];

function normalizeDrillAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?¿¡,;:'"]/g, '')
    .replace(/\s+/g, ' ');
}

export function scoreDemoDrillAnswer(
  expected: string | undefined,
  answer: string,
): { score: number; feedback: string; correctAnswer?: string } {
  if (!expected) {
    return { score: 75, feedback: 'Marked in demo mode.', correctAnswer: undefined };
  }
  const match = normalizeDrillAnswer(answer) === normalizeDrillAnswer(expected);
  return {
    score: match ? 100 : 0,
    feedback: match
      ? 'Correct! (demo mode)'
      : `Not quite. Suggested answer: ${expected}`,
    correctAnswer: expected,
  };
}
