import AsyncStorage from '@react-native-async-storage/async-storage';

import { setGrammarCurriculumStartWeek } from '@/lib/grammar-curriculum';
import { getTotalGems } from '@/lib/gems';
import { getLessonHistory } from '@/lib/practice-storage';
import { formatLocalDate, getStreakState } from '@/lib/streak';

export const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';
export const DEMO_MODE_KEY = 'habla.demoMode';
export const USER_NAME_KEY = 'userName';
export const DIALECT_PREFERENCE_KEY = 'dialectPreference';
export const SELF_ASSESSED_LEVEL_KEY = 'selfAssessedLevel';
export const CONFIRMED_LEVEL_KEY = 'confirmedLevel';
export const ASSESSMENT_DATE_KEY = 'assessmentDate';
export const KEY_STRENGTHS_KEY = 'keyStrengths';
export const KEY_WEAKNESSES_KEY = 'keyWeaknesses';
export const ASSESSMENT_SKIPPED_KEY = 'assessmentSkipped';

export type DialectPreference = 'spain' | 'latin-america' | 'both';

export type SelfAssessedLevel =
  | 'A1'
  | 'A2'
  | 'B1 Beginner'
  | 'B1 Confident'
  | 'B1 Strong';

export type ConfirmedLevel =
  | 'A1'
  | 'A2'
  | 'B1 Beginner'
  | 'B1 Developing'
  | 'B1 Confident'
  | 'B1 Strong'
  | 'B2 Emerging';

export type OnboardingProfile = {
  userName: string;
  dialectPreference: DialectPreference;
  selfAssessedLevel: SelfAssessedLevel;
  confirmedLevel: ConfirmedLevel;
  assessmentDate: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  grammarCurriculumStartWeek: number;
  assessmentSkipped: boolean;
};

export const SELF_ASSESSMENT_OPTIONS: {
  id: SelfAssessedLevel;
  emoji: string;
  title: string;
  subtitle: string;
}[] = [
  { id: 'A1', emoji: '🌱', title: 'Complete beginner', subtitle: 'I know very little or nothing' },
  { id: 'A2', emoji: '🌿', title: 'I know some basics', subtitle: 'I can say hello, count, name some things' },
  {
    id: 'B1 Beginner',
    emoji: '🌳',
    title: 'I can have simple conversations',
    subtitle: 'I can get by as a tourist, understand slow speech',
  },
  {
    id: 'B1 Confident',
    emoji: '🌲',
    title: "I'm fairly comfortable",
    subtitle: 'I can discuss familiar topics, understand most things',
  },
  {
    id: 'B1 Strong',
    emoji: '🏔️',
    title: "I'm confident but want to reach fluency",
    subtitle: 'I can hold conversations but make mistakes',
  },
];

export const DIALECT_OPTIONS: {
  id: DialectPreference;
  emoji: string;
  title: string;
  subtitle: string;
  compact?: boolean;
}[] = [
  {
    id: 'spain',
    emoji: '🇪🇸',
    title: 'Spain Spanish (Castilian)',
    subtitle: 'Vosotros, European vocabulary, céntral/peninsular accent',
  },
  {
    id: 'latin-america',
    emoji: '🌎',
    title: 'Latin American Spanish',
    subtitle: 'Ustedes, wider Americas vocabulary, various regional accents',
  },
  {
    id: 'both',
    emoji: '',
    title: 'Both — show me the differences',
    subtitle: 'Learn Castilian as primary with Latin American notes',
    compact: true,
  },
];

export function grammarWeekForLevel(level: ConfirmedLevel | SelfAssessedLevel): number {
  const map: Record<string, number> = {
    A1: 1,
    A2: 2,
    'B1 Beginner': 3,
    'B1 Developing': 5,
    'B1 Confident': 8,
    'B1 Strong': 12,
    'B2 Emerging': 16,
  };
  return map[level] ?? 1;
}

export function dialectLabel(pref: DialectPreference): string {
  switch (pref) {
    case 'spain':
      return 'Spain Spanish (Castilian)';
    case 'latin-america':
      return 'Latin American Spanish';
    case 'both':
      return 'Castilian with Latin American notes';
  }
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
  return value === 'true';
}

function envDemoModeEnabled(): boolean {
  const raw = process.env.EXPO_PUBLIC_HABLA_DEMO_MODE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'owner';
}

/**
 * Demo mode for testing without AI lesson calls. Off by default; toggle in Profile settings.
 */
export async function isDemoModeEnabled(): Promise<boolean> {
  if (envDemoModeEnabled()) return true;
  return (await AsyncStorage.getItem(DEMO_MODE_KEY)) === 'true';
}

export async function setDemoModeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false');
}

/** True when the user already has saved progress (lost onboarding flag, dev reload, etc.). */
export async function hasExistingAppProgress(): Promise<boolean> {
  const [history, gems, streak] = await Promise.all([
    getLessonHistory(),
    getTotalGems(),
    getStreakState(),
  ]);
  return (
    history.length > 0 ||
    gems > 0 ||
    streak.currentStreak > 0 ||
    streak.longestStreak > 0
  );
}

/**
 * Whether to show onboarding. If progress exists but the flag was lost,
 * restores onboardingComplete without touching gems, streak, or curriculum.
 */
export async function shouldShowOnboarding(): Promise<boolean> {
  if (await isDemoModeEnabled()) {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    return false;
  }

  if (await isOnboardingComplete()) return false;

  if (await hasExistingAppProgress()) {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    return false;
  }

  return true;
}

export async function getUserName(): Promise<string | null> {
  const name = await AsyncStorage.getItem(USER_NAME_KEY);
  return name?.trim() || null;
}

export async function getOnboardingProfile(): Promise<OnboardingProfile | null> {
  const complete = await isOnboardingComplete();
  if (!complete) return null;

  const userName = await getUserName();
  const dialect = await AsyncStorage.getItem(DIALECT_PREFERENCE_KEY);
  const selfAssessed = await AsyncStorage.getItem(SELF_ASSESSED_LEVEL_KEY);
  const confirmed = await AsyncStorage.getItem(CONFIRMED_LEVEL_KEY);
  const assessmentDate = await AsyncStorage.getItem(ASSESSMENT_DATE_KEY);
  const skipped = await AsyncStorage.getItem(ASSESSMENT_SKIPPED_KEY);

  if (!userName || !dialect || !selfAssessed || !confirmed) return null;

  return {
    userName,
    dialectPreference: dialect as DialectPreference,
    selfAssessedLevel: selfAssessed as SelfAssessedLevel,
    confirmedLevel: confirmed as ConfirmedLevel,
    assessmentDate: assessmentDate ?? formatLocalDate(),
    keyStrengths: parseStringArray(await AsyncStorage.getItem(KEY_STRENGTHS_KEY)),
    keyWeaknesses: parseStringArray(await AsyncStorage.getItem(KEY_WEAKNESSES_KEY)),
    grammarCurriculumStartWeek: grammarWeekForLevel(confirmed as ConfirmedLevel),
    assessmentSkipped: skipped === 'true',
  };
}

export async function isAssessmentSkipped(): Promise<boolean> {
  return (await AsyncStorage.getItem(ASSESSMENT_SKIPPED_KEY)) === 'true';
}

export function timeBasedGreeting(name: string, now = new Date()): string {
  const hour = now.getHours();
  const trimmed = name.trim();
  if (hour < 12) return `Buenos días, ${trimmed}`;
  if (hour < 18) return `Buenas tardes, ${trimmed}`;
  return `Buenas noches, ${trimmed}`;
}

export type CompleteOnboardingOptions = {
  retake?: boolean;
  skipAssessment?: boolean;
};

export async function completeOnboarding(
  profile: OnboardingProfile,
  options: CompleteOnboardingOptions = {},
): Promise<void> {
  const week = Math.max(1, Math.min(20, profile.grammarCurriculumStartWeek));
  const [[, existingGemsRaw], [, existingStreakRaw], [, existingHistoryRaw]] =
    await AsyncStorage.multiGet(['totalGems', 'currentStreak', 'lessonHistory']);

  const existingGems = existingGemsRaw ? Number.parseInt(existingGemsRaw, 10) : 0;
  const existingStreak = existingStreakRaw ? Number.parseInt(existingStreakRaw, 10) : 0;
  let existingHistoryCount = 0;
  if (existingHistoryRaw) {
    try {
      const parsed = JSON.parse(existingHistoryRaw);
      existingHistoryCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      existingHistoryCount = 0;
    }
  }

  const hasExistingProgressData =
    (Number.isFinite(existingGems) && existingGems > 0) ||
    (Number.isFinite(existingStreak) && existingStreak > 0) ||
    existingHistoryCount > 0;

  const preserveProgress =
    options.retake || hasExistingProgressData || (await isDemoModeEnabled());

  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETE_KEY, 'true'],
    [USER_NAME_KEY, profile.userName.trim()],
    [DIALECT_PREFERENCE_KEY, profile.dialectPreference],
    [SELF_ASSESSED_LEVEL_KEY, profile.selfAssessedLevel],
    [CONFIRMED_LEVEL_KEY, profile.confirmedLevel],
    [ASSESSMENT_DATE_KEY, profile.assessmentDate],
    [KEY_STRENGTHS_KEY, JSON.stringify(profile.keyStrengths.slice(0, 2))],
    [KEY_WEAKNESSES_KEY, JSON.stringify(profile.keyWeaknesses.slice(0, 2))],
    [ASSESSMENT_SKIPPED_KEY, profile.assessmentSkipped ? 'true' : 'false'],
  ]);

  if (!preserveProgress) {
    // First install only: initialize these keys. Existing values are always preserved.
    if (!existingGemsRaw) {
      await AsyncStorage.setItem('totalGems', '0');
    }
    if (!existingStreakRaw) {
      await AsyncStorage.setItem('currentStreak', '0');
    }
    await setGrammarCurriculumStartWeek(week);
    return;
  }

  // Reassessment should still update curriculum start week without touching progress.
  if (options.retake) {
    await setGrammarCurriculumStartWeek(week);
  }
}

export async function buildSkippedAssessmentProfile(
  userName: string,
  dialectPreference: DialectPreference,
  selfAssessedLevel: SelfAssessedLevel,
): Promise<OnboardingProfile> {
  const confirmedLevel = selfAssessedLevel as ConfirmedLevel;
  return {
    userName: userName.trim(),
    dialectPreference,
    selfAssessedLevel,
    confirmedLevel,
    assessmentDate: formatLocalDate(),
    keyStrengths: [],
    keyWeaknesses: [],
    grammarCurriculumStartWeek: grammarWeekForLevel(confirmedLevel),
    assessmentSkipped: true,
  };
}
