import { isDemoModeEnabled, setDemoModeEnabled } from '@/lib/onboarding-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type DemoModeContextValue = {
  enabled: boolean;
  hydrated: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

const DemoModeContext = createContext<DemoModeContextValue>({
  enabled: false,
  hydrated: false,
  setEnabled: async () => {},
  refresh: async () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const on = await isDemoModeEnabled();
    setEnabledState(on);
    setHydrated(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(async (value: boolean) => {
    await setDemoModeEnabled(value);
    setEnabledState(value);
  }, []);

  const value = useMemo(
    () => ({ enabled, hydrated, setEnabled, refresh }),
    [enabled, hydrated, setEnabled, refresh],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
