export const READY_FOR_WRITING_MARKER = '[READY_FOR_WRITING]';

export function stripReadyForWritingMarker(text: string): { text: string; ready: boolean } {
  const ready = text.includes(READY_FOR_WRITING_MARKER);
  const cleaned = text.replace(/\s*\[READY_FOR_WRITING\]\s*/g, '').trim();
  return { text: cleaned, ready };
}

export function parseJaviResponse(fullText: string): { spanish: string; translation?: string } {
  const raw = stripReadyForWritingMarker(fullText).text.trim();
  if (!raw) return { spanish: '(Sin respuesta)' };

  const lines = raw.split(/\r?\n/);
  const translateIdx = lines.findIndex((l) => /^\s*(Translate|Translation)\s*:\s*/i.test(l));

  if (translateIdx === -1) {
    return { spanish: raw };
  }

  const spanish = lines.slice(0, translateIdx).join('\n').trim();
  const firstLine = lines[translateIdx] ?? '';
  const firstPart = firstLine.replace(/^\s*(Translate|Translation)\s*:\s*/i, '').trim();
  const rest = lines.slice(translateIdx + 1).join('\n').trim();
  const translation = [firstPart, rest].filter(Boolean).join('\n').trim();

  return {
    spanish: spanish || '(Sin respuesta)',
    translation: translation || undefined,
  };
}

export function safeSpanish(spanish: string): string {
  return spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();
}
