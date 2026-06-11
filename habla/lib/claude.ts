import Anthropic from '@anthropic-ai/sdk';

import type { LessonFocusContext } from '@/lib/lesson-focus';

/** Matches the lesson chips on the lesson screen. */
export type LessonType = 'Grammar' | 'Vocab' | 'Your Day';

export type LessonKindId = 'grammar' | 'vocabulary' | 'your-day';

export function lessonKindToLessonType(kind: LessonKindId): LessonType {
  switch (kind) {
    case 'grammar':
      return 'Grammar';
    case 'vocabulary':
      return 'Vocab';
    case 'your-day':
      return 'Your Day';
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
      return `GRAMMAR FOCUS (this week — same for all Grammar lessons this week):
- Topic: ${focus.topic}
- Every Grammar lesson this week practises ONLY this grammar point.
- Approach the topic from a fresh angle each session: different sentences, contexts, and mini-exercises — but never switch to a different grammar topic.
- Drill the point clearly; correct mistakes gently and keep the learner using this structure.`;
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
  }
}

function buildSystemPrompt(lessonType: LessonType, focus: LessonFocusContext): string {
  return `You are Javi, a warm, encouraging Spanish tutor in a mobile app.

This session's lesson type: ${lessonType}
${buildFocusInstructions(focus)}

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
- Your name is Javi; sign sparingly.`;
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

export type LessonAnalysisJson = {
  strongAreas: string[];
  weakAreas: string[];
  focusAreas: string[];
  correctnessScore: number;
  encouragingMessage: string;
};

export type WritingTaskJson = {
  prompt: string;
};

export type WritingEvaluationJson = {
  correctedText: string;
  grammarScore: number;
  vocabularyScore: number;
  fluencyScore: number;
  feedback: string;
  corrections: { mistake: string; correction: string; explanation: string }[];
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
    system: buildSystemPrompt(lessonType, focus),
    messages,
  });

  return extractText(response);
}

export async function analyzeConversation(
  lessonType: LessonType,
  conversation: JaviMessage[],
  writingScores?: { grammarScore: number; vocabularyScore: number; fluencyScore: number },
): Promise<LessonAnalysisJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are an expert Spanish teacher and evaluator for a B1 learner.
Return ONLY valid JSON. No markdown. No extra keys. No trailing commentary.`;

  const user = `Analyze this lesson conversation and return a JSON object with exactly these keys:
- strongAreas: array of 3 things the user did well
- weakAreas: array of 3 things the user struggled with
- focusAreas: array of 2 specific grammar or vocabulary topics to practise next
- correctnessScore: integer percent (0-100) for overall Spanish correctness (consider grammar + vocabulary, and incorporate the writing scores if provided)
- encouragingMessage: one short motivational sentence in Spanish then English (same line, separated by " / ")

Lesson type: ${lessonType}

Writing scores (optional, may be null):
${writingScores ? JSON.stringify(writingScores) : 'null'}

If writing scores are provided, you MUST use them in the analysis:
- Use writing grammar/vocabulary/fluency to influence strongAreas, weakAreas, and focusAreas.
- Blend conversation evidence + writing evidence when selecting those areas.
- correctnessScore must reflect both conversation performance and writing scores (not conversation alone).
- A high writing score should raise correctnessScore; a low writing score should lower it.

Conversation turns (role + content):
${JSON.stringify(conversation, null, 2)}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
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

  const user = `Evaluate the learner's writing for this task.
Provide corrections and short feedback.

Return JSON exactly with these keys:
- correctedText: the corrected version of the user's writing
- grammarScore: integer 0-100
- vocabularyScore: integer 0-100
- fluencyScore: integer 0-100
- feedback: 2-3 sentences of encouraging, specific feedback from Javi
- corrections: array of specific mistakes with why it was wrong, with objects:
  { "mistake": "...", "correction": "...", "explanation": "..." }

Lesson type: ${lessonType}
Task prompt: ${taskPrompt}
Conversation context:
${JSON.stringify(conversation, null, 2)}

User writing:
${userWriting}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 900,
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
