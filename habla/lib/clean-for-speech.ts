/**
 * Strips markdown and other non-speech characters before text-to-speech.
 */
export function cleanForSpeech(text: string): string {
  return text
    .split(/\r?\n\s*(Translate|Translation)\s*:/i)[0]
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*#_`~|]/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
