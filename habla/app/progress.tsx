import { progressPalette } from '@/components/progress/chart-theme';
import { LessonScoreBreakdownModal } from '@/components/lesson-score-breakdown';
import { CollapsibleProfileSection } from '@/components/collapsible-profile-section';
import { LevelBarometerSection } from '@/components/level-barometer-section';
import { LevelDetailModal } from '@/components/level-detail-modal';
import { getNextLevelRequirements, resolveLevelBarometer, type LevelBandId, type LevelBarometer, type NextLevelRequirements } from '@/lib/level-progress';
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
import {
  getWeeklyLessonBalance,
  type WeeklyLessonBalance,
} from '@/lib/lesson-type-nudge';
import { getWeeklyActivitySummary, type WeeklyActivitySummary } from '@/lib/daily-activity';
import { buildWrappedTeaser, currentMonthKey, monthNameOnly, previousMonthKey, wrappedCardTitle } from '@/lib/wrapped-data';
import {
  generateCurrentWrappedNow,
  getMostRecentWrapped,
  getUnreadWrappedMonth,
  getWrappedHistory,
  isWrappedOverdue,
} from '@/lib/wrapped-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
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
  const [latestWrapped, setLatestWrapped] = useState<Awaited<ReturnType<typeof getMostRecentWrapped>>>(null);
  const [unreadWrapped, setUnreadWrapped] = useState<string | null>(null);
  const [wrappedOverdue, setWrappedOverdue] = useState(false);
  const [generatingWrapped, setGeneratingWrapped] = useState(false);
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
  const [weeklyBalance, setWeeklyBalance] = useState<WeeklyLessonBalance | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivitySummary | null>(null);
  const [barometer, setBarometer] = useState<LevelBarometer | null>(null);
  const [nextReq, setNextReq] = useState<NextLevelRequirements | null>(null);

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
          const [lessonHistory, drillHistory, wraps, unread, lastSummary, latest, overdue, balance, activity] =
            await Promise.all([
              getLessonHistory(),
              getDrillHistory(),
              getWrappedHistory(),
              getUnreadWrappedMonth(),
              hasLastSummary(),
              getMostRecentWrapped(),
              isWrappedOverdue(),
              getWeeklyLessonBalance(),
              getWeeklyActivitySummary(),
            ]);
          if (cancelled) return;
          setLessons(lessonHistory);
          setDrills(drillHistory);
          setWrappedHistory(wraps);
          setLatestWrapped(latest);
          setUnreadWrapped(unread);
          setWrappedOverdue(overdue);
          setShowLastSummaryLink(lastSummary);
          setWeeklyBalance(balance);
          setWeeklyActivity(activity);
          setTodaysScoreInfo(getTodayScoreInfo(lessonHistory, drillHistory));
          setTopScoreWeek(getTopScoreThisWeek(lessonHistory, drillHistory));
          const bestWeek = getBestDayThisWeek(lessonHistory, drillHistory);
          setBestWeekLessonEntry(bestWeek?.lessonEntry ?? null);
          setBestWeekDrillEntry(bestWeek?.drillEntry ?? null);
          setWeekChart(getWeekScoreChart(lessonHistory, drillHistory));
          const resolved = await resolveLevelBarometer(lessonHistory);
          if (cancelled) return;
          setBarometer(resolved);
          setNextReq(getNextLevelRequirements(lessonHistory, resolved));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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

        {!loading && weeklyBalance ? (
          <View style={styles.weeklyBalanceCard}>
            <Text style={styles.weeklyBalanceTitle}>This week</Text>
            {weeklyActivity ? (
              <Text style={styles.weeklyActivitySummary}>
                {weeklyActivity.fullLessons} full lesson
                {weeklyActivity.fullLessons === 1 ? '' : 's'} · {weeklyActivity.drills} drill
                {weeklyActivity.drills === 1 ? '' : 's'} · {weeklyActivity.streakSessions}{' '}
                streak session{weeklyActivity.streakSessions === 1 ? '' : 's'}
              </Text>
            ) : null}
            {(
              [
                ['Grammar', weeklyBalance.Grammar],
                ['Your Day', weeklyBalance['Your Day']],
                ['Structure', weeklyBalance.Structure],
                ['Read', weeklyBalance.Read],
              ] as const
            ).map(([label, count]) => {
              const total =
                weeklyBalance.Grammar +
                weeklyBalance['Your Day'] +
                weeklyBalance.Structure +
                weeklyBalance.Read;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <View key={label} style={styles.weeklyBalanceRow}>
                  <View style={styles.weeklyBalanceRowTop}>
                    <Text style={styles.weeklyBalanceLabel}>{label}</Text>
                    <Text style={styles.weeklyBalanceCount}>
                      {count} session{count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.weeklyBalanceTrack}>
                    <View style={[styles.weeklyBalanceFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
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
                <Text style={styles.wrappedPromoTitle}>
                  {latestWrapped ? wrappedCardTitle(latestWrapped) : 'Your Spanish Wrapped is ready 🎉'}
                </Text>
                <Text style={styles.wrappedPromoText}>Tap to open your monthly recap</Text>
              </Pressable>
            ) : null}

            {wrappedTeaser && !latestWrapped && !unreadWrapped ? (
              <View style={styles.wrappedTeaser}>
                <Text style={styles.wrappedTeaserTitle}>Your first Wrapped is coming</Text>
                <Text style={styles.wrappedTeaserText}>
                  {wrappedTeaser.hasActivity
                    ? `Ready on 1st ${wrappedTeaser.nextWrapLabel} — ${wrappedTeaser.daysUntil} days to go`
                    : 'Complete your first lesson to start building your monthly recap'}
                </Text>
              </View>
            ) : null}

            {latestWrapped && !unreadWrapped ? (
              <View style={styles.wrappedHistorySection}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/wrapped', params: { month: latestWrapped.monthKey } })
                  }
                  style={styles.wrappedHistoryRow}>
                  <Text style={styles.wrappedHistoryMonth}>{wrappedCardTitle(latestWrapped)}</Text>
                  <Text style={styles.wrappedHistoryMeta}>
                    {latestWrapped.totalLessons} lessons · +{latestWrapped.improvementPercent}% ·{' '}
                    {latestWrapped.levelAtEnd}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {wrappedOverdue ? (
              <View style={styles.wrappedOverdueCard}>
                <Text style={styles.wrappedOverdueText}>
                  Your {monthNameOnly(currentMonthKey())} Wrapped is overdue
                </Text>
                <Pressable
                  disabled={generatingWrapped}
                  onPress={() => {
                    void (async () => {
                      setGeneratingWrapped(true);
                      try {
                        const created = await generateCurrentWrappedNow();
                        if (!created) {
                          Alert.alert(
                            'No Wrapped yet',
                            `No lessons recorded in ${monthNameOnly(previousMonthKey())}.\nStart learning to see your Wrapped next month! 🎉`,
                          );
                          setWrappedOverdue(false);
                          return;
                        }
                        const [latest, unread, wraps] = await Promise.all([
                          getMostRecentWrapped(),
                          getUnreadWrappedMonth(),
                          getWrappedHistory(),
                        ]);
                        setLatestWrapped(latest);
                        setUnreadWrapped(unread);
                        setWrappedHistory(wraps);
                        setWrappedOverdue(false);
                        if (Platform.OS !== 'web') {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                      } finally {
                        setGeneratingWrapped(false);
                      }
                    })();
                  }}
                  style={({ pressed }) => [
                    styles.generateNowButton,
                    pressed && styles.generateNowButtonPressed,
                    generatingWrapped && styles.generateNowButtonDisabled,
                  ]}>
                  {generatingWrapped ? (
                    <ActivityIndicator color="#0B0F14" />
                  ) : (
                    <Text style={styles.generateNowButtonText}>Generate now</Text>
                  )}
                </Pressable>
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
  weeklyBalanceCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  weeklyBalanceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 2,
  },
  weeklyActivitySummary: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    marginBottom: 8,
    lineHeight: 18,
  },
  weeklyBalanceRow: { gap: 4 },
  weeklyBalanceRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyBalanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: progressPalette.text,
  },
  weeklyBalanceCount: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  weeklyBalanceTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: progressPalette.surfaceBorder,
    overflow: 'hidden',
  },
  weeklyBalanceFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: progressPalette.accent,
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
  wrappedOverdueCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  wrappedOverdueText: {
    fontSize: 14,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  generateNowButton: {
    backgroundColor: '#A78BFA',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  generateNowButtonPressed: { opacity: 0.85 },
  generateNowButtonDisabled: { opacity: 0.6 },
  generateNowButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0B0F14',
  },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
});
