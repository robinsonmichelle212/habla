import { useRouter, type Href } from 'expo-router';
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

const HOME_HREF = '/' as Href;

type CelebrateOptions = {
  onAllDismissed?: () => void;
};

type MilestoneContextValue = {
  celebrate: (items: MilestoneCelebration[], options?: CelebrateOptions) => void;
  isCelebrating: boolean;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

export function MilestoneProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queue, setQueue] = useState<MilestoneCelebration[]>([]);
  const [visible, setVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const onAllDismissedRef = useRef<(() => void) | undefined>(undefined);
  const queueRef = useRef<MilestoneCelebration[]>([]);
  const navigatingRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  queueRef.current = queue;

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const goHomeSafely = useCallback(() => {
    console.log('Navigating to home');
    try {
      router.replace(HOME_HREF);
    } catch (error) {
      console.log('Keep going error:', error);
      try {
        router.replace(HOME_HREF);
      } catch (retryError) {
        console.log('Keep going error:', retryError);
      }
    }
  }, [router]);

  const celebrate = useCallback((items: MilestoneCelebration[], options?: CelebrateOptions) => {
    if (!items.length) {
      options?.onAllDismissed?.();
      return;
    }
    clearDismissTimer();
    navigatingRef.current = false;
    setNavigating(false);
    onAllDismissedRef.current = options?.onAllDismissed;
    setQueue(items);
    setVisible(true);
  }, [clearDismissTimer]);

  const finishQueueAndGoHome = useCallback(() => {
    const cb = onAllDismissedRef.current;
    onAllDismissedRef.current = undefined;
    setQueue([]);
    try {
      cb?.();
    } catch (error) {
      console.log('Keep going error:', error);
    }
    goHomeSafely();
  }, [goHomeSafely]);

  const handleKeepGoing = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setNavigating(true);
    console.log('Keep Going tapped');

    try {
      // Always dismiss/close the modal state before navigating.
      setVisible(false);

      clearDismissTimer();
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        try {
          const remaining = queueRef.current.slice(1);
          if (remaining.length === 0) {
            finishQueueAndGoHome();
            return;
          }

          // More celebrations queued — remount next modal cleanly.
          setQueue(remaining);
          setVisible(true);
          navigatingRef.current = false;
          setNavigating(false);
        } catch (error) {
          console.log('Keep going error:', error);
          finishQueueAndGoHome();
        }
      }, 100);
    } catch (error) {
      console.log('Keep going error:', error);
      finishQueueAndGoHome();
    }
  }, [clearDismissTimer, finishQueueAndGoHome]);

  const value = useMemo(
    () => ({
      celebrate,
      isCelebrating: visible && queue.length > 0,
    }),
    [celebrate, visible, queue.length],
  );

  const current = queue[0] ?? null;

  return (
    <MilestoneContext.Provider value={value}>
      {children}
      <MilestoneCelebrationModal
        visible={visible && current != null}
        celebration={current}
        navigating={navigating}
        onDismiss={handleKeepGoing}
        onRecoveryHome={goHomeSafely}
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
