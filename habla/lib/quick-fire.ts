import type { QuickFireQuestion } from '@/lib/claude';

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[¿?¡!.,;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

export function checkQuickFireAnswer(
  question: QuickFireQuestion,
  userAnswer: string,
): boolean {
  // Special-case drill types that need structured parsing instead of
  // single-string matching.
  if (question.type === 'sentence_stem') {
    const expectedEndings = question.expectedAnswer
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (expectedEndings.length !== 3) {
      // Fallback to generic matching if the generator didn't follow format.
    } else {
      const expectedNorm = expectedEndings.map(normalizeAnswer);
      const userEndings = userAnswer
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const userNorm = userEndings.map(normalizeAnswer).filter(Boolean);
      const matched = new Set<string>();
      for (const token of userNorm) {
        if (expectedNorm.includes(token)) matched.add(token);
      }

      // "Half marks" = 2 of 3 correct endings.
      return matched.size >= 2;
    }
  }

  if (question.type === 'substitution_drill') {
    const expectedParts = question.expectedAnswer
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (expectedParts.length >= 2) {
      const expected1 = normalizeAnswer(expectedParts[0]);
      const expected2 = normalizeAnswer(expectedParts[1]);

      const raw = userAnswer.trim();
      const userPartsComma = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const userPartsSlash =
        userPartsComma.length >= 2
          ? userPartsComma
          : raw
              .split('/')
              .map((s) => s.trim())
              .filter(Boolean);

      if (userPartsSlash.length >= 2) {
        const user1 = normalizeAnswer(userPartsSlash[0]);
        const user2 = normalizeAnswer(userPartsSlash[1]);
        if (!expected1 || !expected2 || !user1 || !user2) return false;
        // Full marks = both parts correct.
        return user1 === expected1 && user2 === expected2;
      }
    }
    // Fall through to generic matching when parsing fails.
  }

  const normalizedUser = normalizeAnswer(userAnswer);
  if (!normalizedUser) return false;

  const candidates = [question.expectedAnswer, ...(question.acceptableAnswers ?? [])]
    .map(normalizeAnswer)
    .filter(Boolean);

  return candidates.some(
    (candidate) =>
      normalizedUser === candidate ||
      normalizedUser.includes(candidate) ||
      candidate.includes(normalizedUser),
  );
}
