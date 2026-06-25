import { WrappedShareCard } from '@/components/wrapped/share-card';
import { progressPalette } from '@/components/progress/chart-theme';
import type { SpanishWrappedReport } from '@/lib/wrapped-data';
import { markWrappedSeen } from '@/lib/wrapped-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWrappedForMonth, loadOrGenerateWrapped } from '@/lib/wrapped-storage';
import { previousMonthKey } from '@/lib/wrapped-data';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SLIDE_HEIGHT = SCREEN_HEIGHT * 0.92;

function Slide({
  children,
  index,
  bg = progressPalette.background,
}: {
  children: React.ReactNode;
  index: number;
  bg?: string;
}) {
  return (
    <View style={[styles.slide, { height: SLIDE_HEIGHT, backgroundColor: bg }]}>
      <Animated.View entering={FadeInDown.delay(index * 80).duration(500)} style={styles.slideInner}>
        {children}
      </Animated.View>
    </View>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function MiniCalendar({ days }: { days: SpanishWrappedReport['calendarDays'] }) {
  return (
    <View style={styles.calendar}>
      {days.map((d) => (
        <View
          key={d.date}
          style={[styles.calendarDot, d.active ? styles.calendarActive : styles.calendarMissed]}
        />
      ))}
    </View>
  );
}

export default function WrappedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { month } = useLocalSearchParams<{ month?: string }>();
  const shareRef = useRef<View>(null);

  const [report, setReport] = useState<SpanishWrappedReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const monthKey = typeof month === 'string' && month ? month : previousMonthKey();

    void (async () => {
      try {
        let data = await getWrappedForMonth(monthKey);
        if (!data) {
          data = await loadOrGenerateWrapped(monthKey);
        }
        if (cancelled) return;
        setReport(data);
        if (data) await markWrappedSeen(data.monthKey);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [month]);

  const handleShare = useCallback(async () => {
    if (!shareRef.current || !report) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const [{ captureRef }, Sharing, MediaLibrary] = await Promise.all([
        import('react-native-view-shot'),
        import('expo-sharing'),
        import('expo-media-library'),
      ]);
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Spanish Wrapped' });
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('Saved!', 'Your Wrapped card was saved to your photos.');
      }
    } catch {
      Alert.alert('Could not share', 'Try again in a moment.');
    }
  }, [report]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={progressPalette.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Wrapped yet</Text>
          <Text style={styles.emptyText}>Complete lessons this month to unlock your recap.</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const activeSummary = `${report.totalDaysActive} days of Spanish. Here's what you achieved.`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <Pressable onPress={() => router.back()} style={styles.closeTop}>
        <Text style={styles.closeTopText}>✕</Text>
      </Pressable>

      <ScrollView
        pagingEnabled
        snapToInterval={SLIDE_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <Slide index={0} bg="#1a0f14">
          <Text style={styles.coverEmoji}>🇪🇸</Text>
          <Text style={styles.coverTitle}>Your Spanish Wrapped</Text>
          <Text style={styles.coverMonth}>{report.monthLabel}</Text>
          <Text style={styles.coverSub}>{activeSummary}</Text>
          <Text style={styles.logo}>Habla</Text>
        </Slide>

        <Slide index={1}>
          <Text style={styles.slideTitle}>The numbers</Text>
          <BigStat value={String(report.totalLessons)} label="lessons" />
          <BigStat value={String(report.totalDrills)} label="drills" />
          <BigStat
            value={report.estimatedHours >= 1 ? `${report.estimatedHours}h` : `${report.estimatedMinutes}m`}
            label="of Spanish"
          />
          <View style={styles.rowStats}>
            <BigStat value={String(report.gemsEarnedThisMonth)} label="gems earned" />
            <BigStat value={String(report.wordsSavedThisMonth)} label="words saved" />
          </View>
        </Slide>

        <Slide index={2} bg="#1a1208">
          <Text style={styles.flame}>🔥</Text>
          <Text style={styles.slideTitle}>Your streak</Text>
          <Text style={styles.heroLine}>Longest streak this month</Text>
          <Text style={styles.heroNumber}>{report.longestStreakThisMonth} days</Text>
          <Text style={styles.subLine}>Consistency: {report.streakConsistencyPercent}%</Text>
          <Text style={styles.calendarLabel}>Active days this month</Text>
          <MiniCalendar days={report.calendarDays} />
        </Slide>

        <Slide index={3} bg="#0f141a">
          <Text style={styles.slideTitle}>Your improvement</Text>
          <Text style={styles.bodyLine}>
            You started {report.monthLabel.split(' ')[0]} at {report.averageScoreStart}%.
          </Text>
          <Text style={styles.bodyLine}>You ended at {report.averageScoreEnd}%.</Text>
          <Text style={styles.improvement}>
            {report.improvementPercent > 0 ? `+${report.improvementPercent}%` : `${report.improvementPercent}%`}
          </Text>
          <Text style={styles.subLine}>
            Most improved: {report.mostImprovedSkill} · Best: {report.bestSkill}
          </Text>
        </Slide>

        <Slide index={4}>
          <Text style={styles.slideTitle}>Level journey</Text>
          <Text style={styles.bodyLine}>You were {report.levelAtStart} on the 1st.</Text>
          <Text style={styles.bodyLine}>You&apos;re now {report.levelAtEnd}.</Text>
          {report.levelledUp ? (
            <Text style={styles.levelUp}>🎉 You levelled up this month!</Text>
          ) : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${report.progressInBand}%` }]} />
          </View>
        </Slide>

        <Slide index={5} bg="#0f1a14">
          <Text style={styles.slideTitle}>Your vocabulary 📚</Text>
          <Text style={styles.bodyLine}>You saved {report.wordsSavedThisMonth} new words</Text>
          <Text style={styles.bodyLine}>You mastered {report.wordsMasteredThisMonth} words</Text>
          {report.recentlyMasteredWords.length ? (
            <View style={styles.wordList}>
              {report.recentlyMasteredWords.map((w) => (
                <Text key={w.spanish} style={styles.wordLine}>
                  ✓ {w.spanish} — {w.english}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.subLine}>{report.totalWordsInList} words in your list</Text>
        </Slide>

        <Slide index={6}>
          <Text style={styles.slideTitle}>Your patterns</Text>
          {report.mostPersistentError ? (
            <Text style={styles.patternLine}>
              Javi noticed you worked hardest on:{'\n'}
              <Text style={styles.patternHighlight}>{report.mostPersistentError}</Text>
            </Text>
          ) : null}
          {report.mostImprovedError ? (
            <Text style={styles.patternLine}>
              Biggest improvement:{'\n'}
              <Text style={styles.patternHighlight}>{report.mostImprovedError}</Text>
            </Text>
          ) : null}
          {report.stillWorkingOnError ? (
            <Text style={styles.patternLine}>
              Still working on:{'\n'}
              <Text style={styles.patternMuted}>{report.stillWorkingOnError}</Text>
            </Text>
          ) : null}
        </Slide>

        <Slide index={7} bg="#14101a">
          <Text style={styles.slideTitle}>Your favourite 🏆</Text>
          <Text style={styles.bodyLine}>Most used lesson: {report.favouriteLessonType}</Text>
          <Text style={styles.bodyLine}>Best lesson score: {report.highestLessonScore}%</Text>
          <Text style={styles.bodyLine}>Most productive day: {report.mostProductiveDayOfWeek}</Text>
          <Text style={styles.subLine}>
            {report.totalReadSessions} read · {report.totalStructureLessons} structure lessons
          </Text>
        </Slide>

        <Slide index={8}>
          <Text style={styles.slideTitle}>Javi says</Text>
          <Text style={styles.javiMessage}>{report.javiMessage}</Text>
        </Slide>

        <Slide index={9} bg="#1a0f14">
          <Text style={styles.slideTitle}>Share your progress</Text>
          <View style={styles.sharePreview}>
            <WrappedShareCard ref={shareRef} report={report} />
          </View>
          <Pressable onPress={() => void handleShare()} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share or save image 📤</Text>
          </Pressable>
        </Slide>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: progressPalette.background },
  closeTop: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(21, 27, 36, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTopText: { fontSize: 18, color: progressPalette.text, fontWeight: '700' },
  slide: {
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  slideInner: { gap: 14 },
  coverEmoji: { fontSize: 56, textAlign: 'center' },
  coverTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: progressPalette.text,
    textAlign: 'center',
  },
  coverMonth: {
    fontSize: 22,
    fontWeight: '800',
    color: progressPalette.accent,
    textAlign: 'center',
  },
  coverSub: {
    fontSize: 16,
    fontWeight: '600',
    color: progressPalette.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    color: progressPalette.muted,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 2,
  },
  slideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: progressPalette.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bigStat: { alignItems: 'center', marginVertical: 8 },
  bigStatValue: {
    fontSize: 56,
    fontWeight: '900',
    color: progressPalette.text,
  },
  bigStatLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: progressPalette.muted,
    textTransform: 'uppercase',
  },
  rowStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  flame: { fontSize: 64, textAlign: 'center' },
  heroLine: { fontSize: 18, fontWeight: '700', color: progressPalette.muted, textAlign: 'center' },
  heroNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: progressPalette.accent,
    textAlign: 'center',
  },
  subLine: { fontSize: 15, fontWeight: '600', color: progressPalette.muted, textAlign: 'center' },
  calendarLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: progressPalette.muted,
    textAlign: 'center',
    marginTop: 16,
    textTransform: 'uppercase',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    marginTop: 12,
    maxWidth: 320,
    alignSelf: 'center',
  },
  calendarDot: { width: 10, height: 10, borderRadius: 3 },
  calendarActive: { backgroundColor: progressPalette.accent },
  calendarMissed: { backgroundColor: progressPalette.surfaceBorder },
  bodyLine: { fontSize: 18, fontWeight: '700', color: progressPalette.text, lineHeight: 26 },
  improvement: {
    fontSize: 64,
    fontWeight: '900',
    color: '#34D399',
    textAlign: 'center',
    marginVertical: 12,
  },
  levelUp: {
    fontSize: 20,
    fontWeight: '900',
    color: progressPalette.accent,
    textAlign: 'center',
    marginVertical: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: progressPalette.surfaceBorder,
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: progressPalette.accent,
    borderRadius: 4,
  },
  wordList: { gap: 8, marginTop: 12 },
  wordLine: { fontSize: 16, fontWeight: '700', color: progressPalette.text },
  patternLine: { fontSize: 16, fontWeight: '600', color: progressPalette.text, lineHeight: 24 },
  patternHighlight: { fontWeight: '900', color: progressPalette.accent },
  patternMuted: { fontWeight: '800', color: progressPalette.muted },
  javiMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: progressPalette.text,
    lineHeight: 28,
  },
  sharePreview: { alignItems: 'center', marginVertical: 16 },
  shareButton: {
    backgroundColor: progressPalette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  shareButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: progressPalette.text },
  emptyText: { fontSize: 15, color: progressPalette.muted, textAlign: 'center' },
  closeBtn: {
    marginTop: 16,
    backgroundColor: progressPalette.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  closeBtnText: { fontWeight: '900', color: '#0B0F14' },
});
