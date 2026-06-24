import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export const MIN_RECORDING_MS = 400;

let activeRecording: Audio.Recording | null = null;
let recordingStartedAt = 0;

export async function prepareAudioForRecording(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

export async function startVoiceRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Voice recording is not supported on web.');
  }

  if (activeRecording) {
    try {
      await activeRecording.stopAndUnloadAsync();
    } catch {
      // Ignore stale recording cleanup errors.
    }
    activeRecording = null;
  }

  await prepareAudioForRecording();

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  activeRecording = recording;
  recordingStartedAt = Date.now();
}

export async function stopVoiceRecording(): Promise<{
  uri: string | null;
  durationMs: number;
}> {
  if (!activeRecording) {
    return { uri: null, durationMs: 0 };
  }

  const durationMs = Math.max(0, Date.now() - recordingStartedAt);

  try {
    await activeRecording.stopAndUnloadAsync();
  } finally {
    const uri = activeRecording.getURI();
    activeRecording = null;
    recordingStartedAt = 0;
    return { uri, durationMs };
  }
}

export function isRecordingActive(): boolean {
  return activeRecording != null;
}
