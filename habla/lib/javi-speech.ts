import { cleanForSpeech } from '@/lib/clean-for-speech';
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
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

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

    Speech.speak(cleaned, {
      ...JAVI_SPEECH_OPTIONS,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });

  return speakingPromise;
}

export async function speakEnglish(text: string): Promise<void> {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

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

    Speech.speak(cleaned, {
      language: 'en-GB',
      pitch: 1,
      rate: 0.92,
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
