import { progressPalette } from '@/components/progress/chart-theme';
import { LessonScoreBreakdownModal } from '@/components/lesson-score-breakdown';
import { CollapsibleProfileSection } from '@/components/collapsible-profile-section';
import { LevelBarometerSection } from '@/components/level-barometer-section';
import { LevelDetailModal } from '@/components/level-detail-modal';
import { getLevelBarometer, getNextLevelRequirements, type LevelBandId } from '@/lib/level-progress';
import {
  getBestDayThisWeek,
  getDrillHistory,
  getLessonHistory,
  getTodayScoreInfo,
  getTopScoreThisWeek,
  getWeekScoreChart,
  type DrillHistoryEntry,
  type LessonHistoryEntry,
  type TodayScoreInfo,
  type WeekChartDay,
} from '@/lib/practice-storage';
import { recoverUnregisteredSessions } from '@/lib/session-recovery';
import { hasLastSummary } from '@/lib/last-summary-storage';
import { buildWrappedTeaser, monthLabel } from '@/lib/wrapped-data';
import { getUnreadWrappedMonth, getWrappedHistory } from '@/lib/wrapped-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [drills, setDrills] = useState<Awaited<ReturnType<typeof getDrillHistory>>>([]);
  const [wrappedHistory, setWrappedHistory] = useState<Awaited<ReturnType<typeof getWrappedHistory>>>([]);
  const [unreadWrapped, setUnreadWrapped] = useState<string | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<LevelBandId | null>(null);
  const [todaysScoreInfo, setTodaysScoreInfo] = useState<TodayScoreInfo>({
    score: null,
    label: "Today's score",
    lessonEntry: null,
    drillEntry: null,
  });
  const [topScoreWeek, setTopScoreWeek] = useState<number | null>(null);
  const [bestWeekLessonEntry, setBestWeekLessonEntry] = useState<LessonHistoryEntry | null>(null);
  const [bestWeekDrillEntry, setBestWeekDrillEntry] = useState<DrillHistoryEntry | null>(null);
  const [weekChart, setWeekChart] = useState<WeekChartDay[]>([]);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const reopenWeekModalRef = useRef(false);
  const [levelExpanded, setLevelExpanded] = useState(false);
  const [showLastSummaryLink, setShowLastSummaryLink] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLevelExpanded(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (reopenWeekModalRef.current) {
        reopenWeekModalRef.current = false;
        setShowWeekModal(true);
      }
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          await recoverUnregisteredSessions();
          const [lessonHistory, drillHistory, wraps, unread, lastSummary] = await Promise.all([
            getLessonHistory(),
            getDrillHistory(),
            getWrappedHistory(),
            getUnreadWrappedMonth(),
            hasLastSummary(),
          ]);
          if (cancelled) return;
          setLessons(lessonHistory);
          setDrills(drillHistory);
          setWrappedHistory(wraps);
          setUnreadWrapped(unread);
          setShowLastSummaryLink(lastSummary);
          setTodaysScoreInfo(getTodayScoreInfo(lessonHistory, drillHistory));
          setTopScoreWeek(getTopScoreThisWeek(lessonHistory, drillHistory));
          const bestWeek = getBestDayThisWeek(lessonHistory, drillHistory);
          setBestWeekLessonEntry(bestWeek?.lessonEntry ?? null);
          setBestWeekDrillEntry(bestWeek?.drillEntry ?? null);
          setWeekChart(getWeekScoreChart(lessonHistory, drillHistory));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const barometer = useMemo(() => getLevelBarometer(lessons), [lessons]);
  const nextReq = useMemo(() => getNextLevelRequirements(lessons), [lessons]);
  const wrappedTeaser = useMemo(
    () => buildWrappedTeaser(lessons, drills, wrappedHistory.length),
    [lessons, drills, wrappedHistory.length],
  );
  const levelSummary = barometer
    ? `${barometer.band.label} — ${barometer.progressInBand}% through band`
    : 'Complete lessons to see your level';

  const openTodayBreakdown = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const [latestLessonHistory, latestDrillHistory] = await Promise.all([
      getLessonHistory(),
      getDrillHistory(),
    ]);
    setLessons(latestLessonHistory);
    setDrills(latestDrillHistory);
    setTodaysScoreInfo(getTodayScoreInfo(latestLessonHistory, latestDrillHistory));
    setShowTodayModal(true);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Progress 📈</Text>
        <Text style={styles.pageSubtitle}>Your level, scores, and monthly recap</Text>

        {showLastSummaryLink ? (
          <Pressable
            onPress={() => router.push('/last-summary' as Href)}
            style={({ pressed }) => [styles.lastSummaryLink, pressed && styles.lastSummaryPressed]}
            accessibilityRole="button"
            accessibilityLabel="View last summary">
            <Text style={styles.lastSummaryText}>View last summary →</Text>
          </Pressable>
        ) : null}

        {!loading ? (
          <View style={styles.scoreRow}>
            <ScoreCard
              label={todaysScoreInfo.label}
              value={todaysScoreInfo.score != null ? `${todaysScoreInfo.score}%` : '--'}
              onPress={
                todaysScoreInfo.score != null
                  ? () => void openTodayBreakdown()
                  : undefined
              }
            />
            <ScoreCard
              label="Top Score This Week"
              value={topScoreWeek != null ? `${topScoreWeek}%` : '--'}
              onPress={
                topScoreWeek != null
                  ? () => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setShowWeekModal(true);
                    }
                  : undefined
              }
            />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={progressPalette.accent} size="large" />
          </View>
        ) : (
          <>
            {unreadWrapped ? (
              <Pressable
                onPress={() => router.push({ pathname: '/wrapped', params: { month: unreadWrapped } })}
                style={styles.wrappedPromo}>
                <Text style={styles.wrappedPromoTitle}>Your Spanish Wrapped is ready 🎉</Text>
                <Text style={styles.wrappedPromoText}>Tap to open {monthLabel(unreadWrapped)}</Text>
              </Pressable>
            ) : null}

            {wrappedTeaser && wrappedHistory.length === 0 && !unreadWrapped ? (
              <View style={styles.wrappedTeaser}>
                <Text style={styles.wrappedTeaserTitle}>Your first Wrapped is coming</Text>
                <Text style={styles.wrappedTeaserText}>
                  {wrappedTeaser.hasActivity
                    ? `Ready on 1st ${wrappedTeaser.nextWrapLabel} — ${wrappedTeaser.daysUntil} days to go`
                    : 'Complete your first lesson to start building your monthly recap'}
                </Text>
              </View>
            ) : null}

            {wrappedHistory.length > 0 ? (
              <View style={styles.wrappedHistorySection}>
                <Text style={styles.wrappedHistoryTitle}>Spanish Wrapped</Text>
                {wrappedHistory.map((w) => (
                  <Pressable
                    key={w.monthKey}
                    onPress={() => router.push({ pathname: '/wrapped', params: { month: w.monthKey } })}
                    style={styles.wrappedHistoryRow}>
                    <Text style={styles.wrappedHistoryMonth}>{w.monthLabel}</Text>
                    <Text style={styles.wrappedHistoryMeta}>
                      {w.totalLessons} lessons · +{w.improvementPercent}% · {w.levelAtEnd}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {barometer ? (
              <CollapsibleProfileSection
                title="Level Progression"
                summary={levelSummary}
                expanded={levelExpanded}
                onToggle={() => setLevelExpanded((v) => !v)}>
                <LevelBarometerSection
                  barometer={barometer}
                  nextRequirements={nextReq}
                  history={lessons}
                  onSelectBand={setSelectedBandId}
                  embedded
                />
              </CollapsibleProfileSection>
            ) : null}
          </>
        )}
      </ScrollView>

      <LessonScoreBreakdownModal
        visible={showTodayModal}
        title="Today's Breakdown"
        entry={todaysScoreInfo.lessonEntry}
        drillEntry={todaysScoreInfo.drillEntry}
        displayScore={todaysScoreInfo.score}
        onClose={() => setShowTodayModal(false)}
        showPracticeButton
        enableScoreDetails
      />
      <LessonScoreBreakdownModal
        visible={showWeekModal}
        title="This Week's Best"
        entry={bestWeekLessonEntry}
        drillEntry={bestWeekDrillEntry}
        displayScore={topScoreWeek}
        onClose={() => setShowWeekModal(false)}
        weekChart={weekChart}
        showHistoryLink
        onOpenHistory={() => {
          reopenWeekModalRef.current = true;
          setShowWeekModal(false);
          router.push('/score-history' as Href);
        }}
      />

      {barometer ? (
        <LevelDetailModal
          visible={selectedBandId != null}
          bandId={selectedBandId}
          currentBandIndex={barometer.bandIndex}
          currentAverage={barometer.averageScore}
          history={lessons}
          nextRequirements={nextReq}
          onClose={() => setSelectedBandId(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ScoreCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Text style={styles.scoreValue}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.scoreCard}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.scoreCard, styles.scoreCardTappable, pressed && styles.scoreCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: progressPalette.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: progressPalette.muted,
    marginBottom: 16,
  },
  lastSummaryLink: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
  },
  lastSummaryPressed: { opacity: 0.75 },
  lastSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: progressPalette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
    gap: 4,
  },
  scoreCardTappable: { borderColor: 'rgba(255, 122, 89, 0.35)' },
  scoreCardPressed: { opacity: 0.9 },
  scoreValue: {
    fontSize: 28,
    fontWeight: '900',
    color: progressPalette.text,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  wrappedPromo: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    padding: 16,
    marginBottom: 14,
  },
  wrappedPromoTitle: { fontSize: 16, fontWeight: '900', color: '#A78BFA', marginBottom: 4 },
  wrappedPromoText: { fontSize: 14, fontWeight: '700', color: progressPalette.muted },
  wrappedTeaser: {
    backgroundColor: progressPalette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 16,
    marginBottom: 14,
  },
  wrappedTeaserTitle: { fontSize: 15, fontWeight: '900', color: progressPalette.text, marginBottom: 6 },
  wrappedTeaserText: { fontSize: 14, fontWeight: '600', color: progressPalette.muted, lineHeight: 20 },
  wrappedHistorySection: { marginBottom: 20, gap: 8 },
  wrappedHistoryTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: progressPalette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  wrappedHistoryRow: {
    backgroundColor: progressPalette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
    gap: 4,
  },
  wrappedHistoryMonth: { fontSize: 15, fontWeight: '900', color: progressPalette.text },
  wrappedHistoryMeta: { fontSize: 13, fontWeight: '600', color: progressPalette.muted },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
});
