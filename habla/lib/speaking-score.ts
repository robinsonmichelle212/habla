export function computeCombinedSpeakingScore(
  attempt1Score: number,
  attempt2Score: number | null,
): { combinedScore: number; improved: boolean } {
  const a1 = Math.max(0, Math.min(100, Math.round(attempt1Score)));
  if (attempt2Score == null) {
    return { combinedScore: a1, improved: false };
  }

  const a2 = Math.max(0, Math.min(100, Math.round(attempt2Score)));
  const improved = a2 > a1;
  let combined = Math.round(a1 * 0.4 + a2 * 0.6);
  if (improved) {
    combined = Math.min(100, combined + 5);
  }
  return { combinedScore: combined, improved };
}

export function speakingPhaseSummaryLabel(
  attempt1Score: number,
  attempt2Score: number | null,
  improved: boolean,
): string {
  const a1 = Math.round(attempt1Score);
  if (attempt2Score == null) {
    return `Attempt 1: ${a1}% · Skipped · Keep practising`;
  }
  const a2 = Math.round(attempt2Score);
  const trend = improved ? 'Improved' : attempt2Score >= attempt1Score ? 'Same' : 'Keep practising';
  return `Attempt 1: ${a1}% · Attempt 2: ${a2}% · ${trend}`;
}
