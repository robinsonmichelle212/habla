import { SummaryFallbackScreen } from '@/components/summary-fallback-screen';
import { getLastSummary } from '@/lib/last-summary-storage';
import { buildSafeSummaryPayload, normalizeSummaryAnalysis, type SafeSummaryPayload } from '@/lib/summary-safe-data';
import { resetLessonSession } from '@/lib/lesson-session';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  muted: '#8B95A5',
  text: '#F4F6F8',
};

export default function LastSummaryScreen() {
  const router = useRouter();
  const [payload, setPayload] = useState<SafeSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await getLastSummary();
        if (stored) {
          setPayload({
            ...stored,
            analysis: normalizeSummaryAnalysis(stored.analysis),
          });
        }
      } catch (err) {
        console.error('[Habla] getLastSummary failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    resetLessonSession();
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator color="#FF7A59" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!payload) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No saved summary</Text>
          <Text style={styles.emptyText}>Complete a lesson to see your summary here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SummaryFallbackScreen
      payload={payload}
      onGoHome={goHome}
      showLaterNote={false}
      title="Your last lesson summary"
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
