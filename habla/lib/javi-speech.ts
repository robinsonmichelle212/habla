import { cleanForSpeech } from '@/lib/clean-for-speech';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

const JAVI_VOICE_LANGUAGE = 'es-ES';
const JAVI_VOICE_PITCH = 0.9;
const JAVI_VOICE_RATE = 0.95;
const PREFERRED_VOICE_ID = 'es-ES-Standard-B';

const JAVI_SPEECH_BASE: Pick<Speech.SpeechOptions, 'language' | 'pitch' | 'rate'> = {
  language: JAVI_VOICE_LANGUAGE,
  pitch: JAVI_VOICE_PITCH,
  rate: JAVI_VOICE_RATE,
};

let speakingPromise: Promise<void> | null = null;
let cachedVoiceId: string | null | undefined;
let voiceResolvePromise: Promise<string | undefined> | null = null;

function normalizeLanguage(language: string): string {
  return language.toLowerCase().replace('_', '-');
}

function isEsEsVoice(voice: Speech.Voice): boolean {
  return normalizeLanguage(voice.language ?? '').includes('es-es');
}

function voicePreferenceScore(voice: Speech.Voice): number {
  const id = (voice.identifier ?? '').toLowerCase();
  const name = (voice.name ?? '').toLowerCase();

  if (id.includes('es-es-standard-b') || id.includes('es_es_standard_b')) return 1000;
  if (id === PREFERRED_VOICE_ID.toLowerCase()) return 1000;
  if (id.includes('standard-b') || id.endsWith('-b')) return 900;
  if (id.includes('-d') || id.endsWith('_d')) return 850;
  if (name.includes('male') || id.includes('male')) return 800;
  if (
    name.includes('jorge') ||
    name.includes('diego') ||
    name.includes('pablo') ||
    name.includes('carlos')
  ) {
    return 750;
  }
  if (isEsEsVoice(voice)) return 100;
  return 0;
}

async function resolveJaviVoiceId(): Promise<string | undefined> {
  if (cachedVoiceId !== undefined) {
    return cachedVoiceId ?? undefined;
  }

  if (!voiceResolvePromise) {
    voiceResolvePromise = (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const candidates = voices
          .filter(isEsEsVoice)
          .sort((a, b) => voicePreferenceScore(b) - voicePreferenceScore(a));

        const best = candidates[0];
        const resolved = best?.identifier;
        cachedVoiceId = resolved ?? null;
        if (resolved) {
          console.log('[Habla] Javi voice selected:', resolved, best?.name ?? '');
        } else {
          console.log('[Habla] No es-ES voice found — using system default with husky settings');
        }
        return resolved;
      } catch (err) {
        console.warn('[Habla] getAvailableVoicesAsync failed:', err);
        cachedVoiceId = null;
        return undefined;
      } finally {
        voiceResolvePromise = null;
      }
    })();
  }

  return voiceResolvePromise;
}

async function buildJaviSpeechOptions(): Promise<Speech.SpeechOptions> {
  const voice = await resolveJaviVoiceId();
  return {
    ...JAVI_SPEECH_BASE,
    ...(voice ? { voice } : {}),
  };
}

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
  const options = await buildJaviSpeechOptions();

  speakingPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      speakingPromise = null;
      resolve();
    };

    Speech.speak(cleaned, {
      ...options,
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

/** Preload the best available es-ES male voice on app start. */
export function preloadJaviVoice(): void {
  void resolveJaviVoiceId();
}
