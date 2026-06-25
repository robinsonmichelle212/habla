import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatLocalDate, getStreakState } from '@/lib/streak';

const PERMISSION_ASKED_KEY = 'habla.notificationPermissionAsked';
const PERMISSION_STATUS_KEY = 'habla.notificationPermissionStatus';
const REMINDER_ID = 'streak-daily-reminder';
const REMINDER_TIME_KEY = 'habla.reminderTime';

const DEFAULT_REMINDER_HOUR = 20;
const DEFAULT_REMINDER_MINUTE = 0;

export type ReminderTime = { hour: number; minute: number };

export async function getReminderTime(): Promise<ReminderTime> {
  const raw = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  if (!raw) return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderTime>;
    const hour = Math.trunc(Number(parsed.hour));
    const minute = Math.trunc(Number(parsed.minute));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  } catch {
    // fall through
  }
  return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
}

export async function setReminderTime(hour: number, minute: number): Promise<void> {
  const safeHour = Math.max(0, Math.min(23, Math.trunc(hour)));
  const safeMinute = Math.max(0, Math.min(59, Math.trunc(minute)));
  await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify({ hour: safeHour, minute: safeMinute }));
  await syncStreakReminder();
}

export function formatReminderTimeLabel(time: ReminderTime): string {
  const h = time.hour % 12 || 12;
  const suffix = time.hour >= 12 ? 'PM' : 'AM';
  const m = time.minute.toString().padStart(2, '0');
  return `${h}:${m} ${suffix}`;
}

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

function eveningOnDate(base: Date, time: ReminderTime): Date {
  const d = new Date(base);
  d.setHours(time.hour, time.minute, 0, 0);
  return d;
}

/** Next reminder fire time: today at set time if not done; otherwise tomorrow. */
async function nextReminderDate(alreadyCompletedToday: boolean): Promise<Date> {
  const time = await getReminderTime();
  if (alreadyCompletedToday) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return eveningOnDate(tomorrow, time);
  }
  const now = new Date();
  const tonight = eveningOnDate(now, time);
  if (now < tonight) {
    return tonight;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return eveningOnDate(tomorrow, time);
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
  const triggerDate = await nextReminderDate(completedToday);

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
