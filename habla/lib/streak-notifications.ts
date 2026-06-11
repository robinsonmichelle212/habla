import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatLocalDate, getStreakState } from '@/lib/streak';

const PERMISSION_ASKED_KEY = 'habla.notificationPermissionAsked';
const PERMISSION_STATUS_KEY = 'habla.notificationPermissionStatus';
const REMINDER_ID = 'streak-daily-reminder';

const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Streak reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function eveningToday(): Date {
  const d = new Date();
  d.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  return d;
}

function eveningTomorrow(): Date {
  const d = eveningToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Next 8pm fire time: tonight if before 8pm and not done; otherwise tomorrow 8pm. */
function nextReminderDate(alreadyCompletedToday: boolean): Date {
  if (alreadyCompletedToday) {
    return eveningTomorrow();
  }
  const now = new Date();
  const tonight = eveningToday();
  if (now < tonight) {
    return tonight;
  }
  return eveningTomorrow();
}

export async function cancelStreakReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // no-op
  }
}

/**
 * Keeps a single daily 8pm reminder in sync with today's session status.
 * If the user already completed a lesson or practice today, skip tonight and schedule tomorrow.
 */
export async function syncStreakReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await hasNotificationPermission())) return;

  await ensureAndroidChannel();
  await cancelStreakReminder();

  const today = formatLocalDate();
  const { lastSessionDate } = await getStreakState();
  const completedToday = lastSessionDate === today;
  const triggerDate = nextReminderDate(completedToday);

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "🔥 Don't break your streak!",
      body: 'Javi is waiting. 5 minutes keeps your streak alive.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

/**
 * Ask for notification permission once on first app open, then schedule the daily reminder.
 */
export async function initStreakNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (asked !== 'true') {
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    await AsyncStorage.setItem(PERMISSION_STATUS_KEY, status);
    if (status !== 'granted') return;
  } else if (!(await hasNotificationPermission())) {
    return;
  }

  await syncStreakReminder();
}
