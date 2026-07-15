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
    recordingStartedAt = 0;
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

  const recording = activeRecording;
  const durationMs = Math.max(0, Date.now() - recordingStartedAt);
  // Clear the global before unload so concurrent callers never touch a half-dead recorder.
  activeRecording = null;
  recordingStartedAt = 0;

  let uri: string | null = null;
  try {
    uri = recording.getURI();
  } catch {
    uri = null;
  }

  try {
    await recording.stopAndUnloadAsync();
  } catch (error) {
    console.log('[Habla] stopAndUnloadAsync failed:', error);
  }

  try {
    // Prefer post-unload URI when available; fall back to pre-unload.
    uri = recording.getURI() ?? uri;
  } catch {
    // keep prior uri
  }

  return { uri, durationMs };
}

/** Best-effort mic teardown — never throws. Call before leaving lesson / switching to TTS. */
export async function ensureRecordingStopped(): Promise<void> {
  try {
    await stopVoiceRecording();
  } catch (error) {
    console.log('[Habla] ensureRecordingStopped failed:', error);
    activeRecording = null;
    recordingStartedAt = 0;
  }
}

export function isRecordingActive(): boolean {
  return activeRecording != null;
}
