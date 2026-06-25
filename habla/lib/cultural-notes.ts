import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatLocalDate } from '@/lib/streak';

const STORAGE_KEY = 'culturalNotes';

export type CulturalNote = {
  id: string;
  text: string;
  topic: string;
  textType: string;
  date: string;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getCulturalNotes(): Promise<CulturalNote[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n.text === 'string')
      .map((n) => ({
        id: String(n.id ?? newId()),
        text: String(n.text).trim(),
        topic: String(n.topic ?? '').trim(),
        textType: String(n.textType ?? '').trim(),
        date: String(n.date ?? formatLocalDate()),
      }));
  } catch {
    return [];
  }
}

export async function addCulturalNote(
  text: string,
  topic: string,
  textType: string,
): Promise<CulturalNote> {
  const note: CulturalNote = {
    id: newId(),
    text: text.trim(),
    topic: topic.trim(),
    textType: textType.trim(),
    date: formatLocalDate(),
  };
  const existing = await getCulturalNotes();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([note, ...existing].slice(0, 100)));
  return note;
}
