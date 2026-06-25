import Anthropic from '@anthropic-ai/sdk';

import type { VerbConjugationEntry } from '@/lib/conjugation-data';
import { normalizeSearchVerb } from '@/lib/conjugation-data';
import { cacheConjugation, getCachedConjugation } from '@/lib/conjugation-cache';
import type { GrammarTopic } from '@/lib/grammar-curriculum';
import { TENSE_LABELS, tensesForTopic, type TenseKey } from '@/lib/grammar-tenses';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function getClient(): Anthropic {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_ANTHROPIC_API_KEY environment variable.');
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function getModel(): string {
  return process.env.EXPO_PUBLIC_ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Claude did not return JSON.');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('Claude did not return valid JSON.');
}

function tenseLabelsForTopic(topic: GrammarTopic): string[] {
  return tensesForTopic(topic).map((k) => TENSE_LABELS[k]);
}

export async function lookupVerbConjugation(
  verb: string,
  topic: GrammarTopic,
): Promise<VerbConjugationEntry> {
  const normalized = normalizeSearchVerb(verb);
  if (!normalized) {
    throw new Error('Enter a Spanish verb.');
  }

  const cached = await getCachedConjugation(normalized);
  if (cached) return cached;

  const tenseKeys = tensesForTopic(topic);
  const tenseList = tenseLabelsForTopic(topic).join(', ');

  const client = getClient();
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 1800,
    messages: [
      {
        role: 'user',
        content: `Return ONLY valid JSON for the Spanish verb "${normalized}".

Include these tenses: ${tenseList}.

JSON shape:
{
  "infinitive": "${normalized}",
  "english": "English meaning",
  "regular": true or false,
  "regionNote": "optional note about Spain vs Argentina if relevant",
  "tenses": [
    {
      "tenseKey": one of ${JSON.stringify(tenseKeys)},
      "tenseLabel": "label matching the tense",
      "forms": [
        { "person": "yo", "form": "...", "argentinaNote": "(vos ...)" or omit, "irregular": true or false },
        { "person": "tú", ... },
        { "person": "él/ella", ... },
        { "person": "nosotros", ... },
        { "person": "vosotros", ... },
        { "person": "ellos/ellas", ... }
      ]
    }
  ]
}

Rules:
- Use correct Spanish accents and spelling.
- Mark irregular stems/forms with "irregular": true.
- For Argentina, put vos forms in argentinaNote on the tú row only, in brackets.
- Spain uses vosotros; include vosotros forms.
- No markdown, no commentary — JSON only.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const parsed = extractFirstJsonObject(text) as VerbConjugationEntry;
  if (!parsed?.infinitive || !Array.isArray(parsed.tenses)) {
    throw new Error('Could not parse conjugation.');
  }

  await cacheConjugation(normalized, parsed);
  return parsed;
}
