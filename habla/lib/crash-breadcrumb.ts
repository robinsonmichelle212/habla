import AsyncStorage from '@react-native-async-storage/async-storage';

const CRASH_LOG_KEY = 'crashLog';
const MAX_ENTRIES = 50;

export type CrashBreadcrumb = {
  step: string;
  timestamp: string;
};

export async function logCrashBreadcrumb(step: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const log: CrashBreadcrumb[] = existing ? JSON.parse(existing) : [];
    log.push({ step, timestamp: new Date().toISOString() });
    while (log.length > MAX_ENTRIES) log.shift();
    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(log));
    console.log('[Habla][crashBreadcrumb]', step);
  } catch (err) {
    console.warn('[Habla] logCrashBreadcrumb failed:', err);
  }
}

export async function getCrashLog(): Promise<CrashBreadcrumb[]> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrashBreadcrumb[]) : [];
  } catch {
    return [];
  }
}

export async function clearCrashLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    // ignore
  }
}
