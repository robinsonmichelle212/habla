import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const MIC_PERMISSION_KEY = 'micPermissionStatus';

export type MicPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getStoredMicPermissionStatus(): Promise<MicPermissionStatus | null> {
  const raw = await AsyncStorage.getItem(MIC_PERMISSION_KEY);
  if (raw === 'granted' || raw === 'denied' || raw === 'undetermined') {
    return raw;
  }
  return null;
}

async function storeMicPermissionStatus(status: MicPermissionStatus): Promise<void> {
  await AsyncStorage.setItem(MIC_PERMISSION_KEY, status);
}

export async function ensureMicPermission(): Promise<{
  granted: boolean;
  status: MicPermissionStatus;
}> {
  if (Platform.OS === 'web') {
    return { granted: false, status: 'denied' };
  }

  const current = await Audio.getPermissionsAsync();
  if (current.granted) {
    await storeMicPermissionStatus('granted');
    return { granted: true, status: 'granted' };
  }

  if (current.status === 'denied' && !current.canAskAgain) {
    await storeMicPermissionStatus('denied');
    return { granted: false, status: 'denied' };
  }

  const requested = await Audio.requestPermissionsAsync();
  const status: MicPermissionStatus = requested.granted
    ? 'granted'
    : requested.status === 'denied'
      ? 'denied'
      : 'undetermined';

  await storeMicPermissionStatus(status);
  return { granted: requested.granted, status };
}

export const MIC_DENIED_MESSAGE =
  'Microphone access is needed to speak with Javi. Enable it in your device settings to use voice mode.';
