import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getRoundDef, type BonusRoundId, type RoundLevel } from '@/lib/gem-shop';

const EXPIRY_WARNING_MS = 2 * 60 * 60 * 1000;

export function unlockExpiryNotificationId(roundId: BonusRoundId, level: RoundLevel): string {
  return `gem-unlock-expiry-${roundId}-${level}`;
}

export async function scheduleUnlockExpiryWarning(
  roundId: BonusRoundId,
  level: RoundLevel,
  expiresAt: number,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const identifier = unlockExpiryNotificationId(roundId, level);
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // no-op
  }

  const warnAt = expiresAt - EXPIRY_WARNING_MS;
  if (warnAt <= Date.now()) return;

  const def = getRoundDef(roundId);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `⏰ Your ${def.name} round expires in 2 hours — don't waste your gems!`,
      body: 'Play now before your unlock expires.',
      data: { type: 'gem-unlock-expiry', roundId, level: String(level) },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(warnAt),
    },
  });
}

export async function cancelUnlockExpiryWarning(
  roundId: BonusRoundId,
  level: RoundLevel,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(unlockExpiryNotificationId(roundId, level));
  } catch {
    // no-op
  }
}
