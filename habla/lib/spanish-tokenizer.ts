export type SpanishToken = {
  type: 'word' | 'space';
  value: string;
  index: number;
};

/** Split Spanish text into tappable words and whitespace/punctuation gaps. */
export function tokenizeSpanishText(text: string): SpanishToken[] {
  const parts: SpanishToken[] = [];
  const re = /(\s+|[^\s\wáéíóúüñÁÉÍÓÚÜÑ]+|\w[\wáéíóúüñÁÉÍÓÚÜÑ]*)/gu;
  let match: RegExpExecArray | null;
  let wordIndex = 0;
  while ((match = re.exec(text)) !== null) {
    const value = match[0];
    if (/^\s+$/.test(value) || !/^[\wáéíóúüñÁÉÍÓÚÜÑ]+$/iu.test(value)) {
      parts.push({ type: 'space', value, index: -1 });
    } else {
      parts.push({ type: 'word', value, index: wordIndex });
      wordIndex += 1;
    }
  }
  return parts;
}

export function cleanSpanishToken(word: string): string {
  return word.replace(/^[^\wáéíóúüñÁÉÍÓÚÜÑ]+|[^\wáéíóúüñÁÉÍÓÚÜÑ]+$/giu, '');
}

export function tokensToPhrase(tokens: SpanishToken[], startIdx: number, endIdx: number): string {
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  return tokens
    .filter((t) => t.type === 'word' && t.index >= lo && t.index <= hi)
    .map((t) => t.value)
    .join(' ');
}
