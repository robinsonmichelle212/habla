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
