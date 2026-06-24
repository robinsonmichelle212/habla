import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

const JAVI_SPEECH_OPTIONS: Speech.SpeechOptions = {
  language: 'es-ES',
  pitch: 0.95,
  rate: 0.85,
};

let speakingPromise: Promise<void> | null = null;

export async function prepareAudioForPlayback(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

export function stopJaviSpeech(): void {
  Speech.stop();
  speakingPromise = null;
}

export async function speakJavi(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  stopJaviSpeech();
  await prepareAudioForPlayback();

  speakingPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      speakingPromise = null;
      resolve();
    };

    Speech.speak(trimmed, {
      ...JAVI_SPEECH_OPTIONS,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });

  return speakingPromise;
}

export async function isJaviSpeaking(): Promise<boolean> {
  try {
    return Speech.isSpeakingAsync();
  } catch {
    return speakingPromise != null;
  }
}
