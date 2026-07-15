import { cleanForSpeech } from '@/lib/clean-for-speech';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

/** System-default es-ES voice — do not pass a `voice` id (invalid ids silently kill TTS). */
const JAVI_VOICE_SETTINGS: Speech.SpeechOptions = {
  language: 'es-ES',
  pitch: 0.9,
  rate: 0.95,
};

const ENGLISH_VOICE_SETTINGS: Speech.SpeechOptions = {
  language: 'en-GB',
  pitch: 1,
  rate: 0.92,
};

let speakingPromise: Promise<void> | null = null;
let ttsGate: Promise<void> = Promise.resolve();

export async function prepareAudioForPlayback(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.log('Speech error (audio mode):', error);
  }
}

/** Awaitable stop — serialize TTS teardown before mode changes / navigation. */
export async function stopJaviSpeechAsync(): Promise<void> {
  const run = async () => {
    try {
      Speech.stop();
    } catch (error) {
      console.log('Speech error (stop):', error);
    }
    if (speakingPromise) {
      try {
        await Promise.race([
          speakingPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 400)),
        ]);
      } catch {
        // ignore
      }
    }
    speakingPromise = null;
  };

  ttsGate = ttsGate.then(run, run);
  await ttsGate;
}

export function stopJaviSpeech(): void {
  void stopJaviSpeechAsync();
}

function speakWithOptions(cleaned: string, settings: Speech.SpeechOptions): Promise<void> {
  console.log('Speaking:', cleaned.substring(0, 50));

  speakingPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      speakingPromise = null;
      resolve();
    };

    try {
      Speech.speak(cleaned, {
        ...settings,
        onDone: finish,
        onStopped: finish,
        onError: (error) => {
          console.log('Speech error:', error);
          finish();
        },
      });
    } catch (error) {
      console.log('Speech error:', error);
      finish();
    }
  });

  return speakingPromise;
}

export async function speakJavi(text: string): Promise<void> {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  await stopJaviSpeechAsync();
  await prepareAudioForPlayback();
  return speakWithOptions(cleaned, JAVI_VOICE_SETTINGS);
}

export async function speakEnglish(text: string): Promise<void> {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  await stopJaviSpeechAsync();
  await prepareAudioForPlayback();
  return speakWithOptions(cleaned, ENGLISH_VOICE_SETTINGS);
}

export async function isJaviSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch (error) {
    console.log('Speech error (isSpeaking):', error);
    return speakingPromise != null;
  }
}

/** Kept for app bootstrap compatibility — voice ids are no longer preloaded. */
export function preloadJaviVoice(): void {
  // Intentionally empty: selecting a specific voice identifier can break TTS.
}
