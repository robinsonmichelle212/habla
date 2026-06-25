import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { MilestoneCelebrationModal } from '@/components/milestone-celebration-modal';
import type { MilestoneCelebration } from '@/lib/milestones';

type CelebrateOptions = {
  onAllDismissed?: () => void;
};

type MilestoneContextValue = {
  celebrate: (items: MilestoneCelebration[], options?: CelebrateOptions) => void;
  isCelebrating: boolean;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

export function MilestoneProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<MilestoneCelebration[]>([]);
  const [visible, setVisible] = useState(false);
  const onAllDismissedRef = useRef<(() => void) | undefined>(undefined);

  const current = queue[0] ?? null;

  const celebrate = useCallback((items: MilestoneCelebration[], options?: CelebrateOptions) => {
    if (!items.length) {
      options?.onAllDismissed?.();
      return;
    }
    onAllDismissedRef.current = options?.onAllDismissed;
    setQueue(items);
    setVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setVisible(false);
        const cb = onAllDismissedRef.current;
        onAllDismissedRef.current = undefined;
        cb?.();
      } else {
        setVisible(true);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      celebrate,
      isCelebrating: visible && queue.length > 0,
    }),
    [celebrate, visible, queue.length],
  );

  return (
    <MilestoneContext.Provider value={value}>
      {children}
      <MilestoneCelebrationModal
        visible={visible && current != null}
        celebration={current}
        onDismiss={handleDismiss}
      />
    </MilestoneContext.Provider>
  );
}

export function useMilestoneCelebration(): MilestoneContextValue {
  const ctx = useContext(MilestoneContext);
  if (!ctx) {
    throw new Error('useMilestoneCelebration must be used within MilestoneProvider');
  }
  return ctx;
}
