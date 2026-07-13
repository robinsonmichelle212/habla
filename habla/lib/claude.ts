import Anthropic from '@anthropic-ai/sdk';

import { formatErrorDnaForDrillPrompt, type ErrorDNAInput } from '@/lib/error-dna';
import { formatFocusTipsForDrillPrompt } from '@/lib/current-focus-tips';

import { CORE_VOCABULARY_PROMPT } from '@/lib/core-vocabulary';
import type { InterleavingContext } from '@/lib/interleaving';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import type { SpanishWrappedReport } from '@/lib/wrapped-data';
import {
  READ_TEXT_TYPE_LABELS,
  type ReadComprehensionEvaluation,
  type ReadDifficultySpec,
  type ReadTextType,
  type ReadingSessionContent,
} from '@/lib/read-with-javi';

/** Matches the lesson chips on the lesson screen. */
export type LessonType = 'Grammar' | 'Vocab' | 'Your Day' | 'Structure' | 'Read';

export type LessonKindId = 'grammar' | 'vocabulary' | 'your-day' | 'structure' | 'read';

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
    case 'read':
      return 'Read';
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
- The learner has an on-screen conjugation guide: when to use the tense, regular endings, and tables for all 10 focus verbs.
- Explain in simple B1 Spanish when this grammar point is used and why it matters — do not repeat the full tables in chat; point to the panel.
- Use the Translate: line on every message so learners can tap individual words for meaning.
- Give 2 real-life examples using focus verbs from the tables.
- Example style: "El pretérito indefinido se usa para acciones completadas en el pasado. Mira 'tener' en la tabla — tuve, tuviste…"

PART 2 — GUIDED PRACTICE (next 3–4 exchanges):
- Reference regular -ar/-er/-ir endings from the guide, then practise irregular stems from the 10 verb tables.
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
- Do NOT drill yet — teach the concept fully before the writing task.
- Stay on this structure topic only for the whole lesson.`;
    case 'read':
      return `READ WITH JAVI — Text type: ${focus.textTypeLabel}
- Learner level band: ${focus.levelBandLabel}
- This is a reading comprehension lesson. The learner has read an authentic Spanish text.
- Discuss the text, introduce 2–3 vocabulary items from it using memorable keyword mnemonics.
- Add cultural context where relevant. Ask for opinions and personal connections.
- Do NOT read the full text aloud — reading comprehension is the skill.`;
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

const CONJUGATION_MEMORY_TECHNIQUES = `
MEMORY HOOKS FOR IRREGULAR CONJUGATIONS (Timothy Moser-style):
When introducing any irregular verb conjugation always provide a memory hook using a sound-alike English word or phrase. Never introduce an irregular form without one.

Use these hooks for the most common irregular preterites:
fui/fue — "Phooey!" — "Phooey, I went the wrong way!"
fuiste — "Fwisty" — "the twisty road you went down"
fuimos — "Fwee-moose" — "the moose we went to see"
fueron — "Fweh-ron" — "the wren that went flying off"
tuve — "Too vague" — "it was too vague what I had"
tuviste — "Too-vee-stay" — "too vee shaped to stay"
tuvo — "Two-bo" — "two bows I had"
pude — "Poodle" — "the poodle could do it"
pudiste — "Poo-dees-tay" — "the poodle that could stay"
vine — "Wine" — "I came bearing wine"
viniste — "Vee-nees-tay" — "you came to stay"
quise — "Keys" — "I wanted my keys"
quisiste — "Keys-stay" — "you wanted the keys to stay"
hice — "Easy" — "I did it easy"
hiciste — "Easy-stay" — "you did it and stayed"
dije — "Dee-hey" — "I said hey"
dijiste — "Dee-hey-stay" — "you said hey and stayed"
puse — "Pussy willow" — "I put pussy willows there"
pusiste — "Poo-see-stay" — "you put it and stayed"
supe — "Super" — "super, I knew it!"
supiste — "Super-stay" — "you knew and stayed"

When introducing a new conjugation:
1. State the conjugation clearly.
2. Give the memory hook immediately after.
3. Use it in a sentence from the user's real life — reference their day, their partner, their routine.
4. Ask them to create their own association if they find yours doesn't work.

PERSONAL ASSOCIATION:
Always try to connect conjugations to the user's actual life and experiences.
Use their name, their partner, their job, their day.
Personal emotional connections stick better than abstract examples.
Example for Michelle learning fui:
"Fui — phooey! Think of saying phooey when you went the wrong way to work this morning, Michelle."

MEMORY PALACE INTRODUCTION:
When teaching a full set of conjugations for one verb, walk the user through a simple location — their kitchen.
Each conjugation is assigned to one item in the kitchen:
yo form — the kettle
tú form — the fridge
él/ella form — the cooker
nosotros form — the kitchen table
vosotros form — the window
ellos form — the kitchen door

Each item performs an action using that conjugation.
Describe the scene vividly — make it memorable, funny or surprising.
Example for IR in preterite:
"Your kettle WENT (fui) cold before you got to it — phooey!
The fridge door — YOU WENT (fuiste) to it twice already.
The cooker — it WENT (fue) cold too — typical.
At the table — WE WENT (fuimos) through three cups of tea.
By the window — YOU ALL WENT (fuisteis) to look outside.
The door — THEY WENT (fueron) out without saying goodbye."

After the memory palace walkthrough immediately drill the user on each item:
"What happened to the kettle?" → fui
"What did you do with the fridge?" → fuiste
And so on for each kitchen item.`;

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
   The Translate line is stored for reference; learners tap words for meaning instead of revealing the full translation.

General:
- Stay on this lesson type; if the learner drifts, acknowledge briefly and steer back.
- Your name is Javi; sign sparingly.
- Never use any markdown formatting in your responses. No asterisks, no bold, no italics, no bullet points, no hyphens as list markers, no hashtags, no underscores. Write in plain natural sentences only as if speaking out loud.

Vocabulary teaching (all lesson types):
- Roughly once per conversation (not every message), naturally introduce 1–2 words slightly above B1 level.
- Use each new word in a natural Spanish sentence first, then briefly explain in Spanish on a new line starting with "Por cierto —" e.g. "Por cierto — 'conseguir' means to achieve or to get. You might want to save that one."
- Keep it conversational — never turn into a vocabulary list. The learner can save words with the app's Save a word feature.

INTERLEAVING: Always mix current grammar focus with vocabulary from a different theme than this week's vocabulary lesson. In conversation naturally reference vocabulary from previous weeks to force retrieval. In writing tasks use current grammar with non-current vocabulary themes.

FEYNMAN TECHNIQUE: On the first lesson of each new grammar curriculum week, after your introduction, ask the user to explain the grammar rule back to you in Spanish in their own words with an example. Evaluate their explanation and address specific gaps only. Maximum 2 Feynman exchanges before moving to writing phase. Only use Feynman on Grammar and Structure lessons.

${CONJUGATION_MEMORY_TECHNIQUES}${buildErrorDnaAppendix(topErrors)}`;
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
    didWell: string[];
    workOn: string[];
    focusThisWeek: string[];
    details: string[];
    lessonDescription?: string;
    mistakes?: { mistake: string; correction: string; explanation: string }[];
  };
  vocabulary: {
    score: number;
    topic: string;
    didWell: string[];
    workOn: string[];
    focusThisWeek: string[];
    details: string[];
    wordsCorrect?: { spanish: string; english: string }[];
    wordsToRevisit?: { spanish: string; english: string }[];
  };
  fluency: {
    score: number;
    didWell: string[];
    workOn: string[];
    focusThisWeek: string[];
    details: string[];
    description?: string;
    positivePatterns?: string[];
    negativePatterns?: string[];
    sentenceNotes?: string[];
    weeklyTips?: string[];
  };
  writing: {
    score: number;
    didWell: string[];
    workOn: string[];
    focusThisWeek: string[];
    details: string[];
  };
  structure?: {
    score: number;
    topic: string;
    details: string[];
    lessonDescription: string;
    wordOrderMistakes: { mistake: string; correction: string; explanation: string }[];
  };
  reading?: {
    score: number;
    topic: string;
    textType: string;
    details: string[];
    wordsLearned: { spanish: string; english: string }[];
    grammarPatterns: string[];
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

function interleavingSpeakingHint(interleaving?: InterleavingContext): string {
  if (!interleaving?.previousVocabTheme) return '';
  return `

INTERLEAVING (speaking): Naturally weave vocabulary from the previous theme "${interleaving.previousVocabTheme}" into your replies while staying on today's topic. Example: if this week is Travel but last week was Food, ask something like "When you travel do you enjoy trying local food?" — force retrieval of older vocabulary alongside new content.`;
}

function interleavingWritingHint(focus: LessonFocusContext, interleaving?: InterleavingContext): string {
  if (!interleaving || (focus.kind !== 'grammar' && focus.kind !== 'structure')) return '';
  const current = interleaving.currentVocabTheme ?? 'this week\'s vocabulary lesson theme';
  return `

INTERLEAVING (required): Mix today's grammar/structure focus with vocabulary from "${interleaving.writingVocabTheme}" — NOT "${current}". Example: if grammar is Preterite and this week's vocab theme is Food, require Travel vocabulary in the writing task instead.`;
}

const WARMUP_PHASE_APPENDIX = `
LESSON PHASE: WARM-UP (written exchange only).
Keep your Phase 1 introduction concise and focused.
Maximum 4 exchanges before signalling [READY_FOR_WRITING].
Each message maximum 2-3 sentences.
Cover these points efficiently:
- What we're practising today (1 message)
- One clear example (1 message)
- One conjugation example (-ar, -er, -ir, or irregular) (1 message)
- One comprehension check question, then confirm understanding and signal ready (1 message)
Do not over-explain. Trust the user to learn by doing.
The writing and speaking phases teach more than the introduction.

- The learner sees a conjugation reference panel above the chat — point to on-screen tables ("mira la tabla de tener") instead of typing full conjugation lists.
- Keep each message to 2-3 short sentences maximum, then Translate: line.
- Be warm and practical.

COMPLETION SIGNAL:
On your 4th warm-up message at the latest, end with exactly this marker on its own line:
[READY_FOR_WRITING]
Do not use this marker before you have covered the four points above.`;

const SPEAKING_PHASE_APPENDIX = `
LESSON PHASE: SPEAKING (voice only — learner listens to you, no text shown).
Keep Phase 3 speaking exchanges brief and natural.
Maximum 3 exchanges total — no more.
Each Javi response maximum 1-2 sentences.
Ask one short follow-up question per response (except the final exchange).
After 3 exchanges the app ends speaking automatically — do not extend the conversation.
Quality over quantity. Move on after 3 exchanges regardless.

- This is a FLUENCY phase — not accuracy testing. The learner does NOT need to reproduce anything they wrote.
- Plain spoken Spanish, no markdown.
- Respond conversationally — react naturally, keep the chat flowing.
- If they make a significant error, correct it very gently inline in one short clause, then continue.
- Never stop the flow for a correction. Never evaluate or score them during the conversation.
- Use today's lesson vocabulary and grammar naturally in your replies.`;

export async function generateWarmUpOpening(
  lessonType: LessonType,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const openingPrompt =
    focus.kind === 'structure'
      ? `Start the warm-up. Explain why today's structure point matters (${focus.topic.title}): ${focus.topic.summary}. Use clear English and Spanish examples. Explain WHY, not just the rule. End with Translate: line. Do not use [READY_FOR_WRITING] yet — this is only your first message.`
      : focus.kind === 'grammar'
        ? `Start the warm-up for ${focus.topic} (week ${focus.weekNumber}). The learner sees conjugation tables for: ${focus.focusVerbs.join(', ')}. Explain when and why this tense is used, point them to the regular endings on screen, and highlight 2–3 irregular focus verbs to study in the tables. End with Translate: line. Do not use [READY_FOR_WRITING] yet — this is only your first message.`
        : 'Start the warm-up. Introduce today\'s topic, explain why it matters, and highlight 2–3 verbs or structures to practise. End with Translate: line. Do not use [READY_FOR_WRITING] yet — this is only your first message.';

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
  const nextMessage = javiMessageNumber + 1;
  const maxMessages = 4;
  const progressHint =
    javiMessageNumber < maxMessages - 1
      ? `Phase 1 message ${nextMessage} of ${maxMessages}. Stay concise — max 2-3 sentences. Do not use [READY_FOR_WRITING] yet.`
      : `Phase 1 message ${nextMessage} of ${maxMessages}. This is your final warm-up message — confirm understanding and end with [READY_FOR_WRITING].`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${WARMUP_PHASE_APPENDIX}
${progressHint}`,
    messages: [
      ...priorExchanges.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage.trim() },
    ],
  });

  return extractText(response);
}

export async function generateSpeakingIntro(
  lessonType: LessonType,
  writingTaskPrompt: string,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
  interleaving?: InterleavingContext,
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${SPEAKING_PHASE_APPENDIX}${interleavingSpeakingHint(interleaving)}`,
    messages: [
      {
        role: 'user',
        content: `The learner just finished a WRITING task. Now start the independent SPEAKING phase (voice only).

Writing task they completed (same topic — do NOT ask them to repeat it):
${writingTaskPrompt}

Your spoken intro in Spanish (then Translate: line):
1) "Ahora vamos a hablar." + brief encouragement to speak naturally, not read what they wrote.
2) One fresh related question — same theme, different angle from the writing task.
Keep the entire Spanish portion to 1-2 short sentences total. End with Translate: line.`,
      },
    ],
  });

  return extractText(response);
}

export async function askJaviSpeakingConversation(
  lessonType: LessonType,
  userMessage: string,
  priorExchanges: JaviMessage[],
  focus: LessonFocusContext,
  speakingTopic: string,
  exchangeNumber: number,
  maxExchanges: number = 3,
  topErrors: ErrorDNAInput[] = [],
  interleaving?: InterleavingContext,
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const exchangeHint =
    exchangeNumber >= maxExchanges
      ? `Speaking exchange ${exchangeNumber} of ${maxExchanges} — FINAL exchange. Reply in 1-2 sentences only. Wrap up warmly with no new question.`
      : `Speaking exchange ${exchangeNumber} of ${maxExchanges}. Reply in 1-2 sentences with one short follow-up question.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 180,
    system: `${buildSystemPrompt(lessonType, focus, topErrors)}${SPEAKING_PHASE_APPENDIX}${interleavingSpeakingHint(interleaving)}
Today's speaking theme (keep conversation on this topic): ${speakingTopic}
${exchangeHint}`,
    messages: [
      ...priorExchanges.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage.trim() },
    ],
  });

  return extractText(response);
}

export type SpeakingEvaluationJson = {
  score: number;
  fluencyScore: number;
  confidenceScore: number;
  vocabularyRangeScore: number;
  naturalFlowScore: number;
  pronunciationNotes: string[];
  feedback: string;
};

export async function evaluateSpeakingFluency(
  lessonType: LessonType,
  speakingTopic: string,
  speakingTranscripts: string[],
  speakingConversation: JaviMessage[],
): Promise<SpeakingEvaluationJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi evaluating spoken Spanish at B1 level for FLUENCY — not accuracy or reproduction of written text.
Return ONLY valid JSON. No markdown.`;

  const user = `Evaluate the learner's speaking phase on fluency metrics only.

Return JSON exactly:
{
  "fluencyScore": 0-100 integer (did they keep talking without long pauses / hesitation?),
  "confidenceScore": 0-100 integer (did they attempt complex sentences and take risks?),
  "vocabularyRangeScore": 0-100 integer (did they use varied vocabulary on the topic?),
  "naturalFlowScore": 0-100 integer (did it sound conversational and natural?),
  "score": 0-100 integer (overall speaking — average of the four scores above),
  "pronunciationNotes": array of up to 3 short notes if transcripts suggest unclear words,
  "feedback": 2 sentences encouraging feedback from Javi in English — focus on fluency strengths, not grammar nitpicks
}

Do NOT evaluate:
- Reproducing a written response
- Perfect grammar accuracy
- Matching vocabulary from a writing task

Lesson type: ${lessonType}
Speaking topic: ${speakingTopic}
Whisper transcripts: ${JSON.stringify(speakingTranscripts)}
Speaking conversation: ${JSON.stringify(speakingConversation)}
${lessonType === 'Structure' ? '\nBonus: note if word order sounded natural in conversation.' : ''}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as SpeakingEvaluationJson;
  const fluency = Math.max(0, Math.min(100, Math.round(parsed.fluencyScore ?? 0)));
  const confidence = Math.max(0, Math.min(100, Math.round(parsed.confidenceScore ?? 0)));
  const vocabularyRange = Math.max(0, Math.min(100, Math.round(parsed.vocabularyRangeScore ?? 0)));
  const naturalFlow = Math.max(0, Math.min(100, Math.round(parsed.naturalFlowScore ?? 0)));
  const score = Math.round((fluency + confidence + vocabularyRange + naturalFlow) / 4);
  return {
    ...parsed,
    fluencyScore: fluency,
    confidenceScore: confidence,
    vocabularyRangeScore: vocabularyRange,
    naturalFlowScore: naturalFlow,
    score,
    pronunciationNotes: Array.isArray(parsed.pronunciationNotes) ? parsed.pronunciationNotes : [],
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
  };
}

export type FeynmanEvaluationJson = {
  verdict: 'correct' | 'partial' | 'wrong';
  javiSpanish: string;
  javiTranslation: string;
  moveToWriting: boolean;
};

export async function evaluateFeynmanExplanation(
  lessonType: LessonType,
  focus: LessonFocusContext,
  conceptLabel: string,
  userExplanation: string,
  attemptNumber: number,
): Promise<FeynmanEvaluationJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi using the Feynman Technique to check if a B1 learner truly understands a grammar/structure concept.
Return ONLY valid JSON. No markdown.

FEYNMAN RULES:
- Check if they captured the core rule correctly and if their example sentence is correct.
- If correct: confirm warmly and set moveToWriting true. Spanish: "Perfecto. Lo entiendes bien. Ahora vamos a practicarlo."
- If partial (gaps): address ONLY the specific gap in one sentence, not the whole concept. Ask them to try again in one sentence. Set moveToWriting false unless this is attempt 2.
- If completely wrong: clarify the single most important point in one sentence, then ask them to explain back. Set moveToWriting false unless this is attempt 2.
- On attempt 2: always set moveToWriting true even if still imperfect — encourage and move on.
- Maximum 2 exchanges total.`;

  const user = `Evaluate this learner explanation (attempt ${attemptNumber} of 2).

Concept they should explain: ${conceptLabel}
Lesson type: ${lessonType}
${focus.kind === 'grammar' ? `Grammar focus: ${focus.topic} (${focus.topicSpanish})` : ''}
${focus.kind === 'structure' ? `Structure focus: ${focus.topic.title} — ${focus.topic.summary}` : ''}

Learner's explanation in Spanish:
${userExplanation}

Return JSON exactly:
{
  "verdict": "correct" | "partial" | "wrong",
  "javiSpanish": "Javi's reply in Spanish (2 short sentences max)",
  "javiTranslation": "English translation of javiSpanish",
  "moveToWriting": boolean
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 450,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as FeynmanEvaluationJson;
  const verdict =
    parsed.verdict === 'correct' || parsed.verdict === 'partial' || parsed.verdict === 'wrong'
      ? parsed.verdict
      : 'partial';

  return {
    verdict,
    javiSpanish: typeof parsed.javiSpanish === 'string' ? parsed.javiSpanish.trim() : 'Bien — sigamos practicando.',
    javiTranslation:
      typeof parsed.javiTranslation === 'string'
        ? parsed.javiTranslation.trim()
        : 'Good — let\'s keep practising.',
    moveToWriting:
      attemptNumber >= 2 ||
      Boolean(parsed.moveToWriting) ||
      verdict === 'correct',
  };
}

/** @deprecated Legacy attempt-based evaluation — use evaluateSpeakingFluency */
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

export type SpeakingAttempt1Json = {
  score: number;
  correct: string[];
  incorrect: string[];
  improvementTip: string;
  javiFeedbackSpanish: string;
  javiFeedbackTranslation: string;
};

export async function evaluateSpeakingAttempt1(
  lessonType: LessonType,
  taskPrompt: string,
  writtenOriginal: string,
  writtenCorrected: string,
  writingCorrections: { mistake: string; correction: string; explanation: string }[],
  transcript: string,
): Promise<SpeakingAttempt1Json> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi evaluating a learner's first spoken attempt at B1 Spanish.
Return ONLY valid JSON. No markdown.`;

  const user = `Evaluate the learner's FIRST speaking attempt.

Return JSON exactly:
{
  "score": 0-100 integer (accuracy vs written/corrected version, grammar, natural delivery),
  "correct": array of 1-3 short English phrases for what they got right (prefix with meaning, e.g. "Good use of past tense"),
  "incorrect": array of 0-3 short English phrases for mistakes (e.g. "Wrong verb: said 'fui' instead of 'era'"),
  "improvementTip": one specific actionable tip for their second attempt,
  "javiFeedbackSpanish": 2 short spoken sentences in Spanish — praise one thing, note one fix, encourage retry. Plain Spanish, no markdown.
  "javiFeedbackTranslation": English translation of javiFeedbackSpanish
}

Lesson type: ${lessonType}
Writing task: ${taskPrompt}
Written (original): ${writtenOriginal}
Written (corrected): ${writtenCorrected}
Writing corrections: ${JSON.stringify(writingCorrections)}
Whisper transcript (what they said): ${transcript}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return extractFirstJsonObject(extractText(response)) as SpeakingAttempt1Json;
}

export type SpeakingAttempt2Json = {
  score: number;
  comparison: 'better' | 'same' | 'worse';
  appliedCorrection: boolean;
  javiFeedbackSpanish: string;
  javiFeedbackTranslation: string;
};

export async function evaluateSpeakingAttempt2(
  lessonType: LessonType,
  taskPrompt: string,
  writtenCorrected: string,
  attempt1Transcript: string,
  attempt1Score: number,
  attempt1ImprovementTip: string,
  attempt2Transcript: string,
): Promise<SpeakingAttempt2Json> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi evaluating a learner's second spoken attempt at B1 Spanish.
Return ONLY valid JSON. No markdown.`;

  const user = `Compare the learner's SECOND speaking attempt to their first.

Return JSON exactly:
{
  "score": 0-100 integer (overall quality of attempt 2),
  "comparison": "better" | "same" | "worse" (vs attempt 1),
  "appliedCorrection": boolean (did they apply the improvement tip?),
  "javiFeedbackSpanish": 2 short encouraging sentences in Spanish comparing both attempts. Plain Spanish, no markdown.
  "javiFeedbackTranslation": English translation
}

Lesson type: ${lessonType}
Writing task: ${taskPrompt}
Target text: ${writtenCorrected}
Attempt 1 transcript: ${attempt1Transcript}
Attempt 1 score: ${attempt1Score}
Improvement tip given: ${attempt1ImprovementTip}
Attempt 2 transcript: ${attempt2Transcript}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return extractFirstJsonObject(extractText(response)) as SpeakingAttempt2Json;
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

  const fluencyDetail = `Speaking fluency ${speakingScore}% — flow ${speakingEvaluation.naturalFlowScore ?? speakingScore}%`;

  return {
    ...analysis,
    overallScore,
    correctnessScore: analysis.correctnessScore,
    weakAreas: (analysis.weakAreas ?? []).slice(0, 3),
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
                (structureScore + (analysis.breakdown.structure?.score ?? structureScore)) / 2,
              ),
              details: [
                ...(analysis.breakdown.structure?.details ?? []).slice(0, 1),
                'Natural word order in free conversation',
              ].filter(Boolean),
            },
          }
        : {}),
      fluency: {
        ...analysis.breakdown.fluency,
        score: Math.round((analysis.breakdown.fluency.score + speakingScore) / 2),
        details: [
          ...(analysis.breakdown.fluency.details ?? []).slice(0, 1),
          fluencyDetail,
        ].filter(Boolean),
        description:
          analysis.breakdown.fluency.description ??
          `Writing fluency ${writingScores.fluencyScore}% · speaking fluency ${speakingScore}%`,
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
      topic: string (short label, e.g. "Past tense (preterite)"),
      didWell: array of 2-3 specific positive observations from TODAY's lesson only,
      workOn: array of 2-3 specific areas needing attention from TODAY's lesson only,
      focusThisWeek: array of 1-2 specific, doable practice actions linked to workOn
    }
  - vocabulary: {
      score: 0-100 integer,
      topic: string (e.g. "Food and cooking"),
      didWell: array of 2-3 specific positive observations from TODAY's lesson only,
      workOn: array of 2-3 specific areas needing attention from TODAY's lesson only,
      focusThisWeek: array of 1-2 specific, doable practice actions linked to workOn
    }
  - fluency: {
      score: 0-100 integer,
      didWell: array of 2-3 specific positive observations from TODAY's speaking only,
      workOn: array of 2-3 specific fluency issues from TODAY's speaking only,
      focusThisWeek: array of 1-2 specific, doable practice actions linked to workOn
    }
  - writing: {
      score: 0-100 integer,
      didWell: array of 2-3 specific positive observations from TODAY's writing only,
      workOn: array of 2-3 specific writing issues from TODAY only,
      focusThisWeek: array of 1-2 specific, doable practice actions linked to workOn
    }${structureBlock}

Skill tab observation rules (apply to every didWell, workOn, and focusThisWeek item):
- Must be specific to today's actual lesson content — real successes or errors from the session
- Plain English only — no jargon
- Actionable — something the learner can actually do
- Maximum 15 words per observation
- Never generic praise like "good effort" or "keep practising"
- focusThisWeek must directly follow from workOn items

Lesson type: ${lessonType}
Lesson focus / topic context: ${lessonFocusLabel ?? 'General B1 practice'}

Writing scores (optional, may be null):
${writingScores ? JSON.stringify(writingScores) : 'null'}

Rules:
- Use writing scores to set breakdown.grammar.score, breakdown.vocabulary.score, breakdown.fluency.score where appropriate.
- breakdown.writing.score should reflect writing quality (use writing scores as a guide).
${isStructure ? '- breakdown.structure.score must use structureScore from writing scores when provided.\n- breakdown.structure.topic must match the lesson focus.\n- Tag word-order patterns in errorDNA as category "word-order".' : ''}
- breakdown.grammar.topic and breakdown.vocabulary.topic must reflect what was practised in this lesson (short label only).
- overallScore must be the rounded average of the ${isStructure ? 'five' : 'four'} breakdown scores${isStructure ? ' (grammar, vocabulary, fluency, writing, structure)' : ''}.
- weakAreas and focusAreas must align with workOn and focusThisWeek across breakdown sections.
- Every breakdown section MUST include non-empty didWell (2-3 items), workOn (2-3 items), and focusThisWeek (1-2 items).
- Do NOT mention curriculum weeks, grammar curriculum, or "this week's focus" anywhere.

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
    case 'read':
      return `Reading text type: ${focus.textTypeLabel}. The learner reads authentic Spanish texts — comprehension is handled in the Read lesson flow.`;
  }
}

export async function generateWritingTask(
  lessonType: LessonType,
  conversation: JaviMessage[],
  focus: LessonFocusContext,
  interleaving?: InterleavingContext,
): Promise<WritingTaskJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a Spanish tutor.
Return ONLY valid JSON. No markdown.`;

  const user = `Create a writing task prompt for a B1 learner.
${writingTaskFocusLine(focus)}${interleavingWritingHint(focus, interleaving)}
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


export async function generateWrappedJaviMessage(report: SpanishWrappedReport): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, a warm Spanish tutor. Write a personalised month-in-review message.
Return plain text only: 2-3 sentences in Spanish, then " / ", then the same message in English.
No markdown. Reference specific achievements from the data. Be encouraging and specific.`;

  const user = `Write Javi's Spanish Wrapped message for ${report.monthLabel}.

Data:
- Lessons: ${report.totalLessons}, drills: ${report.totalDrills}, read sessions: ${report.totalReadSessions}
- Score: started ${report.averageScoreStart}%, ended ${report.averageScoreEnd}% (+${report.improvementPercent}%)
- Level: ${report.levelAtStart} → ${report.levelAtEnd}${report.levelledUp ? ' (levelled up!)' : ''}
- Streak: longest ${report.longestStreakThisMonth} days, ${report.streakConsistencyPercent}% consistency
- Vocabulary: ${report.wordsSavedThisMonth} saved, ${report.wordsMasteredThisMonth} mastered
- Favourite lesson type: ${report.favouriteLessonType}
- Best skill: ${report.bestSkill}, most improved: ${report.mostImprovedSkill}
- Error patterns: persistent="${report.mostPersistentError ?? 'none'}", improved="${report.mostImprovedError ?? 'none'}"
- Gems earned: ${report.gemsEarnedThisMonth}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return extractText(response).trim();
}

export async function generateDailyThinkingChallenge(
  summary: DailyChallengeSummaryInput,
  challengeType: ChallengeType,
  recentChallenges: string[],
  focusTips?: string[],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();
  const typeDef = CHALLENGE_TYPE_TEMPLATES[challengeType];
  const grammarTopic = summary.grammarTopic ?? summary.lessonFocus ?? 'today\'s grammar';

  const focusTipsBlock =
    focusTips && focusTips.length > 0
      ? `
Generate a thinking challenge that relates to one of these focus tips:
${focusTips.map((t) => `- ${t}`).join('\n')}
The challenge should help the user practise this specific area in their daily life.
Example: If a tip is "dropping subject pronouns" → "Today when you think in Spanish deliberately drop the subject pronoun every time. Instead of 'yo tengo' just think 'tengo'."
`
      : '';

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
${focusTipsBlock}

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

// ——— Placement assessment (onboarding) ———

export type PlacementAssessmentResult = {
  confirmedLevel:
    | 'A1'
    | 'A2'
    | 'B1 Beginner'
    | 'B1 Developing'
    | 'B1 Confident'
    | 'B1 Strong'
    | 'B2 Emerging';
  adjustedFromSelfAssessment: boolean;
  adjustmentDirection: 'higher' | 'lower' | 'same';
  keyStrengths: string[];
  keyWeaknesses: string[];
  grammarStartingWeek: number;
  personalNote: string;
};

function buildAssessmentSystemPrompt(
  userName: string,
  selfAssessedLevel: string,
  dialectPreference: string,
): string {
  return `You are Javi, a warm Spanish tutor assessing a learner's level during onboarding.
Their name is ${userName}.
They self-assessed as ${selfAssessedLevel}.
Their dialect preference is ${dialectPreference}.

Ask exactly these 4 questions in order.
Pitch each question at the self-assessed level.
After each response internally note the quality but do not comment on it — just continue naturally.
Be warm, encouraging and non-judgmental throughout.
After question 4 you will provide a level assessment (handled separately — never output JSON during the conversation).

QUESTION 1 — Present tense (30 seconds):
'Hola ${userName}! Cuéntame — ¿cómo es tu día típico? / Tell me about your typical day.'
Assess: present tense usage, basic vocabulary, confidence.

QUESTION 2 — Past tense (30 seconds):
'¿Y qué hiciste el fin de semana pasado? / What did you do last weekend?'
Assess: past tense usage, preterite vs imperfect distinction.

QUESTION 3 — Opinion (45 seconds):
'¿Por qué quieres aprender español? ¿Qué es lo más difícil para ti? / Why do you want to learn Spanish? What's hardest for you?'
Assess: ability to express opinions, vocabulary range, sentence complexity.

QUESTION 4 — Hypothetical (45 seconds):
'Si pudieras vivir en cualquier ciudad de España o Latinoamérica, ¿dónde vivirías y por qué? / If you could live anywhere in Spain or Latin America, where would you live and why?'
Assess: conditional tense, complex sentence construction, confidence with hypotheticals.

RESPONSE FORMAT for each question:
- 2–4 short sentences in Spanish at the learner's level
- Then a new line: Translate: [English translation of your Spanish]
- Do NOT evaluate the learner's previous answer out loud
- Do NOT skip ahead — ask only the question for the step you are on`;
}

const ASSESSMENT_QUESTION_LABELS: Record<number, string> = {
  1: 'QUESTION 1 (present tense — typical day)',
  2: 'QUESTION 2 (past tense — last weekend)',
  3: 'QUESTION 3 (opinion — why learn Spanish)',
  4: 'QUESTION 4 (hypothetical — where to live)',
};

export async function generateAssessmentOpening(
  userName: string,
  selfAssessedLevel: string,
  dialectPreference: string,
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 320,
    system: buildAssessmentSystemPrompt(userName, selfAssessedLevel, dialectPreference),
    messages: [
      {
        role: 'user',
        content: `Begin the assessment. Ask ${ASSESSMENT_QUESTION_LABELS[1]} only.
Start with a brief warm greeting using their name, then the question.`,
      },
    ],
  });

  return extractText(response);
}

export async function askJaviAssessmentFollowUp(
  userName: string,
  selfAssessedLevel: string,
  dialectPreference: string,
  questionNumber: 2 | 3 | 4,
  priorExchanges: JaviMessage[],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 320,
    system: buildAssessmentSystemPrompt(userName, selfAssessedLevel, dialectPreference),
    messages: [
      ...priorExchanges.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content: `The learner just answered. Now ask ${ASSESSMENT_QUESTION_LABELS[questionNumber]} only.
Do not comment on their answer quality — transition naturally to the next question.`,
      },
    ],
  });

  return extractText(response);
}

export async function finalizePlacementAssessment(
  userName: string,
  selfAssessedLevel: string,
  dialectPreference: string,
  conversation: JaviMessage[],
): Promise<PlacementAssessmentResult> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi completing a Spanish placement assessment.
Return ONLY valid JSON. No markdown.`;

  const user = `Based on this full assessment conversation, return the placement result.

Learner name: ${userName}
Self-assessed level: ${selfAssessedLevel}
Dialect preference: ${dialectPreference}

Conversation:
${JSON.stringify(conversation)}

Return JSON exactly:
{
  "confirmedLevel": "A1" | "A2" | "B1 Beginner" | "B1 Developing" | "B1 Confident" | "B1 Strong" | "B2 Emerging",
  "adjustedFromSelfAssessment": boolean,
  "adjustmentDirection": "higher" | "lower" | "same",
  "keyStrengths": ["strength 1", "strength 2"],
  "keyWeaknesses": ["weakness 1", "weakness 2"],
  "grammarStartingWeek": integer 1-20,
  "personalNote": "One warm encouraging sentence from Javi about what you noticed"
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = extractFirstJsonObject(extractText(response)) as PlacementAssessmentResult;
  const week = typeof parsed.grammarStartingWeek === 'number' ? parsed.grammarStartingWeek : 1;
  return {
    ...parsed,
    grammarStartingWeek: Math.max(1, Math.min(20, Math.trunc(week))),
    keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths.slice(0, 2) : [],
    keyWeaknesses: Array.isArray(parsed.keyWeaknesses) ? parsed.keyWeaknesses.slice(0, 2) : [],
  };
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
  targetsFocusTip?: boolean;
  focusLabel?: string;
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
  partOfSpeech?: string;
  usageNote?: string;
};

export async function lookupVocabularyWord(
  spanishWord: string,
  contextSentence?: string,
): Promise<VocabLookupJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are a Spanish lexicographer for B1–B2 learners.
Return ONLY valid JSON. No markdown.`;

  const user = `Look up this Spanish word or short phrase for a learner: "${spanishWord.trim()}"
${contextSentence ? `\nIt appeared in this sentence: ${contextSentence}` : ''}

Return JSON exactly:
{
  "spanish": "canonical Spanish form",
  "english": "English translation (use / for multiple meanings)",
  "partOfSpeech": "verb / noun / adjective / adverb / preposition / pronoun / other",
  "usageNote": "optional brief usage note for complex words, or empty string",
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
    partOfSpeech: typeof parsed.partOfSpeech === 'string' ? parsed.partOfSpeech.trim() : undefined,
    usageNote: typeof parsed.usageNote === 'string' ? parsed.usageNote.trim() : undefined,
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
      focusLabel: typeof q.focusLabel === 'string' ? q.focusLabel.trim() : undefined,
    }));
}

export type InterleavedDrillPlan = {
  primary: string;
  secondary: string;
  mastered: string;
  preview: string;
};

export type FocusTipsDrillInput = {
  tips: string[];
  grammarFocus: string;
};

export async function generateInterleavedPracticeQuestions(
  plan: InterleavedDrillPlan,
  errorDnaTargets: ErrorDNAInput[] = [],
  focusTips?: FocusTipsDrillInput | null,
): Promise<QuickFireQuestion[]> {
  const anthropic = getClient();
  const model = getModel();
  const count = 10;

  const errorDnaBlock =
    errorDnaTargets.length > 0
      ? `
Up to 2 questions may target these recurring user errors:
${formatErrorDnaForDrillPrompt(errorDnaTargets)}
For those set "targetsErrorDna": true.`
      : '';

  const focusTipsBlock =
    focusTips && focusTips.tips.length > 0
      ? `
The user's current focus tips from their last lesson are:
${formatFocusTipsForDrillPrompt(focusTips.tips)}
Grammar focus: ${focusTips.grammarFocus}

Generate drill questions that specifically target these exact areas. At least 4 of the ${count} questions must directly address one of these tips.
For those questions set "targetsFocusTip": true.`
      : '';

  const system = `You are Javi, a Spanish tutor creating interleaved B1 drill questions.
Return ONLY valid JSON. No markdown. No extra keys.

${CORE_VOCABULARY_PROMPT}`;

  const user = `Generate exactly ${count} interleaved Spanish practice questions using INTERLEAVING — mix topics within one session.

Distribution (each question MUST include a short focusLabel):
- 4 questions on PRIMARY weak area: "${plan.primary}"
- 3 questions on SECONDARY weak area: "${plan.secondary}"
- 2 questions on MASTERED area (retrieval practice / spaced review): "${plan.mastered}"
- 1 PREVIEW question on next grammar topic: "${plan.preview}"

${errorDnaBlock}
${focusTipsBlock}

Question types — vary across: fill_blank, translate_word, correct_mistake, choose_word, quick_translate, conjugate, choose_tense, translate_tense, reorder_words, spot_structure_error, complete_structure, choose_construction.

Rules:
- Short prompts. Answers brief (1–6 words usually).
- focusLabel: subtle 2–4 word label shown to learner e.g. "Preterite", "Travel vocab", "Present (review)", "Future (preview)"
- Shuffle order — do NOT group by focus area.
- expectedAnswer is primary correct answer.
- acceptableAnswers: optional valid variants.

Return JSON exactly:
{
  "questions": [
    {
      "id": "1",
      "type": "fill_blank",
      "prompt": "...",
      "expectedAnswer": "...",
      "acceptableAnswers": ["..."],
      "focusLabel": "Preterite",
      "targetsErrorDna": false,
      "targetsFocusTip": false
    }
  ]
}

Valid type values: ${QUICK_FIRE_TYPES.join(', ')}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1800,
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
      targetsFocusTip: Boolean(q.targetsFocusTip),
      focusLabel: typeof q.focusLabel === 'string' ? q.focusLabel.trim() : undefined,
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

function readTextTypePromptBlock(textType: ReadTextType): string {
  switch (textType) {
    case 'news':
      return `NEWS HEADLINE AND SUMMARY: A short news-style paragraph on a current or evergreen topic — festival, cultural event, food trend, travel, sports. Factual and interesting. NOT political.`;
    case 'recipe':
      return `RECIPE: A simple Spanish recipe with ingredients list and method steps. Great for food vocabulary and imperative forms.`;
    case 'story':
      return `SHORT STORY EXCERPT: 3-4 paragraphs of simple narrative. Natural Spanish, high-frequency vocabulary. Mix present for action, imperfect for description.`;
    case 'social':
      return `SOCIAL MEDIA POST: Short informal Spanish as if from a social media post. Include colloquial language, contractions, informal expressions.`;
    case 'letter':
      return `LETTER OR EMAIL: Short formal or informal letter in Spanish. Clear register — formal vs informal.`;
    case 'lyrics':
      return `SONG LYRICS EXCERPT: 3-4 lines from a famous Spanish-language song style (Rosalía, Alejandro Sanz, Shakira, C. Tangana, Bad Bunny, Jorge Drexler — inspired by, not copied).`;
  }
}

export async function generateReadingSession(
  textType: ReadTextType,
  difficulty: ReadDifficultySpec,
  recentTopics: string[],
  levelBandLabel: string,
): Promise<ReadingSessionContent> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi, creating authentic Spanish reading texts for B1–B2 learners.
Return ONLY valid JSON. No markdown. Use natural, authentic Spanish.

${CORE_VOCABULARY_PROMPT}`;

  const user = `Create a fresh reading session for a ${levelBandLabel} learner.

Text type: ${READ_TEXT_TYPE_LABELS[textType]}
${readTextTypePromptBlock(textType)}

Difficulty (${difficulty.tier}):
- Word count: ${difficulty.wordCountMin}–${difficulty.wordCountMax} words
- Tenses: ${difficulty.tenseGuidance}
- Vocabulary: ${difficulty.vocabGuidance}
- Sentences: ${difficulty.sentenceGuidance}
- Topics: ${difficulty.topicGuidance}

Avoid repeating these recent topics: ${recentTopics.length ? recentTopics.join('; ') : 'none yet'}

Return JSON exactly:
{
  "title": "short Spanish title",
  "topic": "one-line English topic label for tracking",
  "spanishText": "full text in Spanish — use line breaks between paragraphs",
  "vocabularyHighlights": [
    { "spanish": "word", "english": "meaning", "keywordMnemonic": "optional memorable hook" }
  ],
  "comprehensionQuestions": [
    { "id": "1", "promptSpanish": "question in Spanish", "promptEnglish": "optional English hint" }
  ],
  "grammarPatterns": ["short note on a grammar pattern in the text"],
  "culturalNote": "optional brief cultural note in English and Spanish if relevant, or omit"
}

Rules:
- Exactly 2-3 comprehension questions testing understanding (not just memory): gist, opinion, personal connection.
- vocabularyHighlights: exactly 3 useful words from the text.
- grammarPatterns: 1-2 patterns worth noticing.
- culturalNote: only if text involves Spanish culture, food, places or people.
- Authentic natural Spanish. Not political.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = extractText(response);
  const parsed = extractFirstJsonObject(text) as Partial<ReadingSessionContent>;

  return {
    textType,
    title: String(parsed.title ?? 'Lectura').trim(),
    topic: String(parsed.topic ?? READ_TEXT_TYPE_LABELS[textType]).trim(),
    spanishText: String(parsed.spanishText ?? '').trim(),
    vocabularyHighlights: Array.isArray(parsed.vocabularyHighlights)
      ? parsed.vocabularyHighlights
          .filter((v) => v && typeof v.spanish === 'string')
          .slice(0, 5)
          .map((v) => ({
            spanish: String(v.spanish).trim(),
            english: String(v.english ?? '').trim(),
            keywordMnemonic: v.keywordMnemonic ? String(v.keywordMnemonic).trim() : undefined,
          }))
      : [],
    comprehensionQuestions: Array.isArray(parsed.comprehensionQuestions)
      ? parsed.comprehensionQuestions
          .filter((q) => q && typeof q.promptSpanish === 'string')
          .slice(0, 3)
          .map((q, i) => ({
            id: String(q.id ?? i + 1),
            promptSpanish: String(q.promptSpanish).trim(),
            promptEnglish: q.promptEnglish ? String(q.promptEnglish).trim() : undefined,
          }))
      : [],
    grammarPatterns: Array.isArray(parsed.grammarPatterns)
      ? parsed.grammarPatterns.map((g) => String(g).trim()).filter(Boolean).slice(0, 3)
      : [],
    culturalNote: parsed.culturalNote ? String(parsed.culturalNote).trim() : undefined,
  };
}

export async function evaluateReadComprehension(
  session: ReadingSessionContent,
  responses: { questionId: string; answer: string }[],
): Promise<ReadComprehensionEvaluation> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi evaluating reading comprehension responses from a B1–B2 learner.
Return ONLY valid JSON. Be encouraging but honest.`;

  const user = `Text title: ${session.title}
Text (Spanish):
${session.spanishText}

Questions and learner answers:
${session.comprehensionQuestions
  .map((q) => {
    const answer = responses.find((r) => r.questionId === q.id)?.answer ?? '';
    return `Q (${q.id}): ${q.promptSpanish}\nA: ${answer}`;
  })
  .join('\n\n')}

Return JSON:
{
  "score": 0-100 integer overall comprehension score,
  "feedback": "2-3 sentences feedback in English with brief Spanish encouragement",
  "responses": [
    { "questionId": "1", "score": 0-100, "feedback": "short per-question feedback" }
  ]
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = extractFirstJsonObject(extractText(response)) as ReadComprehensionEvaluation;
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    feedback: String(parsed.feedback ?? '').trim(),
    responses: Array.isArray(parsed.responses)
      ? parsed.responses.map((r) => ({
          questionId: String(r.questionId),
          score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
          feedback: String(r.feedback ?? '').trim(),
        }))
      : [],
  };
}

export async function generateReadDiscussionOpening(
  session: ReadingSessionContent,
  focus: LessonFocusContext,
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();
  const vocabList = session.vocabularyHighlights.map((v) => v.spanish).join(', ');

  const system = `${buildSystemPrompt('Read', focus, topErrors)}

The learner has read the text and answered comprehension questions. Start the voice discussion phase.
Introduce 2-3 vocabulary words from the text using keyword mnemonics: ${vocabList}
Ask an opinion question related to the topic. End with Translate: line.`;

  const user = `Text read: "${session.title}"
Topic: ${session.topic}
Type: ${READ_TEXT_TYPE_LABELS[session.textType]}

Open the discussion warmly in Spanish. Reference the text without re-reading it all.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return extractText(response);
}

export async function askJaviReadDiscussion(
  session: ReadingSessionContent,
  focus: LessonFocusContext,
  conversation: JaviMessage[],
  topErrors: ErrorDNAInput[] = [],
): Promise<string> {
  const anthropic = getClient();
  const model = getModel();

  const system = `${buildSystemPrompt('Read', focus, topErrors)}

READING DISCUSSION — continue the conversation about this text:
Title: ${session.title}
Topic: ${session.topic}

Keep responses to 2-3 Spanish sentences + Translate: line.
Discuss cultural context, opinions, and vocabulary from the text.
If slang or informal expressions appear, explain them briefly.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system,
    messages: conversation.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function analyzeReadLesson(
  session: ReadingSessionContent,
  comprehensionScore: number,
  comprehensionFeedback: string,
  speakingConversation: JaviMessage[],
  speakingScore: number,
  wordsSaved: { spanish: string; english: string }[],
): Promise<LessonAnalysisJson> {
  const anthropic = getClient();
  const model = getModel();

  const system = `You are Javi summarising a Read with Javi lesson.
Return ONLY valid JSON. No markdown.`;

  const user = `Reading session:
- Title: ${session.title}
- Type: ${READ_TEXT_TYPE_LABELS[session.textType]}
- Topic: ${session.topic}
- Comprehension score: ${comprehensionScore}%
- Comprehension feedback: ${comprehensionFeedback}
- Speaking score: ${speakingScore}%
- Words saved: ${wordsSaved.map((w) => w.spanish).join(', ') || 'none'}
- Grammar patterns in text: ${session.grammarPatterns.join('; ')}

Discussion transcript:
${speakingConversation.map((m) => `${m.role}: ${m.content}`).join('\n')}

Return JSON:
{
  "strongAreas": ["2 strengths"],
  "weakAreas": ["2 areas to improve"],
  "focusAreas": ["2 focus topics for next time"],
  "correctnessScore": 0-100,
  "overallScore": 0-100 average of comprehension, vocabulary use, fluency in discussion,
  "encouragingMessage": "Spanish / English motivational line",
  "errorDNA": [],
  "breakdown": {
    "grammar": { "score": 0-100, "topic": "Reading", "details": ["2 notes"], "lessonDescription": "...", "mistakes": [] },
    "vocabulary": { "score": 0-100, "topic": "${session.topic}", "details": ["2 notes"], "wordsCorrect": [], "wordsToRevisit": [] },
    "fluency": { "score": ${speakingScore}, "details": ["2 notes"], "description": "...", "positivePatterns": [], "negativePatterns": [], "sentenceNotes": [], "weeklyTips": [] },
    "writing": { "score": ${comprehensionScore}, "details": ["comprehension notes"] },
    "reading": {
      "score": ${comprehensionScore},
      "topic": "${session.topic}",
      "textType": "${READ_TEXT_TYPE_LABELS[session.textType]}",
      "details": ["2 reading comprehension notes"],
      "wordsLearned": ${JSON.stringify(wordsSaved.slice(0, 5))},
      "grammarPatterns": ${JSON.stringify(session.grammarPatterns)}
    }
  }
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = extractFirstJsonObject(extractText(response)) as LessonAnalysisJson;
  const readingScore = Math.round(
    (comprehensionScore + speakingScore + (parsed.breakdown?.vocabulary?.score ?? comprehensionScore)) / 3,
  );
  return {
    ...parsed,
    overallScore: Math.round(
      (comprehensionScore + speakingScore + (parsed.overallScore ?? comprehensionScore)) / 2,
    ),
    breakdown: {
      ...parsed.breakdown,
      reading: {
        ...(parsed.breakdown?.reading ?? {
          score: comprehensionScore,
          topic: session.topic,
          textType: READ_TEXT_TYPE_LABELS[session.textType],
          details: [],
          wordsLearned: wordsSaved,
          grammarPatterns: session.grammarPatterns,
        }),
        score: readingScore,
        wordsLearned: wordsSaved.length ? wordsSaved : parsed.breakdown?.reading?.wordsLearned ?? [],
        grammarPatterns: session.grammarPatterns,
      },
      writing: {
        ...parsed.breakdown?.writing,
        score: comprehensionScore,
      },
    },
  };
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
