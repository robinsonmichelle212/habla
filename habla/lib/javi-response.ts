export function parseJaviResponse(fullText: string): { spanish: string; translation?: string } {
  const raw = fullText.trim();
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
