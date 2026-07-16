import { useMilestoneCelebration } from '@/contexts/milestone-context';
import { logCrashBreadcrumb } from '@/lib/crash-breadcrumb';
import { stopJaviSpeechAsync } from '@/lib/javi-speech';
import { clearLessonSessionMemory, getLessonSession } from '@/lib/lesson-session';
import { persistLessonComplete } from '@/lib/persist-lesson-complete';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

const palette = {
  background: '#0B0F14',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
};

/**
 * Intermediate screen: cancel audio/timers, save ALL progress, then open display-only summary.
 * Keeps crash-prone AsyncStorage / API work off the summary UI.
 */
export default function LessonCompleteScreen() {
  const router = useRouter();
  const { celebrate } = useMilestoneCelebration();
  const startedRef = useRef(false);
  const [status, setStatus] = useState('¡Bien hecho! Saving your progress... 💾');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    void (async () => {
      try {
        // Cancel TTS / pending audio before any navigation work.
        try {
          Speech.stop();
        } catch {
          // ignore
        }
        await stopJaviSpeechAsync();
        await new Promise<void>((resolve) => {
          const id = setTimeout(resolve, 500);
          timers.push(id);
        });

        if (cancelled) return;

        const result = await persistLessonComplete(getLessonSession());
        if (cancelled) return;

        if (result.celebrations.length > 0) {
          try {
            celebrate(result.celebrations);
          } catch (celeErr) {
            console.error('[Habla] celebrate on lesson-complete failed:', celeErr);
          }
        }

        await logCrashBreadcrumb('navigation_started');
        clearLessonSessionMemory();

        router.replace({
          pathname: '/summary',
          params: result.routeParams,
        } as Href);
      } catch (err) {
        console.error('[Habla] lesson-complete persist failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not save progress.');
          setStatus('Opening summary with available data…');
          await logCrashBreadcrumb('navigation_started');
          clearLessonSessionMemory();
          router.replace({
            pathname: '/summary',
            params: {
              overallScore: '0',
              scorePending: '1',
              strongAreas: JSON.stringify(['Lesson completed']),
              weakAreas: JSON.stringify(['Progress may be incomplete — check Progress tab']),
              focusAreas: JSON.stringify(['Try another lesson']),
              xpEarned: '50',
              gemsEarned: '2',
              grammarData: '{}',
              vocabularyData: '{}',
              fluencyData: '{}',
              writingData: '{}',
              challenge: '',
              lessonType: 'Lesson',
              encouragingMessage: '¡Bien hecho!',
            },
          } as Href);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
      try {
        Speech.stop();
      } catch {
        // ignore
      }
    };
  }, [celebrate, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.title}>¡Bien hecho!</Text>
        <ActivityIndicator color={palette.accent} size="large" style={styles.spinner} />
        <Text style={styles.status}>{status}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
  },
  spinner: { marginVertical: 16 },
  status: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
    textAlign: 'center',
    marginTop: 8,
  },
});
