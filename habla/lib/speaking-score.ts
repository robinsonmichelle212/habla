export function computeSpeakingCombinedScore(metrics: {
  fluencyScore: number;
  confidenceScore: number;
  vocabularyRangeScore: number;
  naturalFlowScore: number;
}): number {
  const scores = [
    metrics.fluencyScore,
    metrics.confidenceScore,
    metrics.vocabularyRangeScore,
    metrics.naturalFlowScore,
  ].map((s) => Math.max(0, Math.min(100, Math.round(s))));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function speakingPhaseSummaryLabel(
  combinedScore: number | null,
  exchangeCount: number,
  pending = false,
): string {
  if (pending) {
    return `Speaking saved — ${exchangeCount} exchange${exchangeCount === 1 ? '' : 's'} pending evaluation ⏳`;
  }
  return `Fluency ${Math.round(combinedScore ?? 0)}% · ${exchangeCount} exchange${exchangeCount === 1 ? '' : 's'}`;
}
