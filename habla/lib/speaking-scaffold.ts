import type { LevelBandId } from '@/lib/level-progress';

/** Countdown seconds to memorise written response before speaking. */
export function scaffoldSecondsForBand(bandId: LevelBandId): number {
  switch (bandId) {
    case 'b1-beginner':
      return 15;
    case 'b1-developing':
      return 12;
    case 'b1-confident':
      return 10;
    case 'b1-strong':
      return 5;
    default:
      return 0;
  }
}

export function shouldShowSpeakingScaffold(bandId: LevelBandId): boolean {
  return scaffoldSecondsForBand(bandId) > 0;
}
