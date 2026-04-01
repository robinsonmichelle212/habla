import Anthropic from '@anthropic-ai/sdk';

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

export type JaviMessage = { role: 'user' | 'assistant'; content: string };

const LESSON_FOCUS: Record<LessonType, string> = {
  Grammar:
    'Focus on one grammar point at a time (e.g. one tense, one structure). Drill it clearly before moving on.',
  Vocab:
    'Introduce 2–3 new words per message, used naturally in context; briefly reinforce meaning.',
  'Your Day':
    'Ask simple, natural questions about daily life (routines, plans, how things went).',
};

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Missing EXPO_PUBLIC_ANTHROPIC_API_KEY. Add it to your .env file (see app.config.js for load paths).',
    );
  }
  return key;
}

function buildSystemPrompt(lessonType: LessonType): string {
  return `You are Javi, a warm, encouraging Spanish tutor in a mobile app.

This session's lesson type: ${lessonType}
Apply this focus: ${LESSON_FOCUS[lessonType]}

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

/**
 * Sends the user's message to Claude as Javi. Pass prior turns (excluding the current message)
 * so the conversation stays coherent.
 */
export async function askJavi(
  lessonType: LessonType,
  userMessage: string,
  priorExchanges: JaviMessage[] = [],
): Promise<string> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new Error('Message is empty.');
  }

  const apiKey = getApiKey();
  const model = process.env.EXPO_PUBLIC_ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

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
    system: buildSystemPrompt(lessonType),
    messages,
  });

  return extractText(response);
}
