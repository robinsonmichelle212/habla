import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { monthNameOnly, previousMonthKey, wrapDisplayMonthKey } from '@/lib/wrapped-data';

const WRAPPED_NOTIFICATION_ID = 'spanish-wrapped-monthly';

export async function scheduleWrappedMonthlyNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(WRAPPED_NOTIFICATION_ID);
  } catch {
    // no-op
  }

  await Notifications.scheduleNotificationAsync({
    identifier: WRAPPED_NOTIFICATION_ID,
    content: {
      title: '🎉 Your Spanish Wrapped is ready!',
      body: 'Tap to see your monthly progress recap.',
      data: { type: 'wrapped' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: 9,
      minute: 0,
    },
  });
}

export async function notifyWrappedReadyNow(dataMonthKey?: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const dataKey = dataMonthKey ?? previousMonthKey();
  const displayKey = wrapDisplayMonthKey(dataKey);
  const titleMonth = monthNameOnly(displayKey);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 Your ${titleMonth} Wrapped is ready!`,
      body: 'See your lessons, streak, and improvement.',
      data: { type: 'wrapped', monthKey: dataKey },
    },
    trigger: null,
  });
}
