import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { checkIsOnline, subscribeToNetworkStatus } from '@/lib/network-status';
import {
  getLastOnlineAt,
  runPendingSync,
  subscribeSyncStatus,
  touchLastOnlineAt,
} from '@/lib/sync-manager';

type NetworkContextValue = {
  isOnline: boolean;
  hydrated: boolean;
  lastOnlineAt: number | null;
  isSyncing: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  hydrated: false,
  lastOnlineAt: null,
  isSyncing: false,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubSync = subscribeSyncStatus(setIsSyncing);
    return unsubSync;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [online, last] = await Promise.all([checkIsOnline(), getLastOnlineAt()]);
      if (cancelled) return;
      setIsOnline(online);
      setLastOnlineAt(last);
      if (online) {
        await touchLastOnlineAt();
        setLastOnlineAt(Date.now());
      }
      setHydrated(true);
    })();

    void runPendingSync({ notify: true });

    const unsubscribe = subscribeToNetworkStatus((online) => {
      setIsOnline(online);
      if (online) {
        void touchLastOnlineAt().then(() => setLastOnlineAt(Date.now()));
        void runPendingSync({ notify: true });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, hydrated, lastOnlineAt, isSyncing }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus(): NetworkContextValue {
  return useContext(NetworkContext);
}
