import { Platform } from 'react-native';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

function getOpenAiApiKey(): string {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY environment variable.');
  }
  return key;
}

export type WhisperResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'unintelligible' | 'api' };

function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function looksUnintelligible(text: string): boolean {
  const cleaned = normalizeTranscript(text);
  if (!cleaned) return true;
  if (/^(thank you for watching|subtitles by|gracias por ver)/i.test(cleaned)) return true;
  if (/^[\W_]+$/.test(cleaned)) return true;
  return false;
}

export async function transcribeSpanishAudio(uri: string): Promise<WhisperResult> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'api' };
  }

  const apiKey = getOpenAiApiKey();
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'audio/m4a',
    name: 'habla-recording.m4a',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');

  let response: Response;
  try {
    response = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch {
    return { ok: false, reason: 'api' };
  }

  if (!response.ok) {
    return { ok: false, reason: 'api' };
  }

  let payload: { text?: string };
  try {
    payload = (await response.json()) as { text?: string };
  } catch {
    return { ok: false, reason: 'api' };
  }

  const text = normalizeTranscript(payload.text ?? '');
  if (!text) return { ok: false, reason: 'empty' };
  if (looksUnintelligible(text)) return { ok: false, reason: 'unintelligible' };
  return { ok: true, text };
}
