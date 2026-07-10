import Anthropic from '@anthropic-ai/sdk';

import type { MilestoneQuizContext } from '@/lib/milestone-celebration-quiz';
import type { MilestoneQuizTriggerId } from '@/lib/milestone-celebration-quiz';

function getClient(): Anthropic {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error('Missing EXPO_PUBLIC_ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

function extractJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in response');
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export type MilestoneQuizQuestionType =
  | 'vocabulary_recognition'
  | 'grammar_application'
  | 'personal_recall'
  | 'javi_phrase';

export type MilestoneQuizQuestion = {
  id: string;
  type: MilestoneQuizQuestionType;
  prompt: string;
  format: 'multiple_choice' | 'text_input';
  options?: [string, string, string, string];
  correctIndex?: number;
  expectedAnswer?: string;
  acceptableAnswers?: string[];
  explanation: string;
  drillTag?: string;
};

function normalizeQuestion(raw: Partial<MilestoneQuizQuestion>, index: number): MilestoneQuizQuestion | null {
  if (!raw.prompt || !raw.explanation) return null;
  const format = raw.format === 'text_input' ? 'text_input' : 'multiple_choice';
  const type = (['vocabulary_recognition', 'grammar_application', 'personal_recall', 'javi_phrase'] as const).includes(
    raw.type as MilestoneQuizQuestionType,
  )
    ? (raw.type as MilestoneQuizQuestionType)
    : 'vocabulary_recognition';

  if (format === 'multiple_choice') {
    const options = raw.options;
    if (!options || options.length !== 4) return null;
    const correctIndex = Math.max(0, Math.min(3, Math.trunc(Number(raw.correctIndex) || 0)));
    return {
      id: String(raw.id ?? index + 1),
      type,
      prompt: raw.prompt.trim(),
      format,
      options: options.map((o) => String(o).trim()) as [string, string, string, string],
      correctIndex,
      explanation: raw.explanation.trim(),
      drillTag: typeof raw.drillTag === 'string' ? raw.drillTag.trim() : undefined,
    };
  }

  if (!raw.expectedAnswer?.trim()) return null;
  return {
    id: String(raw.id ?? index + 1),
    type,
    prompt: raw.prompt.trim(),
    format,
    expectedAnswer: raw.expectedAnswer.trim(),
    acceptableAnswers: Array.isArray(raw.acceptableAnswers)
      ? raw.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
      : undefined,
    explanation: raw.explanation.trim(),
    drillTag: typeof raw.drillTag === 'string' ? raw.drillTag.trim() : undefined,
  };
}

export function checkMilestoneQuizAnswer(
  question: MilestoneQuizQuestion,
  userAnswer: string,
): boolean {
  if (question.format === 'multiple_choice') {
    const idx = Number(userAnswer);
    return Number.isFinite(idx) && idx === question.correctIndex;
  }
  const normalized = userAnswer.trim().toLowerCase();
  const expected = question.expectedAnswer?.trim().toLowerCase() ?? '';
  if (!normalized || !expected) return false;
  if (normalized === expected) return true;
  const variants = question.acceptableAnswers ?? [];
  return variants.some((a) => a.trim().toLowerCase() === normalized);
}

function buildFallbackQuestions(context: MilestoneQuizContext, count: number): MilestoneQuizQuestion[] {
  const questions: MilestoneQuizQuestion[] = [];
  const vocab = context.savedVocabulary;
  const grammar = context.completedGrammarWeeks;

  for (let i = 0; i < Math.min(count, vocab.length); i += 1) {
    const word = vocab[i];
    const wrong = vocab
      .filter((_, idx) => idx !== i)
      .slice(0, 3)
      .map((w) => w.english);
    while (wrong.length < 3) wrong.push(`option ${wrong.length + 1}`);
    const options = [word.english, ...wrong.slice(0, 3)] as [string, string, string, string];
    questions.push({
      id: String(questions.length + 1),
      type: 'vocabulary_recognition',
      prompt: `Javi used this word in one of your lessons — what does '${word.spanish}' mean?`,
      format: 'multiple_choice',
      options,
      correctIndex: 0,
      explanation: `'${word.spanish}' means '${word.english}'. You saved this from your own lessons.`,
      drillTag: word.spanish,
    });
  }

  if (grammar.length > 0 && questions.length < count) {
    const topic = grammar[grammar.length - 1].topic;
    questions.push({
      id: String(questions.length + 1),
      type: 'grammar_application',
      prompt: `You've been practising ${topic} — complete this sentence: 'Ayer yo ___ (ir) al mercado'`,
      format: 'text_input',
      expectedAnswer: 'fui',
      acceptableAnswers: ['yo fui'],
      explanation: `With ${topic}, the preterite of ir is 'fui'.`,
      drillTag: topic,
    });
  }

  for (const phrase of context.javiPhrases.slice(0, Math.max(0, count - questions.length))) {
    const wrong = vocab
      .filter((w) => w.english !== phrase.english)
      .slice(0, 3)
      .map((w) => w.english);
    while (wrong.length < 3) wrong.push('Something else');
    questions.push({
      id: String(questions.length + 1),
      type: 'javi_phrase',
      prompt: `Javi said this to you in a recent lesson — what does it mean? '${phrase.spanish}'`,
      format: 'multiple_choice',
      options: [phrase.english, ...wrong.slice(0, 3)] as [string, string, string, string],
      correctIndex: 0,
      explanation: `'${phrase.spanish}' means '${phrase.english}'.`,
      drillTag: phrase.spanish,
    });
  }

  return questions.slice(0, count);
}

export async function generateMilestoneCelebrationQuiz(
  triggerId: MilestoneQuizTriggerId,
  context: MilestoneQuizContext,
  questionCount: number,
): Promise<MilestoneQuizQuestion[]> {
  if (
    context.savedVocabulary.length === 0 &&
    context.completedGrammarWeeks.length === 0 &&
    context.javiPhrases.length === 0
  ) {
    return buildFallbackQuestions(context, Math.min(questionCount, 5));
  }

  try {
    const client = getClient();
    const levelFocus =
      triggerId === 'level-up' && context.levelLabel
        ? `Focus questions on content appropriate for ${context.levelLabel}.`
        : triggerId === 'grammar-complete'
          ? 'Span questions across ALL completed grammar weeks.'
          : '';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: `You are Javi creating a warm, celebratory Spanish recap quiz — a reward, NOT a test.
Return ONLY valid JSON. Questions must use ONLY the learner data provided — never generic textbook content.`,
      messages: [
        {
          role: 'user',
          content: `Create exactly ${questionCount} personalised milestone quiz questions.

Milestone: ${context.milestone}
Current level: ${context.currentLevel}
${levelFocus}

Learner data (use ONLY this):
${JSON.stringify(
  {
    completedGrammarWeeks: context.completedGrammarWeeks,
    savedVocabulary: context.savedVocabulary,
    lessonTypes: context.lessonTypes,
    yourDayTopics: context.yourDayTopics,
    javiPhrases: context.javiPhrases,
  },
  null,
  2,
)}

Question types to mix:
1. vocabulary_recognition — "Javi used this word in one of your lessons — what does '[saved word]' mean?" — multiple_choice with 4 plausible options
2. grammar_application — "You've been practising [grammar topic] — complete this sentence: ..." — text_input
3. personal_recall — "In one of your Your Day lessons you talked about [topic] — how would you say '[phrase]' in Spanish?" — text_input
4. javi_phrase — "Javi said this to you in a recent lesson — what does it mean? '[phrase]'" — multiple_choice

Rules:
- Warm, encouraging tone in prompts
- Every question needs a brief friendly explanation
- drillTag: Spanish word/phrase to practise if missed
- multiple_choice: correctIndex 0-3, exactly 4 options
- text_input: expectedAnswer + optional acceptableAnswers
- Shuffle types across the set

Return JSON:
{
  "questions": [
    {
      "id": "1",
      "type": "vocabulary_recognition",
      "prompt": "...",
      "format": "multiple_choice",
      "options": ["a","b","c","d"],
      "correctIndex": 0,
      "explanation": "...",
      "drillTag": "..."
    }
  ]
}`,
        },
      ],
    });

    const parsed = extractJson<{ questions: Partial<MilestoneQuizQuestion>[] }>(extractText(response));
    const normalized = (parsed.questions ?? [])
      .map((q, i) => normalizeQuestion(q, i))
      .filter((q): q is MilestoneQuizQuestion => q != null)
      .slice(0, questionCount);

    if (normalized.length >= Math.min(questionCount, 5)) return normalized;
    const fallback = buildFallbackQuestions(context, questionCount);
    const merged = [...normalized];
    for (const q of fallback) {
      if (merged.length >= questionCount) break;
      if (!merged.some((m) => m.prompt === q.prompt)) merged.push({ ...q, id: String(merged.length + 1) });
    }
    return merged.slice(0, questionCount);
  } catch {
    return buildFallbackQuestions(context, questionCount);
  }
}
