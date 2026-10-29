import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import { Platform } from 'react-native';

export const MIN_RECORDING_MS = 400;

let activeRecorder: AudioRecorder | null = null;
let recordingStartedAt = 0;

function getRecorder(): AudioRecorder {
  if (!activeRecorder) {
    activeRecorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  }
  return activeRecorder;
}

export async function prepareAudioForRecording(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'duckOthers',
  });
}

export async function startVoiceRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Voice recording is not supported on web.');
  }

  const recorder = getRecorder();
  if (recorder.isRecording) {
    try {
      await recorder.stop();
    } catch {
      // Ignore stale recording cleanup errors.
    }
  }

  await prepareAudioForRecording();
  await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
  recorder.record();
  recordingStartedAt = Date.now();
}

export async function stopVoiceRecording(): Promise<{
  uri: string | null;
  durationMs: number;
}> {
  const recorder = activeRecorder;
  if (!recorder || (!recorder.isRecording && recordingStartedAt === 0)) {
    return { uri: null, durationMs: 0 };
  }

  const durationMs = Math.max(0, Date.now() - recordingStartedAt);
  recordingStartedAt = 0;

  let uri: string | null = recorder.uri ?? null;
  try {
    await recorder.stop();
  } catch (error) {
    console.log('[Habla] recorder.stop failed:', error);
  }

  uri = recorder.uri ?? uri;
  return { uri, durationMs };
}

/** Best-effort mic teardown — never throws. Call before leaving lesson / switching to TTS. */
export async function ensureRecordingStopped(): Promise<void> {
  try {
    await stopVoiceRecording();
  } catch (error) {
    console.log('[Habla] ensureRecordingStopped failed:', error);
    recordingStartedAt = 0;
  }
}

export function isRecordingActive(): boolean {
  return recordingStartedAt > 0 || (activeRecorder?.isRecording ?? false);
}
