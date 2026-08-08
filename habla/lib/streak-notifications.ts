import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatLocalDate, getStreakState } from '@/lib/streak';

const PERMISSION_ASKED_KEY = 'habla.notificationPermissionAsked';
const PERMISSION_STATUS_KEY = 'habla.notificationPermissionStatus';
const REMINDER_ID = 'streak-daily-reminder';
/** Canonical preference key (user-facing). */
const PREFERRED_TIME_KEY = 'preferredNotificationTime';
/** Legacy key — migrated on read. */
const LEGACY_REMINDER_TIME_KEY = 'habla.reminderTime';

const DEFAULT_REMINDER_HOUR = 12;
const DEFAULT_REMINDER_MINUTE = 0;

export type ReminderTime = { hour: number; minute: number };

export type NotificationTimeOption = ReminderTime & {
  id: '8am' | '12pm' | '4pm' | '9pm';
  timeLabel: string;
  spanishLabel: string;
  emoji: string;
  description: string;
  title: string;
  body: string;
};

export const NOTIFICATION_TIME_OPTIONS: NotificationTimeOption[] = [
  {
    id: '8am',
    hour: 8,
    minute: 0,
    timeLabel: '8:00am',
    spanishLabel: 'Mañana',
    emoji: '☀️',
    description: 'Start your day with Spanish',
    title: '¡Buenos días! 🌅',
    body: 'Empieza el día con Javi. Tu racha te espera.',
  },
  {
    id: '12pm',
    hour: 12,
    minute: 0,
    timeLabel: '12:00pm',
    spanishLabel: 'Mediodía',
    emoji: '🌤️',
    description: 'Perfect lunchtime session',
    title: '¡Es la hora de Javi! 🌤️',
    body: 'Pausa perfecta para practicar español. 15 minutos y sigues con tu día.',
  },
  {
    id: '4pm',
    hour: 16,
    minute: 0,
    timeLabel: '4:00pm',
    spanishLabel: 'Tarde',
    emoji: '🌅',
    description: 'Afternoon practice',
    title: '¡Buenas tardes! 🌅',
    body: 'Una sesión antes de que termine el día. Javi está listo.',
  },
  {
    id: '9pm',
    hour: 21,
    minute: 0,
    timeLabel: '9:00pm',
    spanishLabel: 'Noche',
    emoji: '🌙',
    description: 'End your day in Spanish',
    title: '¡Última llamada! 🌙',
    body: 'No pierdas tu racha. 5 minutos con Javi antes de dormir.',
  },
];

function isAllowedReminderTime(time: ReminderTime): boolean {
  return NOTIFICATION_TIME_OPTIONS.some(
    (opt) => opt.hour === time.hour && opt.minute === time.minute,
  );
}

export function getNotificationOptionForTime(time: ReminderTime): NotificationTimeOption {
  return (
    NOTIFICATION_TIME_OPTIONS.find(
      (opt) => opt.hour === time.hour && opt.minute === time.minute,
    ) ?? NOTIFICATION_TIME_OPTIONS.find((opt) => opt.hour === DEFAULT_REMINDER_HOUR)!
  );
}

function parseReminderRaw(raw: string | null): ReminderTime | null {
  if (!raw) return null;
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
  return null;
}

/**
 * Resolve preferred notification time.
 * Default is 12pm. Legacy evening times (6–8pm) that are no longer options
 * migrate to 12pm. 9pm remains valid.
 */
export async function getReminderTime(): Promise<ReminderTime> {
  const preferred = parseReminderRaw(await AsyncStorage.getItem(PREFERRED_TIME_KEY));
  if (preferred && isAllowedReminderTime(preferred)) {
    return preferred;
  }

  const legacy = parseReminderRaw(await AsyncStorage.getItem(LEGACY_REMINDER_TIME_KEY));
  if (legacy && isAllowedReminderTime(legacy)) {
    await AsyncStorage.setItem(PREFERRED_TIME_KEY, JSON.stringify(legacy));
    return legacy;
  }

  const fallback = { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  await AsyncStorage.setItem(PREFERRED_TIME_KEY, JSON.stringify(fallback));
  return fallback;
}

export async function setReminderTime(hour: number, minute: number): Promise<void> {
  const match = NOTIFICATION_TIME_OPTIONS.find(
    (opt) => opt.hour === Math.trunc(hour) && opt.minute === Math.trunc(minute),
  );
  const next = match
    ? { hour: match.hour, minute: match.minute }
    : { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };

  await AsyncStorage.setItem(PREFERRED_TIME_KEY, JSON.stringify(next));
  await AsyncStorage.setItem(LEGACY_REMINDER_TIME_KEY, JSON.stringify(next));
  await syncStreakReminder();
}

export function formatReminderTimeLabel(time: ReminderTime): string {
  const opt = NOTIFICATION_TIME_OPTIONS.find(
    (o) => o.hour === time.hour && o.minute === time.minute,
  );
  if (opt) return opt.timeLabel;
  const h = time.hour % 12 || 12;
  const suffix = time.hour >= 12 ? 'pm' : 'am';
  const m = time.minute.toString().padStart(2, '0');
  return `${h}:${m}${suffix}`;
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

function fireOnDate(base: Date, time: ReminderTime): Date {
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
    return fireOnDate(tomorrow, time);
  }
  const now = new Date();
  const todayAt = fireOnDate(now, time);
  if (now < todayAt) {
    return todayAt;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return fireOnDate(tomorrow, time);
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
 * Cancel Habla streak reminder and reschedule at the preferred time
 * with the copy for that slot.
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
  const time = await getReminderTime();
  const copy = getNotificationOptionForTime(time);

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: copy.title,
      body: copy.body,
      data: { type: 'streak-reminder', preferredNotificationTime: time },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

/**
 * Ask for notification permission once on first app open, then schedule the daily reminder.
 * Migrates default/legacy times to 12pm when needed.
 */
export async function initStreakNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  // Ensure preferred time is migrated before scheduling.
  await getReminderTime();

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
