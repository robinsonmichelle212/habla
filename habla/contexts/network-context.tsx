import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { checkIsOnline, subscribeToNetworkStatus } from '@/lib/network-status';
import { processPendingAudioTasks } from '@/lib/pending-audio-sync';

type NetworkContextValue = {
  isOnline: boolean;
  hydrated: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  hydrated: false,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void checkIsOnline().then((online) => {
      if (!cancelled) {
        setIsOnline(online);
        setHydrated(true);
      }
    });

    void processPendingAudioTasks({ notify: true });

    const unsubscribe = subscribeToNetworkStatus((online) => {
      setIsOnline(online);
      if (online) {
        void processPendingAudioTasks({ notify: true });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, hydrated }}>{children}</NetworkContext.Provider>
  );
}

export function useNetworkStatus(): NetworkContextValue {
  return useContext(NetworkContext);
}
