import { LevelRoadmapSection } from '@/components/level-roadmap-section';
import type { LevelBandId, LevelBarometer, NextLevelRequirements } from '@/lib/level-progress';
import type { LessonHistoryEntry } from '@/lib/practice-storage';

type Props = {
  barometer: LevelBarometer;
  nextRequirements: NextLevelRequirements | null;
  history: LessonHistoryEntry[];
  onSelectBand: (id: LevelBandId) => void;
  hideTitle?: boolean;
  embedded?: boolean;
};

export function LevelBarometerSection({
  barometer,
  nextRequirements,
  history,
  onSelectBand,
  embedded = false,
}: Props) {
  return (
    <LevelRoadmapSection
      barometer={barometer}
      nextRequirements={nextRequirements}
      history={history}
      onSelectBand={onSelectBand}
      embedded={embedded}
    />
  );
}
