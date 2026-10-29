export type GameMode = 'slot' | 'swap' | 'tiles';

export type GameRound = {
  id: string;
  mode: GameMode;
  /** Instruction text shown above the round, e.g. "Complete the sentence" */
  prompt: string;
  /** Slot/swap sentence with a `{{blank}}` marker for the changeable part. */
  sentenceTemplate?: string;
  /** Choices for slot/swap modes. */
  options?: string[];
  /**
   * Slot/swap: the correct option value.
   * Tiles: the correct order joined as a string (space-separated).
   */
  correctAnswer: string;
  /** Scrambled tiles, tiles mode only. */
  tiles?: string[];
  /** Optional English meaning / hint shown under the prompt. */
  hint?: string;
};

export type GameSequence = {
  rounds: GameRound[];
};

export type SentenceGameProps = {
  sequence: GameSequence;
  onComplete: () => void;
};

/** Placeholder in `sentenceTemplate` for the changeable part. */
export const BLANK_MARKER = '{{blank}}';

/** Pause after feedback before advancing to the next round. */
export const ADVANCE_DELAY_MS = 1000;
