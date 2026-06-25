import Anthropic from '@anthropic-ai/sdk';

import { formatErrorDnaForDrillPrompt, type ErrorDNAInput } from '@/lib/error-dna';

import { CORE_VOCABULARY_PROMPT } from '@/lib/core-vocabulary';
import type { LessonFocusContext } from '@/lib/lesson-focus';

/** Matches the lesson chips on the lesson screen. */
export type LessonType = 'Grammar' | 'Vocab' | 'Your Day' | 'Structure';

export type LessonKindId = 'grammar' | 'vocabulary' | 'your-day' | 'structure';

export function lessonKindToLessonType(kind: LessonKindId): LessonType {
  switch (kind) {
    case 'grammar':
      return 'Grammar';
    case 'vocabulary':
      return 'Vocab';
    case 'your-day':
      return 'Your Day';
    case 'structure':
      return 'Structure';
  }
}

export type PracticeDrillType = 'grammar' | 'vocabulary' | 'fluency';

export type JaviMessage = { role: 'user' | 'assistant'; content: string };

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Missing EXPO_PUBLIC_ANTHROPIC_API_KEY environment variable.',
    );
  }
  return key;
}

function getClient(): Anthropic {
  const apiKey = getApiKey();
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

function getModel(): string {
  return process.env.EXPO_PUBLIC_ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function buildFocusInstructions(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return `GRAMMAR CURRICULUM (Week ${focus.weekNumber} of 20 — follow this structure strictly):
- Topic: ${focus.topic} (${focus.topicSpanish})
- Week focus: ${focus.weekSummary}
- Focus verbs this week: ${focus.focusVerbs.join(', ')}
- Every Grammar lesson this week practises ONLY this grammar point and these verbs.

LESSON STRUCTURE — follow in order across the conversation:

PART 1 — WHY AND WHEN (your first 2–3 messages in this session):
- Explain in simple B1 Spanish when this grammar point is used and why it matters.
- Use the Translate: line on every message so English is available via reveal.
- Give 2 real-life examples using high-frequency vocabulary (core 50 words first).
- Example style: "El pretérito indefinido se usa para acciones completadas en el pasado."

PART 2 — GUIDED PRACTICE (next 3–4 exchanges):
- Create sentences using ONLY top-1000 most common Spanish words.
- Ask the learner to respond using the target tense/structure.
- Use this week's focus verbs: ${focus.focusVerbs.join(', ')}.
- Gently correct mistakes and explain why in one short sentence.

${
  focus.includesContrast
    ? `PART 3 — CONTRAST (final 1–2 exchanges — required this week):
- Present short story-telling scenarios where preterite vs imperfect choice matters.
- Ask which tense to use and why.`
    : ''
}
- Never switch to a different grammar topic mid-lesson.
- Track where you are in the structure based on how many exchanges have happened.`;
    case 'vocabulary':
      return `VOCABULARY THEME (this session only):
- Theme: ${focus.theme}
- Introduce 2–3 new words per message from this theme, used naturally in context; briefly reinforce meaning.
- Stay within this theme for the whole conversation.`;
    case 'your-day':
      return `CONVERSATION STARTER (this session only):
- Angle: ${focus.starter}
- Open and follow up with natural questions about the learner's life along this angle.
- Keep the chat personal, warm, and conversational.`;
    case 'structure':
      return `SENTENCE STRUCTURE LESSON — Topic ${focus.topic.id}: ${focus.topic.title}
- Core idea: ${focus.topic.summary}
- Teaching focus: ${focus.topic.focus}
- Examples to use: ${focus.topic.examples.join(' · ')}

PHASE 1 — EXPLAIN (warm-up messages):
- Explain WHY Spanish works this way, not just the rule.
- Use clear English and Spanish examples side by side.
- Keep each message to 2 short Spanish sentences + Translate: line.
- Do NOT drill yet — teach the concept simply in ~4 messages.
- Stay on this structure topic only for the whole lesson.`;
  }
}

function buildErrorDnaAppendix(topErrors: ErrorDNAInput[]): string {
  if (!topErrors.length) return '';

  const lines = topErrors
    .slice(0, 3)
    .map((item) => {
      const example = item.example ? ` (e.g. ${item.example})` : '';
      return `- ${item.error}${example}`;
    })
    .join('\n');

  return `

These are this user's most persistent errors based on their history:
${lines}
Naturally watch for these specific mistakes during the lesson. If they occur, gently correct them and reference that this is a recurring pattern: "Recuerda — esto es algo en lo que seguimos trabajando juntos."`;
}

function buildSystemPrompt(
  lessonType: LessonType,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): string {
  return `You are Javi, a warm, encouraging Spanish tutor in a mobile app.

This session's lesson type: ${lessonType}
${buildFocusInstructions(focus)}

${CORE_VOCABULARY_PROMPT}

Voice and level:
- Speak at B1 Spanish (CEFR): not too easy, not too hard—clear, natural, learner-appropriate.
- Use simple, everyday vocabulary; avoid rare or overly literary words unless you are deliberately teaching a new word in a Vocab lesson.
- Be encouraging and friendly.

Dialect (Spain Castilian as default; Argentina for contrast):
- You primarily use Spain (Castilian) Spanish: vosotros when plural informal fits, Spain-typical pronunciation hints when helpful, and Spain-specific vocabulary and expressions as your default.
- Grammar and idioms should follow European Spanish norms unless you are illustrating a contrast.
- When a word or phrase differs meaningfully in Argentina, add the Argentine equivalent in brackets exactly like: [🇦🇷 Argentine: …] (keep it short—often just the word or phrase, e.g. [🇦🇷 Argentine: auto] if you said "coche").
- When a natural moment arises, briefly highlight Spain vs Argentina vocabulary or usage—conversationally, not as a lecture. Occasionally drop in an interesting dialect tidbit unprompted so it feels educational but still chatty, never textbook-y.

Response format (every message must follow this structure):
1) If the learner made Spanish mistakes, gently correct them first in one short sentence if possible, then continue. If there were no meaningful errors, skip correction and respond warmly.
2) Your main reply in Spanish only: at most 2–3 sentences (bracketed [🇦🇷 Argentine: …] notes count as part of this Spanish block). Do not put English inside the Spanish block—no English glosses or translations there (dialect tags in Spanish are fine).
3) On its own line after the Spanish, add the English translation using exactly this prefix (nothing before it on that line):
   Translate: <English translation of your Spanish sentences>
   The Translate line reveals the meaning; everything above it stays Spanish-only.

General:
- Stay on this lesson type; if the learner drifts, acknowledge briefly and steer back.
- Your name is Javi; sign sparingly.
- Never use any markdown formatting in your responses. No asterisks, no bold, no italics, no bullet points, no hyphens as list markers, no hashtags, no underscores. Write in plain natural sentences only as if speaking out loud.

Vocabulary teaching (all lesson types):
- Roughly once per conversation (not every message), naturally introduce 1–2 words slightly above B1 level.
- Use each new word in a natural Spanish sentence first, then briefly explain in Spanish on a new line starting with "Por cierto —" e.g. "Por cierto — 'conseguir' means to achieve or to get. You might want to save that one."
- Keep it conversational — never turn into a vocabulary list. The learner can save words with the app's Save a word feature.${buildErrorDnaAppendix(topErrors)}`;
}

function extractText(response: Anthropic.Messages.Message): string {
  const blocks = response.content;
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('\n').trim() || '(Sin respuesta)';
}

function extractFirstJsonObject(text: string): unknown {
  // Best-effort: find the first JSON object in the output and parse it.
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Claude did not return JSON.');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') inString = true;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      const jsonSlice = text.slice(start, i + 1);
      return JSON.parse(jsonSlice);
    }
  }

  throw new Error('Claude returned incomplete JSON.');
}

export type LessonBreakdownJson = {
  grammar: {
    score: number;
    topic: string;
    details: string[];
    lessonDescription: string;
    mistakes: { mistake: string; correction: string; explanation: string }[];
  };
  vocabulary: {
    score: number;
    topic: string;
    details: string[];
    wordsCorrect: { spanish: string; english: string }[];
    wordsToRevisit: { spanish: string; english: string }[];
  };
  fluency: {
    score: number;
    details: string[];
    description: string;
    positivePatterns: string[];
    negativePatterns: string[];
    sentenceNotes: string[];
    weeklyTips: string[];
  };
  writing: {
    score: number;
    details: string[];
  };
  structure?: {
    score: number;
    topic: string;
    details: string[];
    lessonDescription: string;
    wordOrderMistakes: { mistake: string; correction: string; explanation: string }[];
  };
};

export type ErrorDNAAnalysisItem = {
  error: string;
  category: 'grammar' | 'writing' | 'vocabulary' | 'speaking' | 'structure' | 'word-order';
  occurrences: number;
  example: string;
  correction: string;
};

export type LessonAnalysisJson = {
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  correctnessScore: number;
  overallScore: number;
  encouragingMessage: string;
  breakdown: LessonBreakdownJson;
  errorDNA?: ErrorDNAAnalysisItem[];
};

export type WritingTaskJson = {
  prompt: string;
};

export type WritingEvaluationJson = {
  correctedText: string;
  grammarScore: number;
  vocabularyScore: number;
  fluencyScore: number;
  structureScore?: number;
  feedback: string;
  corrections: { mistake: string; correction: string; explanation: string }[];
  accentIssues: string[];
  structuralFeedback: string[];
  wordOrderErrors?: { mistake: string; correction: string; explanation: string }[];
};

export type DrillExerciseJson = {
  id: string;
  prompt: string;
  expectedAnswer?: string;
};

export type DrillCheckJson = {
  score: number; // 0-100
  feedbackSpanish: string;
  feedbackEnglish: string;
  correctAnswer?: string;
};

export type PrioritizedWeakAreaInput = {
  label: string;
  frequency: number;
};

function drillTypeToHumanLabel(drillType: PracticeDrillType): string {
  switch (drillType) {
    case 'grammar':
      return 'Grammar drill';
    case 'vocabulary':
      return 'Vocabulary drill';
    case 'fluency':
      return 'Fluency drill';
  }
}

/**
 * Sends the user's message to Claude as Javi. Pass prior turns (excluding the current message)
 * so the conversation stays coherent.
 */
export async function askJavi(
  lessonType: LessonType,
  userMessage: string,
  priorExchanges: JaviMessage[] = [],
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new Error('Message is empty.');
  }

  const anthropic = getClient();
  const model = getModel();

  const messages: Anthropic.Messages.MessageParam[] = [
    ...priorExchanges.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user' as const, content: trimmed },
  ];

  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: buildSystemPrompt(lessonType, focus, topErrors),
    messages,
  });

  return extractText(response);
}

const WARMUP_PHASE_APPENDIX = `
LESSON PHASE: WARM-UP (written exchange only).
- Greet the learner and introduce today's topic and focus clearly.
- Highlight key verbs, vocabulary, and/or structures they should use today.
- Keep each message to 2 short Spanish sentences maximum, then Translate: line.
- Be warm and practical — this prepares them for writing and speaking later.`;

const SPEAKING_PHASE_APPENDIX = `
LESSON PHASE: SPEAKING (voice only — learner listens to you).
- Keep Spanish replies to 1–2 short sentences only. Plain spoken Spanish, no markdown.
- Respond conversationally to what they said.
- Gently correct one mistake if needed, then continue naturally.`;

export async function generateWarmUpOpening(
  lessonType: LessonType,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const openingPrompt =
    focus.kind === 'structure'
      ? `Start the warm-up. Message 1 of 4. Explain today's structure point (${focus.topic.title}): ${focus.topic.summary}. Use clear English and Spanish examples. Explain WHY, not just the rule. End with Translate: line.`
      : 'Start the warm-up. Message 1 of 4. Introduce today\'s topic, focus area, and 2–3 verbs or structures to practise. End with Translate: line.';

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${WARMUP_PHASE_APPENDIX}`,
    messages: [
      {
        role: 'user',
        content: openingPrompt,
      },
    ],
  });

  return extractText(response);
}

export async function askJaviWarmUp(
  lessonType: LessonType,
  userMessage: string,
  priorExchanges: JaviMessage[],
  focus: LessonFocusContext,
  javiMessageNumber: number,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();
  const target = 4;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${WARMUP_PHASE_APPENDIX}
You have sent ${javiMessageNumber} message(s) so far. Send warm-up message ${javiMessageNumber + 1} of about ${target}. ${
      javiMessageNumber >= target - 1
        ? 'This should be your final warm-up message — summarise what to focus on and encourage them for the writing task.'
        : 'Introduce another useful verb, structure, or vocabulary item for today.'
    }`,
    messages: [
      ...priorExchanges.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage.trim() },
    ],
  });

  return extractText(response);
}

export async function generateSpeakingIntro(
  lessonType: LessonType,
  taskPrompt: string,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 350,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${SPEAKING_PHASE_APPENDIX}`,
    messages: [
      {
        role: 'user',
        content: `The learner completed a writing task. Now they must speak the same response aloud.
Start with "Ahora dímelo." then repeat this scenario in Spanish (1–2 sentences), then Translate: line.

Writing task prompt:
${taskPrompt}`,
      },
    ],
  });

  return extractText(response);
}

export async function askJaviSpeaking(
  lessonType: LessonType,
  userMessage: string,
  priorExchanges: JaviMessage[],
  focus: LessonFocusContext,
  writingContext: { originalText: string; correctedText: string; corrections: { mistake: string; correction: string }[] },
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 280,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${SPEAKING_PHASE_APPENDIX}
The learner's written version was:
${writingContext.originalText}
Corrected version:
${writingContext.correctedText}
Key corrections from writing:
${JSON.stringify(writingContext.corrections.slice(0, 4))}`,
    messages: [
      ...priorExchanges.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage.trim() },
    ],
  });

  return extractText(response);
}

export type SpeakingEvaluationJson = {
  score: number;
  accuracyVsWritten: number;
  correctionsApplied: boolean;
  pronunciationNotes: string[];
  feedback: string;
};

export async function evaluateSpeakingPhase(
  lessonType: LessonType,
  taskPrompt: string,
  writtenOriginal: string,
  writtenCorrected: string,
  writingCorrections: { mistake: string; correction: string; explanation: string }[],
  speakingTranscripts: string[],
  speakingConversation: JaviMessage[],
): Promise<SpeakingEvaluationJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi evaluating spoken Spanish at B1 level.
Return ONLY valid JSON. No markdown.`;

  const user = `Evaluate the learner's speaking phase.

Return JSON exactly:
{
  "score": 0-100 integer (overall speaking: accuracy, flow, natural conversation),
  "accuracyVsWritten": 0-100 integer (how closely spoken content matches their written/corrected version),
  "correctionsApplied": boolean (did they apply writing corrections when speaking?),
  "pronunciationNotes": array of up to 3 short notes if Whisper transcripts suggest unclear words or mispronunciation,
  "feedback": 2 sentences encouraging feedback from Javi in English
}

Lesson type: ${lessonType}
Writing task: ${taskPrompt}
Written (original): ${writtenOriginal}
Written (corrected): ${writtenCorrected}
Writing corrections: ${JSON.stringify(writingCorrections)}
Whisper transcripts (what they actually said): ${JSON.stringify(speakingTranscripts)}
Speaking conversation: ${JSON.stringify(speakingConversation)}
${lessonType === 'Structure' ? '\nThis is a Sentence Structure lesson — also evaluate natural word order and rhythm in speech.' : ''}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  return extractFirstJsonObject(text) as SpeakingEvaluationJson;
}

export async function analyzeLessonPhases(
  lessonType: LessonType,
  warmUpConversation: JaviMessage[],
  speakingConversation: JaviMessage[],
  writingScores: {
    grammarScore: number;
    vocabularyScore: number;
    fluencyScore: number;
    structureScore?: number;
  },
  speakingEvaluation: SpeakingEvaluationJson,
  lessonFocusLabel?: string,
): Promise<LessonAnalysisJson> {
  const combined = [...warmUpConversation, ...speakingConversation];
  const analysis = await analyzeConversation(
    lessonType,
    combined,
    writingScores,
    lessonFocusLabel,
  );

  const speakingScore = Math.max(0, Math.min(100, Math.round(speakingEvaluation.score)));
  const writingAvg = Math.round(
    (writingScores.grammarScore + writingScores.vocabularyScore + writingScores.fluencyScore) / 3,
  );
  const isStructure = lessonType === 'Structure';
  const structureScore = Math.round(writingScores.structureScore ?? analysis.breakdown.structure?.score ?? 0);

  let overallScore: number;
  if (isStructure) {
    const parts = [
      analysis.breakdown.grammar.score,
      analysis.breakdown.vocabulary.score,
      analysis.breakdown.fluency.score,
      analysis.breakdown.writing.score,
      structureScore || analysis.breakdown.structure?.score || writingAvg,
      speakingScore,
    ];
    overallScore = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  } else {
    overallScore = Math.round((writingAvg + speakingScore) / 2);
  }

  const weakFromSpeaking = speakingEvaluation.correctionsApplied
    ? []
    : ['Apply writing corrections when speaking'];
  const weakAreas = [...(analysis.weakAreas ?? []), ...weakFromSpeaking].slice(0, 3);

  return {
    ...analysis,
    overallScore,
    correctnessScore: Math.round((analysis.correctnessScore + speakingEvaluation.accuracyVsWritten) / 2),
    weakAreas,
    breakdown: {
      ...analysis.breakdown,
      ...(isStructure
        ? {
            structure: {
              ...(analysis.breakdown.structure ?? {
                score: structureScore,
                topic: lessonFocusLabel ?? 'Sentence structure',
                details: [],
                lessonDescription: '',
                wordOrderMistakes: [],
              }),
              score: Math.round(
                (structureScore +
                  (analysis.breakdown.structure?.score ?? structureScore) +
                  speakingEvaluation.accuracyVsWritten) /
                  3,
              ),
              details: [
                ...(analysis.breakdown.structure?.details ?? []).slice(0, 1),
                speakingEvaluation.correctionsApplied
                  ? 'Word order carried into speech'
                  : 'Focus on word order when speaking corrected sentences',
              ].filter(Boolean),
            },
          }
        : {}),
      fluency: {
        ...analysis.breakdown.fluency,
        score: Math.round((analysis.breakdown.fluency.score + speakingScore) / 2),
        details: [
          ...(analysis.breakdown.fluency.details ?? []).slice(0, 1),
          speakingEvaluation.correctionsApplied
            ? 'Writing corrections carried into speech'
            : 'Try to apply your writing corrections when you speak',
        ].filter(Boolean),
        description:
          analysis.breakdown.fluency.description ??
          `Speaking score ${speakingScore}% · accuracy vs written ${speakingEvaluation.accuracyVsWritten}%`,
      },
    },
  };
}

export async function analyzeConversation(
  lessonType: LessonType,
  conversation: JaviMessage[],
  writingScores?: {
    grammarScore: number;
    vocabularyScore: number;
    fluencyScore: number;
    structureScore?: number;
  },
  lessonFocusLabel?: string,
): Promise<LessonAnalysisJson> {
  const isStructure = lessonType === 'Structure';
  const structureBlock = isStructure
    ? `
  - structure: {
      score: 0-100 integer (sentence structure and word order — use structureScore from writing if provided),
      topic: string (today's structure topic),
      details: array of exactly 2 short notes on word order / structure,
      lessonDescription: 2 sentences on what structure point was practised,
      wordOrderMistakes: array of up to 4 word-order or construction mistakes, each { mistake, correction, explanation }
    }`
    : '';

  const anthropic = getClient();
  const model = getModel();

  const system = `You are an expert Spanish teacher and evaluator for a B1 learner.
Return ONLY valid JSON. No markdown. No extra keys. No trailing commentary.`;

  const user = `Analyze this lesson conversation and return a JSON object with exactly these keys:
- strongAreas: array of 3 things the user did well
- weakAreas: array of 3 things the user struggled with
- focusAreas: array of 2 specific ${isStructure ? 'sentence structure' : 'grammar or vocabulary'} topics to practise next
- correctnessScore: integer percent (0-100) for overall Spanish correctness
- overallScore: integer percent (0-100) average across ${isStructure ? 'grammar, vocabulary, fluency, writing, and structure' : 'grammar, vocabulary, fluency, and writing'} in breakdown
- encouragingMessage: one short motivational sentence in Spanish then English (same line, separated by " / ")
- errorDNA: array of specific recurring mistake patterns from this lesson (empty array if none). Each item:
  { error: string (concise pattern description), category: "grammar"|"writing"|"vocabulary"|"speaking"|"structure"|"word-order", occurrences: 1, example: string (real mistake from this lesson), correction: string (how to fix + brief explanation) }
  Only include precise, repeatable mistakes — not vague weak areas. Set occurrences to 1 for each new pattern found today.
  ${isStructure ? 'Tag word-order and construction mistakes as category "word-order" (or "structure" for broader lesson patterns).' : 'Tag word-order mistakes as category "word-order".'}
- breakdown: object with:
  - grammar: {
      score: 0-100 integer,
      topic: string (e.g. "Past tense (preterite)"),
      details: array of exactly 2 short notes (one positive, one to improve),
      lessonDescription: 2-3 sentences describing what grammar was covered and practised today,
      mistakes: array of up to 4 specific mistakes from the conversation, each { mistake, correction, explanation }
    }
  - vocabulary: {
      score: 0-100 integer,
      topic: string (e.g. "Food and cooking"),
      details: array of exactly 2 short notes,
      wordsCorrect: array of up to 6 words used well, each { spanish, english },
      wordsToRevisit: array of up to 4 words the learner was uncertain about or used wrong, each { spanish, english }
    }
  - fluency: {
      score: 0-100 integer,
      details: array of exactly 2 short notes,
      description: one sentence explaining what the fluency score reflects,
      positivePatterns: array of 2 things the learner did well with flow/structure,
      negativePatterns: array of 2 patterns that held fluency back,
      sentenceNotes: array of 2 notes on sentence construction,
      weeklyTips: array of 2 practical tips from Javi for improving fluency this week
    }
  - writing: {
      score: 0-100 integer,
      details: array of exactly 2 short notes about writing (use writing scores if provided)
    }${structureBlock}

Lesson type: ${lessonType}
Lesson focus / topic context: ${lessonFocusLabel ?? 'General B1 practice'}

Writing scores (optional, may be null):
${writingScores ? JSON.stringify(writingScores) : 'null'}

Rules:
- Use writing scores to set breakdown.grammar.score, breakdown.vocabulary.score, breakdown.fluency.score where appropriate.
- breakdown.writing.score should reflect writing quality (use writing scores as a guide).
${isStructure ? '- breakdown.structure.score must use structureScore from writing scores when provided.\n- breakdown.structure.topic must match the lesson focus.\n- Tag word-order patterns in errorDNA as category "word-order".' : ''}
- breakdown.grammar.topic and breakdown.vocabulary.topic must reflect what was practised in this lesson.
- overallScore must be the rounded average of the ${isStructure ? 'five' : 'four'} breakdown scores${isStructure ? ' (grammar, vocabulary, fluency, writing, structure)' : ''}.
- weakAreas and focusAreas must align with breakdown details.
- Populate ALL nested breakdown fields with real observations from the conversation — never leave arrays empty; use best-effort inference if needed.
- wordsCorrect / wordsToRevisit must use real Spanish words from the conversation where possible.

Conversation turns (role + content):
${JSON.stringify(conversation, null, 2)}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2200,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as LessonAnalysisJson;
  return parsed;
}

function writingTaskFocusLine(focus: LessonFocusContext): string {
  switch (focus.kind) {
    case 'grammar':
      return `This week's grammar focus: ${focus.topic}. Ask the learner to write 3 sentences using this grammar point.`;
    case 'vocabulary':
      return `Vocabulary theme: ${focus.theme}. Ask the learner to write a short paragraph using 5 words from this theme that came up in the conversation.`;
    case 'your-day':
      return `Conversation angle: ${focus.starter}. Ask the learner to write 4–5 sentences in Spanish about this topic.`;
    case 'structure':
      return `Structure topic: ${focus.topic.title} — ${focus.topic.summary}
Ask the learner to rewrite exactly 5 English sentences in correct Spanish word order.
${focus.topic.writingHint}
List the 5 English sentences clearly numbered 1–5 in the prompt. Each tests today's structure point: ${focus.topic.focus}`;
  }
}

export async function generateWritingTask(
  lessonType: LessonType,
  conversation: JaviMessage[],
  focus: LessonFocusContext,
): Promise<WritingTaskJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a Spanish tutor.
Return ONLY valid JSON. No markdown.`;

  const user = `Create a writing task prompt for a B1 learner.
${writingTaskFocusLine(focus)}
Keep it friendly, short, and clear.

Return JSON exactly:
{ "prompt": "..." }

Lesson type: ${lessonType}
Conversation (for context):
${JSON.stringify(conversation, null, 2)}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 350,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as WritingTaskJson;
  return parsed;
}

export async function evaluateWriting(
  lessonType: LessonType,
  taskPrompt: string,
  conversation: JaviMessage[],
  userWriting: string,
): Promise<WritingEvaluationJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a Spanish tutor evaluating B1 writing.
Return ONLY valid JSON. No markdown. No extra keys.
Be encouraging and specific.`;

  const isStructure = lessonType === 'Structure';

  const user = `Evaluate the learner's writing for this task.
Provide corrections and short feedback.
${isStructure ? 'PRIORITY: evaluate Spanish WORD ORDER and sentence structure for today\'s topic. Flag pronoun placement, adjective position, gustar-type order, double negatives, etc. separately in wordOrderErrors.' : ''}

Return JSON exactly with these keys:
- correctedText: the corrected version of the user's writing
- grammarScore: integer 0-100
- vocabularyScore: integer 0-100
- fluencyScore: integer 0-100
${isStructure ? '- structureScore: integer 0-100 (word order and sentence construction for today\'s structure topic)\n- wordOrderErrors: array of word-order mistakes { mistake, correction, explanation }' : ''}
- feedback: 2-3 sentences of encouraging, specific feedback from Javi
- corrections: array of specific mistakes with why it was wrong, with objects:
  { "mistake": "...", "correction": "...", "explanation": "..." }
- accentIssues: array of accent/tilde mistakes flagged separately (e.g. "café written as cafe")
- structuralFeedback: array of 2-3 notes on ${isStructure ? 'word order and Spanish sentence construction' : 'paragraph structure, connectors, or sentence variety'}

Lesson type: ${lessonType}
Task prompt: ${taskPrompt}
Conversation context:
${JSON.stringify(conversation, null, 2)}

User writing:
${userWriting}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1100,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as WritingEvaluationJson;
  return parsed;
}

export async function generateDrills(
  lessonType: LessonType,
  weakAreas: string[],
  focusAreas: string[],
): Promise<DrillExerciseJson[]> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are a Spanish tutor creating short drills for a B1 learner.
Return ONLY valid JSON. No markdown.`;

  const user = `Create exactly 3 short exercises targeting ONLY these weakAreas and focusAreas.
Keep each exercise short. Each exercise must be answerable with a short Spanish response.

Return JSON exactly like:
{ "exercises": [ { "id": "1", "prompt": "...", "expectedAnswer": "..." }, ... ] }

Lesson type: ${lessonType}
weakAreas: ${JSON.stringify(weakAreas)}
focusAreas: ${JSON.stringify(focusAreas)}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { exercises: DrillExerciseJson[] };
  return Array.isArray(parsed.exercises) ? parsed.exercises : [];
}

import {
  CHALLENGE_TYPE_TEMPLATES,
  type ChallengeType,
  type DailyChallengeSummaryInput,
} from '@/lib/daily-challenge';

export async function generateDailyThinkingChallenge(
  summary: DailyChallengeSummaryInput,
  challengeType: ChallengeType,
  recentChallenges: string[],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();
  const typeDef = CHALLENGE_TYPE_TEMPLATES[challengeType];
  const grammarTopic = summary.grammarTopic ?? summary.lessonFocus ?? 'today\'s grammar';

  const system = `You are Javi, a Spanish tutor helping a B1 learner build the habit of thinking in Spanish outside the app.
Return ONLY the challenge text — one sentence, plain English, no markdown, no quotes, no labels.`;

  const user = `Generate one micro Spanish thinking challenge for the user to do in their normal daily life today.

CHALLENGE TYPE (required): ${challengeType}
Template to follow closely: ${typeDef.template}
Guidance: ${typeDef.hint}
${
  challengeType === 'GRAMMAR_APPLICATION'
    ? `Replace [current week topic] with: ${grammarTopic}`
    : ''
}

It must:
- Take no more than 30 seconds of active effort
- Relate to what was covered today
- Help build the habit of thinking in Spanish outside the app
- Be specific and actionable — fill in bracketed placeholders with concrete details from today
- Follow the ${challengeType} format above (you may adapt wording slightly but keep the same challenge style)
- Never repeat the last 7 challenges (see below)

Recent challenges to avoid repeating:
${recentChallenges.length ? recentChallenges.map((c, i) => `${i + 1}. ${c}`).join('\n') : '(none yet)'}

Today's lesson summary:
- Lesson type: ${summary.lessonType}
- Focus: ${summary.lessonFocus ?? 'General practice'}
- Overall score: ${summary.overallScore ?? 'n/a'}%
- Strong areas: ${summary.strongAreas.join('; ') || 'n/a'}
- Weak areas: ${summary.weakAreas.join('; ') || 'n/a'}
- Focus next: ${summary.focusAreas.join('; ') || 'n/a'}
- Javi's note: ${summary.encouragingMessage ?? 'n/a'}

Return just the challenge text — one sentence, plain English, no markdown.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 150,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response).replace(/^["']|["']$/g, '').trim();
  if (text) return text;

  switch (challengeType) {
    case 'GRAMMAR_APPLICATION':
      return `Use ${grammarTopic} in your internal monologue 3 times today.`;
    case 'VOCABULARY':
      return "Pick 3 words from today's lesson and use them in a sentence in your head before you sleep.";
    case 'STRUCTURE':
      return 'When you think of an English sentence today, flip the adjective to after the noun as Spanish does.';
    case 'OBSERVATION':
      return 'For the next hour when you see any object say its Spanish name in your head.';
    case 'DECISION':
      return 'Make your next small decision in Spanish — Prefiero... Quiero... Voy a...';
    case 'EMOTION':
      return 'Next time you feel any emotion say it in Spanish first — Estoy... Tengo... Qué...';
    default:
      return 'When you make your next drink narrate each step in Spanish internally.';
  }
}

export async function checkDrillAnswer(
  lessonType: LessonType,
  exercise: DrillExerciseJson,
  userAnswer: string,
): Promise<DrillCheckJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a friendly Spanish tutor.
Grade the learner's answer. Return ONLY valid JSON with keys:
score (0-100 integer), feedbackSpanish, feedbackEnglish, correctAnswer (optional).`;

  const user = `Lesson type: ${lessonType}
Exercise:
${JSON.stringify(exercise, null, 2)}

User answer:
${userAnswer}

Return JSON only.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as DrillCheckJson;
  return parsed;
}

export type QuickFireQuestionType =
  | 'fill_blank'
  | 'translate_word'
  | 'correct_mistake'
  | 'choose_word'
  | 'quick_translate'
  | 'conjugate'
  | 'choose_tense'
  | 'translate_tense'
  | 'reorder_words'
  | 'spot_structure_error'
  | 'complete_structure'
  | 'choose_construction';

export type GrammarDrillContext = {
  topic: string;
  weekNumber: number;
  focusVerbs: string[];
  includesContrast: boolean;
};

export type QuickFireQuestion = {
  id: string;
  type: QuickFireQuestionType;
  prompt: string;
  expectedAnswer: string;
  acceptableAnswers?: string[];
  targetsErrorDna?: boolean;
  wordOrderSubtype?: WordOrderSubtype;
  constructionTag?: string;
};

export const WORD_ORDER_SUBTYPES = [
  'jumbled_words',
  'spot_error',
  'adjective_placement',
  'object_pronoun',
  'double_negative',
  'question_formation',
  'gustar_construction',
] as const;

export type WordOrderSubtype = (typeof WORD_ORDER_SUBTYPES)[number];

export type VocabLookupJson = {
  spanish: string;
  english: string;
  exampleSpanish: string;
  exampleEnglish: string;
  difficulty: 'B1' | 'B2';
};

export async function lookupVocabularyWord(spanishWord: string): Promise<VocabLookupJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are a Spanish lexicographer for B1–B2 learners.
Return ONLY valid JSON. No markdown.`;

  const user = `Look up this Spanish word or short phrase for a learner saving it to their vocabulary list: "${spanishWord.trim()}"

Return JSON exactly:
{
  "spanish": "canonical Spanish form",
  "english": "English translation (use / for multiple meanings)",
  "exampleSpanish": "one natural B1 example sentence using the word",
  "exampleEnglish": "English translation of the example",
  "difficulty": "B1" or "B2"
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as VocabLookupJson;
  return {
    spanish: String(parsed.spanish ?? spanishWord).trim(),
    english: String(parsed.english ?? '').trim(),
    exampleSpanish: String(parsed.exampleSpanish ?? '').trim(),
    exampleEnglish: String(parsed.exampleEnglish ?? '').trim(),
    difficulty: parsed.difficulty === 'B2' ? 'B2' : 'B1',
  };
}

const QUICK_FIRE_TYPES: QuickFireQuestionType[] = [
  'fill_blank',
  'translate_word',
  'correct_mistake',
  'choose_word',
  'quick_translate',
  'reorder_words',
  'spot_structure_error',
  'complete_structure',
  'choose_construction',
];

const GRAMMAR_DRILL_TYPES: QuickFireQuestionType[] = [
  'conjugate',
  'fill_blank',
  'correct_mistake',
  'choose_tense',
  'translate_tense',
];

export async function generateQuickFireQuestions(
  prioritizedWeakAreas: PrioritizedWeakAreaInput[],
  count = 10,
  grammarContext?: GrammarDrillContext,
  errorDnaTargets: ErrorDNAInput[] = [],
): Promise<QuickFireQuestion[]> {
  if (grammarContext) {
    return generateGrammarCurriculumQuestions(grammarContext, count, errorDnaTargets);
  }

  const anthropic = getClient();
  const model = getModel();
  const errorDnaBlock =
    errorDnaTargets.length > 0
      ? `
Exactly 2 of the ${count} questions MUST target these recurring user errors (one question each for the top 2):
${formatErrorDnaForDrillPrompt(errorDnaTargets)}
For those 2 questions set "targetsErrorDna": true.`
      : '';

  const system = `You are Javi, a Spanish tutor creating quick-fire B1 drill questions.
Return ONLY valid JSON. No markdown. No extra keys.`;

  const user = `Generate exactly ${count} quick-fire Spanish practice questions for a B1 learner.

Target these prioritised weak areas (focus most on highest priority): ${JSON.stringify(prioritizedWeakAreas)}
${errorDnaBlock}

Use exactly 2 questions of each type when count is 10; for ${count} questions vary types evenly.
- fill_blank: e.g. "Yo ___ (ir) al mercado ayer" → answer: "fui"
- translate_word: e.g. "How do you say 'yesterday' in Spanish?" → answer: "ayer"
- correct_mistake: e.g. "Yo soy hambre" → answer: "Yo tengo hambre"
- choose_word: e.g. "Ser or Estar? Yo ___ cansado" → answer: "estoy"
- quick_translate: e.g. "How do you say this sentence in Spanish: I went to the shop"
- reorder_words: e.g. "Put in order: rojo / el / coche / es" → "El coche es rojo"
- spot_structure_error: e.g. "Fix: Yo veo lo" → "Lo veo"
- complete_structure: e.g. "No quiero ___ (nothing)" → "nada"
- choose_construction: e.g. "Me gusta OR Yo gusto el café?" → "Me gusta"

Include exactly 2 sentence-structure questions (reorder_words, spot_structure_error, complete_structure, or choose_construction) in the ${count} questions.

Rules:
- Short prompts only. Answers must be brief (1–6 words usually).
- Tie questions to the weak areas where possible.
- expectedAnswer is the primary correct answer.
- acceptableAnswers: optional array of other valid answers (accents, synonyms).
- Rotate types across the 10 questions.

Return JSON exactly:
{
  "questions": [
    {
      "id": "1",
      "type": "fill_blank",
      "prompt": "...",
      "expectedAnswer": "...",
      "acceptableAnswers": ["..."],
      "targetsErrorDna": false
    }
  ]
}

Valid type values: ${QUICK_FIRE_TYPES.join(', ')}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { questions: QuickFireQuestion[] };
  if (!Array.isArray(parsed.questions)) return [];

  return parsed.questions
    .filter((q) => q && typeof q.prompt === 'string' && typeof q.expectedAnswer === 'string')
    .slice(0, count)
    .map((q, i) => ({
      id: String(q.id ?? i + 1),
      type: QUICK_FIRE_TYPES.includes(q.type as QuickFireQuestionType)
        ? (q.type as QuickFireQuestionType)
        : QUICK_FIRE_TYPES[i % QUICK_FIRE_TYPES.length],
      prompt: q.prompt.trim(),
      expectedAnswer: q.expectedAnswer.trim(),
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
        : undefined,
      targetsErrorDna: Boolean(q.targetsErrorDna),
    }));
}

export async function generateGrammarCurriculumQuestions(
  grammarContext: GrammarDrillContext,
  count = 10,
  errorDnaTargets: ErrorDNAInput[] = [],
): Promise<QuickFireQuestion[]> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a Spanish tutor creating grammar quick-fire drills for a B1 learner.
Return ONLY valid JSON. No markdown. No extra keys.

${CORE_VOCABULARY_PROMPT}`;

  const errorDnaBlock =
    errorDnaTargets.length > 0
      ? `
Exactly 2 of the ${count} questions MUST target these recurring user errors (one question each for the top 2):
${formatErrorDnaForDrillPrompt(errorDnaTargets)}
For those 2 questions set "targetsErrorDna": true.`
      : '';

  const user = `Generate exactly ${count} grammar drill questions for curriculum week ${grammarContext.weekNumber}.

Grammar topic: ${grammarContext.topic}
Focus verbs: ${grammarContext.focusVerbs.join(', ')}
Contrast week (preterite vs imperfect): ${grammarContext.includesContrast ? 'yes' : 'no'}
${errorDnaBlock}

Use ONLY this week's topic and focus verbs. Vocabulary must be top-1000 Spanish words only.

Question types (use 2 of each when count is 10):
- conjugate: "Conjugate 'tener' in the preterite, first person singular" → tuve
- fill_blank: "Ayer yo ___ (ir) al mercado" → fui
- correct_mistake: "Ayer yo voy al mercado" → Ayer fui al mercado (or fui)
- choose_tense: "Which tense? I used to go to the market every Sunday" → imperfect / imperfecto
- translate_tense: "I couldn't find the keys" (translate using ${grammarContext.topic}) → No pude encontrar las llaves

Rules:
- Short prompts. Brief answers (1–6 words usually).
- expectedAnswer is the primary correct answer.
- acceptableAnswers: optional array of valid variants.
- Rotate types evenly.

Return JSON exactly:
{
  "questions": [
    {
      "id": "1",
      "type": "conjugate",
      "prompt": "...",
      "expectedAnswer": "...",
      "acceptableAnswers": ["..."],
      "targetsErrorDna": false
    }
  ]
}

Valid type values: ${GRAMMAR_DRILL_TYPES.join(', ')}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { questions: QuickFireQuestion[] };
  if (!Array.isArray(parsed.questions)) return [];

  return parsed.questions
    .filter((q) => q && typeof q.prompt === 'string' && typeof q.expectedAnswer === 'string')
    .slice(0, count)
    .map((q, i) => ({
      id: String(q.id ?? i + 1),
      type: GRAMMAR_DRILL_TYPES.includes(q.type as QuickFireQuestionType)
        ? (q.type as QuickFireQuestionType)
        : GRAMMAR_DRILL_TYPES[i % GRAMMAR_DRILL_TYPES.length],
      prompt: q.prompt.trim(),
      expectedAnswer: q.expectedAnswer.trim(),
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
        : undefined,
      targetsErrorDna: Boolean(q.targetsErrorDna),
    }));
}

const WORD_ORDER_SUBTYPE_SET = new Set<string>(WORD_ORDER_SUBTYPES);

export async function generateWordOrderDrillQuestions(
  count = 10,
  errorDnaTargets: ErrorDNAInput[] = [],
): Promise<QuickFireQuestion[]> {
  const anthropic = getClient();
  const model = getModel();

  const errorDnaBlock =
    errorDnaTargets.length > 0
      ? `
Exactly 2 of the ${count} questions MUST target these recurring word-order errors (match constructionTag to the pattern):
${formatErrorDnaForDrillPrompt(errorDnaTargets)}
For those 2 questions set "targetsErrorDna": true.`
      : '';

  const system = `You are Javi, a Spanish tutor creating word-order quick-fire drills for a B1 learner.
Return ONLY valid JSON. No markdown. No extra keys.`;

  const user = `Generate exactly ${count} word-order drill questions for a B1 Spanish learner.
Rotate through ALL 7 subtypes below — use each at least once when count is 10; for ${count} questions distribute evenly.
${errorDnaBlock}

SUBTYPES (set wordOrderSubtype and constructionTag on every question):

1. jumbled_words (constructionTag: "jumbled_words")
   Give 4-6 Spanish words out of order separated by " / ".
   User types the correct sentence.
   Example prompt: "Put in order: rojo / el / coche / es" → "El coche es rojo"
   Example prompt: "Put in order: gusta / me / el / café" → "Me gusta el café"

2. spot_error (constructionTag: "spot_error")
   Give a Spanish sentence with a word-order mistake; user fixes it.
   Example: "Fix: Yo veo lo" → "Lo veo"
   Also use correct sentences occasionally and ask why wrong order fails — e.g. "Why is 'Una grande casa' wrong?" → "Una casa grande"

3. adjective_placement (constructionTag: "adjective_placement")
   English phrase with adjective before noun → Spanish with adjective after noun (colours, sizes, nationalities after; numbers/possessives before).
   Example: "The red car" → "El coche rojo"
   Example: "A tall man" → "Un hombre alto"

4. object_pronoun (constructionTag: "object_pronouns")
   Sentence with object pronoun in wrong position; user corrects.
   Example: "Fix: Veo lo todos los días" → "Lo veo todos los días"
   Example: "Fix: Quiero lo hacer" → "Lo quiero hacer" (acceptableAnswers: ["Quiero hacerlo"])

5. double_negative (constructionTag: "double_negatives")
   English with single negative → Spanish double negative.
   Example: "I don't want anything" → "No quiero nada"
   Example: "I never go there" → "No voy nunca allí" (acceptableAnswers: ["Nunca voy allí"])

6. question_formation (constructionTag: "question_formation")
   English question → Spanish without auxiliary verb.
   Example: "Do you want coffee?" → "¿Quieres café?"
   Example: "Are you coming tomorrow?" → "¿Vienes mañana?"

7. gustar_construction (constructionTag: "gustar_construction")
   English with like/love/hate → Spanish gustar-type construction.
   Example: "I like coffee" → "Me gusta el café"
   Example: "They love Spanish films" → "Les encantan las películas españolas"

Rules:
- Short prompts. Answers 1-10 words usually.
- expectedAnswer is the primary correct answer.
- acceptableAnswers: optional valid variants (accents, word order alternatives).
- type: use "reorder_words" for jumbled_words; "spot_structure_error" for spot_error and object_pronoun; "quick_translate" for adjective_placement, double_negative, question_formation, gustar_construction.
- Every question MUST include wordOrderSubtype and constructionTag.

Return JSON exactly:
{
  "questions": [
    {
      "id": "1",
      "type": "reorder_words",
      "wordOrderSubtype": "jumbled_words",
      "constructionTag": "jumbled_words",
      "prompt": "...",
      "expectedAnswer": "...",
      "acceptableAnswers": ["..."],
      "targetsErrorDna": false
    }
  ]
}

Valid wordOrderSubtype values: ${WORD_ORDER_SUBTYPES.join(', ')}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1600,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { questions: QuickFireQuestion[] };
  if (!Array.isArray(parsed.questions)) return [];

  return parsed.questions
    .filter((q) => q && typeof q.prompt === 'string' && typeof q.expectedAnswer === 'string')
    .slice(0, count)
    .map((q, i) => {
      const subtype = WORD_ORDER_SUBTYPE_SET.has(String(q.wordOrderSubtype))
        ? (q.wordOrderSubtype as WordOrderSubtype)
        : WORD_ORDER_SUBTYPES[i % WORD_ORDER_SUBTYPES.length];
      return {
        id: String(q.id ?? i + 1),
        type: QUICK_FIRE_TYPES.includes(q.type as QuickFireQuestionType)
          ? (q.type as QuickFireQuestionType)
          : 'reorder_words',
        prompt: q.prompt.trim(),
        expectedAnswer: q.expectedAnswer.trim(),
        acceptableAnswers: Array.isArray(q.acceptableAnswers)
          ? q.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
          : undefined,
        targetsErrorDna: Boolean(q.targetsErrorDna),
        wordOrderSubtype: subtype,
        constructionTag: String(q.constructionTag ?? subtype).trim(),
      };
    });
}

export async function generateFluencyDrillQuestions(
  prioritizedWeakAreas: PrioritizedWeakAreaInput[],
  count = 10,
  errorDnaTargets: ErrorDNAInput[] = [],
): Promise<QuickFireQuestion[]> {
  const anthropic = getClient();
  const model = getModel();
  const errorDnaBlock =
    errorDnaTargets.length > 0
      ? `
Exactly 2 of the ${count} questions MUST target these recurring user errors:
${formatErrorDnaForDrillPrompt(errorDnaTargets)}
For those 2 questions set "targetsErrorDna": true.`
      : '';

  const system = `You are Javi, a Spanish tutor creating fluency quick-fire drills for a B1 learner.
Return ONLY valid JSON. No markdown. No extra keys.`;

  const user = `Generate exactly ${count} fluency-focused quick-fire questions for a B1 learner.

Focus on natural spoken flow, connectors, fillers, and quick production — not tense tables.
Target weak areas: ${JSON.stringify(prioritizedWeakAreas)}
${errorDnaBlock}

Use these types evenly:
- quick_translate: natural conversational sentences
- fill_blank: common spoken phrases and connectors
- choose_word: natural collocation / register
- correct_mistake: unnatural or stilted phrasing

Rules:
- Short prompts. Brief answers.
- Tie to weak areas where possible.

Return JSON exactly:
{
  "questions": [
    {
      "id": "1",
      "type": "quick_translate",
      "prompt": "...",
      "expectedAnswer": "...",
      "acceptableAnswers": ["..."],
      "targetsErrorDna": false
    }
  ]
}

Valid type values: quick_translate, fill_blank, choose_word, correct_mistake`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { questions: QuickFireQuestion[] };
  if (!Array.isArray(parsed.questions)) return [];

  const fluencyTypes: QuickFireQuestionType[] = ['quick_translate', 'fill_blank', 'choose_word', 'correct_mistake'];

  return parsed.questions
    .filter((q) => q && typeof q.prompt === 'string' && typeof q.expectedAnswer === 'string')
    .slice(0, count)
    .map((q, i) => ({
      id: String(q.id ?? i + 1),
      type: fluencyTypes.includes(q.type as QuickFireQuestionType)
        ? (q.type as QuickFireQuestionType)
        : fluencyTypes[i % fluencyTypes.length],
      prompt: q.prompt.trim(),
      expectedAnswer: q.expectedAnswer.trim(),
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
        : undefined,
      targetsErrorDna: Boolean(q.targetsErrorDna),
    }));
}

export async function generatePracticeExercises(
  drillType: PracticeDrillType,
  prioritizedWeakAreas: PrioritizedWeakAreaInput[],
): Promise<DrillExerciseJson[]> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a warm Spanish tutor in a mobile app.
You create targeted B1 practice exercises.
Return ONLY valid JSON. No markdown. No extra keys.`;

  const user = `Generate 5 exercises targeting these prioritised weak areas: ${JSON.stringify(
    prioritizedWeakAreas,
  )}. Focus most on the highest priority items. B1 Spanish level.

Drill type: ${drillTypeToHumanLabel(drillType)}

Rules:
- Each exercise must be answerable with a short Spanish response.
- Keep prompts clear and specific to the prioritised weak areas.
- Do not include any English in the prompts.

Return JSON exactly:
{ "exercises": [ { "id": "1", "prompt": "...", "expectedAnswer": "..." }, ... ] }`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 900,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as { exercises: DrillExerciseJson[] };
  return Array.isArray(parsed.exercises) ? parsed.exercises : [];
}

export async function checkPracticeExerciseAnswer(
  drillType: PracticeDrillType,
  exercise: DrillExerciseJson,
  userAnswer: string,
): Promise<DrillCheckJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a friendly Spanish tutor.
Grade the learner's answer for a B1 practice drill.
Return ONLY valid JSON with keys:
score (0-100 integer), feedbackSpanish, feedbackEnglish, correctAnswer (optional).`;

  const user = `Drill type: ${drillTypeToHumanLabel(drillType)}

Exercise:
${JSON.stringify(exercise, null, 2)}

User answer:
${userAnswer}

Return JSON only.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as DrillCheckJson;
  return parsed;
}
