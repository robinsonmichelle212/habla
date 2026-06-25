import AsyncStorage from '@react-native-async-storage/async-storage';

const BADGES_KEY = 'profileBadges';

export type ProfileBadge = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export async function getProfileBadges(): Promise<ProfileBadge[]> {
  const raw = await AsyncStorage.getItem(BADGES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProfileBadge[]) : [];
  } catch {
    return [];
  }
}

export async function awardBadge(id: string, label: string, emoji: string): Promise<boolean> {
  const badges = await getProfileBadges();
  if (badges.some((b) => b.id === id)) return false;
  const next: ProfileBadge = {
    id,
    label,
    emoji,
    earnedAt: new Date().toISOString().slice(0, 10),
  };
  await AsyncStorage.setItem(BADGES_KEY, JSON.stringify([...badges, next]));
  return true;
}

export async function hasBadge(id: string): Promise<boolean> {
  const badges = await getProfileBadges();
  return badges.some((b) => b.id === id);
}
