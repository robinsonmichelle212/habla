import ErrorBoundary from '@/components/ErrorBoundary';
import { SummaryScoreRing } from '@/components/summary-score-ring';
import { logCrashBreadcrumb } from '@/lib/crash-breadcrumb';
import {
  resolveSummaryDisplayFromParams,
  type SummaryDisplayPayload,
} from '@/lib/summary-display-store';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Prefer /(tabs) — bare '/' has exited the app on Android in the past. */
const HOME_HREF = '/(tabs)' as Href;

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.12)',
  amber: '#FBBF24',
  amberBg: 'rgba(251, 191, 36, 0.12)',
  blue: '#60A5FA',
  blueBg: 'rgba(96, 165, 250, 0.12)',
  gem: '#A78BFA',
};

function formatMetric(value: number | null | undefined, pending?: boolean): string {
  if (pending || value == null) return 'Pending ⏳';
  return `${Math.round(value)}%`;
}

/**
 * Display-only summary. All persistence happens on /lesson-complete BEFORE this screen.
 * No AsyncStorage, no API calls, no TTS, no save-on-exit.
 */
export default function SummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const data = useMemo(() => resolveSummaryDisplayFromParams(params), [params]);
  const fade = useRef(new Animated.Value(0)).current;
  const ringProgress = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;
  const animStarted = useRef(false);

  useEffect(() => {
    void logCrashBreadcrumb('summary_screen_mounted');
    console.log('Grammar data:', data.grammarData);
    console.log('Vocabulary data:', data.vocabularyData);
    console.log('Fluency data:', data.fluencyData);
    console.log('Writing data:', data.writingData);

    ringProgress.setValue(data.scorePending ? 0 : Math.max(0, Math.min(100, data.overallScore)));

    if (animStarted.current) return;
    animStarted.current = true;
    void logCrashBreadcrumb('summary_animation_started');
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) void logCrashBreadcrumb('summary_animation_complete');
    });
  }, [data, fade, ringProgress]);

  const goHome = useCallback(() => {
    void logCrashBreadcrumb('back_to_home_tapped');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    void logCrashBreadcrumb('navigation_started');
    router.replace(HOME_HREF);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        goHome();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [goHome]),
  );

  return (
    <ErrorBoundary onGoHome={goHome}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.gemTopBar}>
          <Text style={styles.gemTopEmoji}>💎</Text>
          <Text style={styles.gemTopCount}>{data.gemsEarned}</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 88) }]}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fade }}>
            <SummaryBody
              data={data}
              ringProgress={ringProgress}
              ringScale={ringScale}
              ringOpacity={ringOpacity}
            />
          </Animated.View>
        </ScrollView>

        <View style={[styles.stickyHomeFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={goHome}
            style={({ pressed }) => [styles.stickyHomeButton, pressed && styles.stickyHomeButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            <Text style={styles.stickyHomeButtonText}>Back to Home 🏠</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function SummaryBody({
  data,
  ringProgress,
  ringScale,
  ringOpacity,
}: {
  data: SummaryDisplayPayload;
  ringProgress: Animated.Value;
  ringScale: Animated.Value;
  ringOpacity: Animated.Value;
}) {
  return (
    <>
      {data.summaryNotice || data.isDemoSession ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {data.isDemoSession ? 'Demo session — scores are sample data.' : data.summaryNotice}
          </Text>
        </View>
      ) : null}

      <Text style={styles.pageTitle}>Lesson Complete</Text>
      <Text style={styles.pageSubtitle}>{data.lessonType} lesson wrapped</Text>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreLabel}>Overall lesson score</Text>
        <SummaryScoreRing
          score={data.scorePending ? 0 : data.overallScore}
          progress={ringProgress}
          scale={ringScale}
          opacity={ringOpacity}
          pending={data.scorePending}
        />
        <Text style={styles.scoreHint}>
          {data.scorePending
            ? 'Some scores are still being calculated'
            : 'accuracy in writing · fluency in speaking'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strong Areas ✅</Text>
        {data.strongAreas.map((t, idx) => (
          <View key={`s-${idx}`} style={[styles.item, styles.itemGreen]}>
            <Text style={[styles.itemText, styles.textGreen]}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weak Areas ⚠️</Text>
        {data.weakAreas.map((t, idx) => (
          <View key={`w-${idx}`} style={[styles.item, styles.itemAmber]}>
            <Text style={[styles.itemText, styles.textAmber]}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Focus Tomorrow 🎯</Text>
        {data.focusAreas.map((t, idx) => (
          <View key={`f-${idx}`} style={[styles.item, styles.itemBlue]}>
            <Text style={[styles.itemText, styles.textBlue]}>{t}</Text>
          </View>
        ))}
      </View>

      {data.gemsEarned > 0 ? (
        <View style={styles.gemsEarnedCard}>
          <Text style={styles.gemsEarnedEmoji}>💎</Text>
          <Text style={styles.gemsEarnedTitle}>Gems earned</Text>
          <Text style={styles.gemsEarnedValue}>+{data.gemsEarned} gems</Text>
        </View>
      ) : null}

      <View style={styles.challengeCard}>
        <Text style={styles.challengeIcon}>💡</Text>
        <Text style={styles.challengeTitle}>Your Spanish Challenge for Today</Text>
        <Text style={styles.challengeSubtitle}>Takes 30 seconds. Builds thinking in Spanish.</Text>
        <Text style={styles.challengeText}>
          {data.challenge ||
            'Take one thing from today\'s lesson and name it in Spanish before bed tonight.'}
        </Text>
      </View>

      {data.writing ? (
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Writing</Text>
          <Text style={styles.metricLine}>
            Grammar {formatMetric(data.writing.grammarScore, data.writing.pendingEvaluation)}
          </Text>
          <Text style={styles.metricLine}>
            Vocabulary {formatMetric(data.writing.vocabularyScore, data.writing.pendingEvaluation)}
          </Text>
          <Text style={styles.metricLine}>
            Fluency {formatMetric(data.writing.fluencyScore, data.writing.pendingEvaluation)}
          </Text>
        </View>
      ) : null}

      {data.speaking ? (
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Speaking</Text>
          <Text style={styles.metricLine}>
            Combined{' '}
            {formatMetric(
              data.speaking.combinedScore,
              data.speaking.pendingEvaluation || data.speaking.expired,
            )}
          </Text>
          {data.speaking.javiFeedback ? (
            <Text style={styles.feedback}>{data.speaking.javiFeedback}</Text>
          ) : null}
        </View>
      ) : null}

      {data.reading ? (
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Reading</Text>
          <Text style={styles.metricLine}>{data.reading.textType}</Text>
          <Text style={styles.metricLine}>{Math.round(data.reading.score)}%</Text>
        </View>
      ) : null}

      <Text style={styles.xpNote}>XP earned · {data.xpEarned}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  gemTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  gemTopEmoji: { fontSize: 18 },
  gemTopCount: { fontSize: 18, fontWeight: '900', color: palette.gem },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  stickyHomeFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(11, 15, 20, 0.94)',
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
  },
  stickyHomeButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stickyHomeButtonPressed: { backgroundColor: palette.accentPressed },
  stickyHomeButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B0F14',
  },
  banner: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    padding: 10,
    marginBottom: 12,
  },
  bannerText: { fontSize: 13, fontWeight: '700', color: palette.blue },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 18,
  },
  scoreSection: { alignItems: 'center', marginBottom: 20 },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  scoreHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 8,
  },
  item: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  itemGreen: { backgroundColor: palette.greenBg, borderColor: 'rgba(52, 211, 153, 0.35)' },
  itemAmber: { backgroundColor: palette.amberBg, borderColor: 'rgba(251, 191, 36, 0.35)' },
  itemBlue: { backgroundColor: palette.blueBg, borderColor: 'rgba(96, 165, 250, 0.35)' },
  itemText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  textGreen: { color: palette.green },
  textAmber: { color: palette.amber },
  textBlue: { color: palette.blue },
  gemsEarnedCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    padding: 14,
    marginBottom: 14,
  },
  gemsEarnedEmoji: { fontSize: 28, marginBottom: 4 },
  gemsEarnedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
  },
  gemsEarnedValue: { fontSize: 20, fontWeight: '900', color: palette.gem },
  challengeCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    marginBottom: 14,
  },
  challengeIcon: { fontSize: 22, marginBottom: 4 },
  challengeTitle: { fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 4 },
  challengeSubtitle: { fontSize: 12, fontWeight: '600', color: palette.muted, marginBottom: 8 },
  challengeText: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
  metricCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricLine: { fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 4 },
  feedback: { fontSize: 13, fontWeight: '600', color: palette.muted, marginTop: 6, lineHeight: 18 },
  xpNote: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
});
