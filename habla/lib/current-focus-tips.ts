import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonAnalysis } from '@/lib/lesson-session';
import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'currentFocusTips';

export type CurrentFocusTips = {
  tips: string[];
  grammarFocus: string;
  generatedDate: string;
  usedInDrill: boolean;
  usedInChallenge: boolean;
};

export function isFocusTipsExpired(tips: CurrentFocusTips): boolean {
  return tips.usedInDrill && tips.usedInChallenge;
}

function normalizeTips(raw: unknown): CurrentFocusTips | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<CurrentFocusTips>;
  const tips = Array.isArray(obj.tips)
    ? obj.tips.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const grammarFocus = typeof obj.grammarFocus === 'string' ? obj.grammarFocus.trim() : '';
  const generatedDate = typeof obj.generatedDate === 'string' ? obj.generatedDate : '';
  if (!tips.length || !grammarFocus || !generatedDate) return null;
  return {
    tips,
    grammarFocus,
    generatedDate,
    usedInDrill: obj.usedInDrill === true,
    usedInChallenge: obj.usedInChallenge === true,
  };
}

export async function getCurrentFocusTips(): Promise<CurrentFocusTips | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeTips(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function saveCurrentFocusTips(tips: CurrentFocusTips): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tips));
}

export async function getActiveFocusTipsForDrill(): Promise<CurrentFocusTips | null> {
  const tips = await getCurrentFocusTips();
  if (!tips || tips.usedInDrill || isFocusTipsExpired(tips)) return null;
  return tips;
}

export async function getActiveFocusTipsForChallenge(): Promise<CurrentFocusTips | null> {
  const tips = await getCurrentFocusTips();
  if (!tips || tips.usedInChallenge || isFocusTipsExpired(tips)) return null;
  return tips;
}

export async function markFocusTipsUsedInDrill(): Promise<void> {
  const tips = await getCurrentFocusTips();
  if (!tips || tips.usedInDrill) return;
  const updated = { ...tips, usedInDrill: true };
  if (isFocusTipsExpired(updated)) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await saveCurrentFocusTips(updated);
}

export async function markFocusTipsUsedInChallenge(): Promise<void> {
  const tips = await getCurrentFocusTips();
  if (!tips || tips.usedInChallenge) return;
  const updated = { ...tips, usedInChallenge: true };
  if (isFocusTipsExpired(updated)) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await saveCurrentFocusTips(updated);
}

export async function saveFocusTipsFromSummaryIfExpired(tips: CurrentFocusTips): Promise<void> {
  const existing = await getCurrentFocusTips();
  if (existing && !isFocusTipsExpired(existing)) return;
  await saveCurrentFocusTips(tips);
}

export function buildFocusTipsFromAnalysis(
  analysis: LessonAnalysis,
  options?: { grammarTopic?: string; lessonFocus?: string },
): CurrentFocusTips {
  const tips: string[] = [];

  for (const tip of analysis.breakdown?.fluency?.weeklyTips ?? []) {
    const t = tip.trim();
    if (t && !tips.includes(t)) tips.push(t);
  }

  for (const area of analysis.focusAreas ?? []) {
    const a = area.trim();
    if (!a) continue;
    const formatted = `Practice ${a} this week`;
    if (!tips.some((t) => t.toLowerCase().includes(a.toLowerCase()))) tips.push(formatted);
  }

  for (const weak of analysis.weakAreas ?? []) {
    const w = weak.trim();
    if (!w) continue;
    const formatted = `Focus on ${w}`;
    if (!tips.some((t) => t.toLowerCase().includes(w.toLowerCase().slice(0, 24)))) {
      tips.push(formatted);
    }
  }

  const grammarFocus =
    options?.grammarTopic?.trim() ||
    analysis.breakdown?.grammar?.topic?.trim() ||
    analysis.focusAreas?.[0]?.trim() ||
    options?.lessonFocus?.trim() ||
    'General grammar';

  if (tips.length === 0) {
    tips.push(`Work on ${grammarFocus} in your next practice session`);
  }

  return {
    tips: tips.slice(0, 5),
    grammarFocus,
    generatedDate: formatLocalDate(),
    usedInDrill: false,
    usedInChallenge: false,
  };
}

export function formatFocusTipsForDrillPrompt(tips: string[]): string {
  return tips.map((t) => `- ${t}`).join('\n');
}
