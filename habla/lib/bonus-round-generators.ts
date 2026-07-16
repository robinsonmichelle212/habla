import Anthropic from '@anthropic-ai/sdk';

import {
  calibrationJsonBlock,
  levelContentGuide,
  type RoundCalibration,
} from '@/lib/bonus-round-calibration';
import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

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

function calibrationBlock(cal: RoundCalibration): string {
  return `Calibration:\n${calibrationJsonBlock(cal)}\n\nLevel guide: ${levelContentGuide(cal)}\nSession length: ${cal.sessionMinutes} minutes.`;
}

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export async function generateQuizRound(
  cal: RoundCalibration,
  excludePrompts: string[] = [],
): Promise<QuizQuestion[]> {
  const client = getClient();
  const count = cal.questionCount;
  const excluded = excludePrompts
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 40);
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    system: 'Return ONLY valid JSON. Spanish general knowledge quiz for language learners.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Generate ${count} multiple choice questions in Spanish.
Topics: Spanish geography, culture, food, history, famous people.
Each question: prompt in Spanish, exactly 4 options, correctIndex 0-3.
Adjust vocabulary, sentence length, grammar complexity, and cultural depth per calibration.
${
  excluded.length
    ? `Do NOT repeat any of these previous questions (new prompts only):\n${excluded.map((p) => `- ${p}`).join('\n')}`
    : ''
}

Return: { "questions": [{ "id":"1", "prompt":"...", "options":["a","b","c","d"], "correctIndex": 0 }] }`,
      },
    ],
  });
  const parsed = extractJson<{ questions: QuizQuestion[] }>(extractText(response));
  const excludeSet = new Set(excluded.map((p) => p.toLowerCase()));
  return (parsed.questions ?? [])
    .filter((q) => !excludeSet.has(String(q.prompt ?? '').trim().toLowerCase()))
    .slice(0, count)
    .map((q, i) => ({
      id: String(q.id ?? i + 1),
      prompt: q.prompt,
      options: q.options,
      correctIndex: Math.max(0, Math.min(3, q.correctIndex ?? 0)),
    }));
}

export type SlangExpression = {
  spain: string;
  argentina: string;
  meaning: string;
  example: string;
};

export type SlangRoundContent = {
  expressions: SlangExpression[];
  drill: { situation: string; options: string[]; correctIndex: number };
  slangCard: { spanish: string; english: string; exampleSpanish: string };
};

const SLANG_COUNTS = { 1: 3, 2: 5, 3: 7, 4: 8, 5: 10 } as const;

export async function generateSlangRound(cal: RoundCalibration): Promise<SlangRoundContent> {
  const exprCount = SLANG_COUNTS[cal.roundLevel];
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1600,
    system: 'Return ONLY valid JSON. Teach Spain vs Argentina slang.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Generate a slang round with ${exprCount} expressions (Spain primary, Argentine equivalent noted).
Include drill: situation in Spanish, 4 slang options, correctIndex.
Include slangCard: one key phrase to save to vocabulary.

Return JSON:
{
  "expressions": [{ "spain": "tío", "argentina": "che", "meaning": "...", "example": "..." }],
  "drill": { "situation": "...", "options": ["a","b","c","d"], "correctIndex": 0 },
  "slangCard": { "spanish": "...", "english": "...", "exampleSpanish": "..." }
}`,
      },
    ],
  });
  return extractJson<SlangRoundContent>(extractText(response));
}

const ROLEPLAY_SCENARIOS = [
  'Ordering food and complaining about a mistake at a Madrid restaurant',
  'Asking for directions in Seville and getting lost',
  'Negotiating a price at a market in Barcelona',
  'Checking into a hotel and reporting a problem',
  'Having a job interview at a Spanish company',
  "Meeting a friend's family for the first time",
  'Dealing with a cancelled flight at Madrid airport',
  'Reporting a lost item to Spanish police',
];

export type RoleplayRoundContent = {
  scenario: string;
  characterName: string;
  characterRole: string;
  openingLine: string;
  goals: string[];
};

export async function generateRoleplayRound(cal: RoundCalibration): Promise<RoleplayRoundContent> {
  const scenario = ROLEPLAY_SCENARIOS[Math.floor(Math.random() * ROLEPLAY_SCENARIOS.length)];
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 800,
    system: 'Return ONLY valid JSON.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Role play scenario: ${scenario}
Match pace, patience, register, and complexity to the level guide.
Return JSON: { "scenario": "...", "characterName": "...", "characterRole": "...", "openingLine": "Spanish in character", "goals": ["goal1","goal2"] }`,
      },
    ],
  });
  return extractJson<RoleplayRoundContent>(extractText(response));
}

export async function evaluateRoleplay(
  scenario: string,
  conversation: { role: string; content: string }[],
): Promise<{ score: number; feedback: string; naturalPhrases: string[] }> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 600,
    system: 'Return ONLY valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Evaluate roleplay in scenario: ${scenario}
Transcript: ${JSON.stringify(conversation)}
Return: { "score": 0-100, "feedback": "...", "naturalPhrases": ["phrase tips"] }`,
      },
    ],
  });
  return extractJson(extractText(response));
}

export type ShadowingSentence = {
  id: string;
  spanish: string;
  english: string;
};

export async function generateShadowingRound(cal: RoundCalibration): Promise<ShadowingSentence[]> {
  const curriculum = await resolveGrammarCurriculum();
  const week = getWeekDefinition(curriculum.currentWeek);
  const count = cal.questionCount;
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1200,
    system: 'Return ONLY valid JSON.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Generate ${count} Spanish sentences for shadowing practice, progressively longer.
Grammar focus: ${week.topic}. Use focus verbs: ${week.focusVerbs.join(', ')}.
Match speed and complexity to level guide.
Return: { "sentences": [{ "id":"1", "spanish":"...", "english":"..." }] }`,
      },
    ],
  });
  const parsed = extractJson<{ sentences: ShadowingSentence[] }>(extractText(response));
  return (parsed.sentences ?? []).slice(0, count);
}

export async function compareShadowing(
  original: string,
  spoken: string,
): Promise<{ accuracy: number; feedback: string }> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 300,
    system: 'Return ONLY valid JSON. Lenient on minor accent variations.',
    messages: [
      {
        role: 'user',
        content: `Original: "${original}"
User said: "${spoken}"
Return: { "accuracy": 0-100, "feedback": "You said X but Javi said Y style tip" }`,
      },
    ],
  });
  return extractJson(extractText(response));
}

const CULTURE_TOPICS = [
  'Spanish food regions — what to eat where and why',
  'Spanish festivals — San Fermín, La Tomatina, Las Fallas, Semana Santa',
  'Spanish art and architecture — Gaudí, Dalí, Velázquez, Picasso',
  'Spanish music — flamenco origins, regional styles, modern artists',
  'Spanish film — Almodóvar, Amenábar, Pan\'s Labyrinth',
  'Spanish history — the Reconquista, Civil War, transition to democracy',
  'Argentine culture — tango, mate, asado, Borges, Maradona',
  'Spanish geography — regions, languages, landscapes',
];

export type CultureRoundContent = {
  topic: string;
  presentation: string;
  discussionPrompts: string[];
  culturalNote: string;
};

export async function generateCultureRound(cal: RoundCalibration): Promise<CultureRoundContent> {
  const topic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1200,
    system: 'Return ONLY valid JSON. Javi presents cultural content in Spanish.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Culture deep dive topic: ${topic}
Return JSON:
{
  "topic": "...",
  "presentation": "Spanish paragraphs scaled to level — shorter for level 1",
  "discussionPrompts": ["questions in Spanish"],
  "culturalNote": "Brief English+Spanish cultural note for encyclopedia"
}`,
      },
    ],
  });
  return extractJson<CultureRoundContent>(extractText(response));
}

export type MusicRoundContent = {
  artist: string;
  song: string;
  context: string;
  verses: string;
  lineByLine: { line: string; explanation: string }[];
  vocabDrill: { spanish: string; english: string }[];
  theme: string;
};

const MUSIC_ROTATION = [
  { artist: 'Rosalía', song: 'Malamente' },
  { artist: 'Alejandro Sanz', song: 'Corazón Partío' },
  { artist: 'Shakira', song: 'La Bicicleta' },
  { artist: 'C. Tangana', song: 'Nunca Estoy' },
  { artist: 'Jorge Drexler', song: 'Todo Se Transforma' },
  { artist: 'Bad Bunny', song: 'Tití Me Preguntó' },
  { artist: 'Café Tacvba', song: 'La Ingrata' },
  { artist: 'Mercedes Sosa', song: 'Gracias a la Vida' },
];

export async function generateMusicRound(cal: RoundCalibration): Promise<MusicRoundContent> {
  const pick = MUSIC_ROTATION[Math.floor(Math.random() * MUSIC_ROTATION.length)];
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1600,
    system: 'Return ONLY valid JSON. Text-only lyrics excerpt, no audio.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Music round: ${pick.artist} — ${pick.song}
Return JSON with context, verses as text (fewer/simpler at level 1), lineByLine explanations, vocabDrill (5 words), theme.`,
      },
    ],
  });
  return extractJson<MusicRoundContent>(extractText(response));
}

export type FilmRoundContent = {
  title: string;
  sceneDescription: string;
  dialogue: string;
  vocabulary: { spanish: string; english: string; note: string }[];
  discussionQuestions: string[];
  dialectNotes: string;
};

const FILM_ROTATION = [
  'La Casa de Papel / Money Heist',
  'Élite',
  'La Casa de las Flores',
  'Pan\'s Labyrinth',
  'Todo sobre mi madre (Almodóvar)',
  'Velvet',
  'Cuéntame cómo pasó',
];

export async function generateFilmRound(cal: RoundCalibration): Promise<FilmRoundContent> {
  const title = FILM_ROTATION[Math.floor(Math.random() * FILM_ROTATION.length)];
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1600,
    system: 'Return ONLY valid JSON.',
    messages: [
      {
        role: 'user',
        content: `${calibrationBlock(cal)}
Film/TV round: ${title}
Describe a scene in Spanish, key dialogue as text, vocabulary, discussion questions, Spain vs Argentina dialect notes.
Match dialogue complexity and cultural depth to level guide.
Return JSON.`,
      },
    ],
  });
  return extractJson<FilmRoundContent>(extractText(response));
}

export async function generateImmersionOpening(cal: RoundCalibration): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 400,
    system: `You are Javi. IMMERSION MODE: Spanish ONLY. No English. No Translate line. ${calibrationBlock(cal)}`,
    messages: [
      {
        role: 'user',
        content: 'Open an immersion lesson warmly in 2-3 Spanish sentences. Ask a question to start conversation.',
      },
    ],
  });
  return extractText(response);
}

export async function askImmersionJavi(
  conversation: { role: 'user' | 'assistant'; content: string }[],
  cal: RoundCalibration,
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 400,
    system: `IMMERSION: Spanish only. ${calibrationBlock(cal)} If user writes English, respond exactly: "En español, por favor. / In Spanish please." then continue in Spanish.`,
    messages: conversation.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function evaluateImmersion(
  conversation: { role: string; content: string }[],
): Promise<{ score: number; feedback: string }> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 400,
    system: 'Return ONLY valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Score immersion conversation 0-100. Transcript: ${JSON.stringify(conversation)}
Return: { "score": number, "feedback": "brief Spanish/English" }`,
      },
    ],
  });
  return extractJson(extractText(response));
}

export async function askSlangJavi(
  expressions: SlangExpression[],
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system: `Teach slang naturally. Expressions: ${JSON.stringify(expressions)}. Use Translate: line for English.`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function askCultureJavi(
  topic: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system: `Cultural discussion about: ${topic}. Spanish with Translate: line.`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function askRoleplayJavi(
  content: RoleplayRoundContent,
  messages: { role: 'user' | 'assistant'; content: string }[],
  cal: RoundCalibration,
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system: `Stay in character as ${content.characterName} (${content.characterRole}). Scenario: ${content.scenario}. ${calibrationBlock(cal)} Spanish only in character.`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function askMusicJavi(
  content: MusicRoundContent,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system: `Discuss song ${content.song} by ${content.artist}. Theme: ${content.theme}. Translate: line.`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export async function askFilmJavi(
  content: FilmRoundContent,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system: `Discuss ${content.title}. Dialect notes: ${content.dialectNotes}. Translate: line.`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return extractText(response);
}

export function quizRoundGems(score: number, totalQuestions = 10): number {
  if (totalQuestions <= 0) return 0;
  const ratio = score / totalQuestions;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.5) return 2;
  return 0;
}

export function immersionRoundGems(score: number): number {
  let gems = 10;
  if (score >= 75) gems += 5;
  return gems;
}
