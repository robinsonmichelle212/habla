/** Matches `rate` in lib/javi-speech.ts */
export const JAVI_SPEECH_RATE = 0.85;

export const TYPING_DOT_DELAY_MS = 500;
export const TYPING_WORD_DELAY_MS = 80;
export const TYPING_SENTENCE_PAUSE_MS = 200;

const BASE_MS_PER_WORD_AT_RATE_1 = 350;

export function tokenizeWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function endsSentence(word: string): boolean {
  return /[.!?…]["')\]]*$/.test(word);
}

/** Rough TTS duration so on-screen text never outpaces Javi's voice. */
export function estimateSpeechDurationMs(text: string): number {
  const words = tokenizeWords(text);
  if (!words.length) return 0;
  const msPerWord = BASE_MS_PER_WORD_AT_RATE_1 / JAVI_SPEECH_RATE;
  return words.length * msPerWord;
}

export function wordDelayMs(
  fullText: string,
  wordIndex: number,
  words: string[],
  voiceSync: boolean,
): number {
  const base = voiceSync
    ? Math.max(TYPING_WORD_DELAY_MS, estimateSpeechDurationMs(fullText) / Math.max(words.length, 1))
    : TYPING_WORD_DELAY_MS;

  if (wordIndex <= 0) return base;

  const pause = endsSentence(words[wordIndex - 1] ?? '') ? TYPING_SENTENCE_PAUSE_MS : 0;
  return base + pause;
}
