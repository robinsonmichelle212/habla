import type { BonusRoundId, RoundLevel } from '@/lib/gem-shop';

/** In-memory only — never written to AsyncStorage. Cleared when Gem Shop reopens or demo ends. */
const demoUnlocks = new Map<BonusRoundId, Set<RoundLevel>>();

export function addDemoUnlock(roundId: BonusRoundId, level: RoundLevel): void {
  const set = demoUnlocks.get(roundId) ?? new Set<RoundLevel>();
  set.add(level);
  demoUnlocks.set(roundId, set);
}

export function hasDemoUnlock(roundId: BonusRoundId, level: RoundLevel): boolean {
  return demoUnlocks.get(roundId)?.has(level) === true;
}

/** Active demo unlock level for a round (highest pending), if any. */
export function getDemoUnlockLevel(roundId: BonusRoundId): RoundLevel | null {
  const set = demoUnlocks.get(roundId);
  if (!set || set.size === 0) return null;
  return Math.max(...set) as RoundLevel;
}

export function clearDemoUnlocks(): void {
  demoUnlocks.clear();
}

export function hasAnyDemoUnlocks(): boolean {
  for (const set of demoUnlocks.values()) {
    if (set.size > 0) return true;
  }
  return false;
}
