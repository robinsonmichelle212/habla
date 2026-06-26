import { ActivityHeatmap } from '@/components/progress/activity-heatmap';
import { progressPalette } from '@/components/progress/chart-theme';
import { DateRangeToggle } from '@/components/progress/date-range-toggle';
import { ProgressLineChart } from '@/components/progress/progress-line-chart';
import { ProgressSummaryHeader } from '@/components/progress/progress-summary';
import { StreakHistoryChart } from '@/components/progress/streak-history-chart';
import { LessonScoreBreakdownModal } from '@/components/lesson-score-breakdown';
import { CollapsibleProfileSection } from '@/components/collapsible-profile-section';
import { LevelBarometerSection } from '@/components/level-barometer-section';
import { MilestonesSection } from '@/components/milestones-section';
import { LevelDetailModal } from '@/components/level-detail-modal';
import { getLevelBarometer, getNextLevelRequirements, type LevelBandId } from '@/lib/level-progress';
import {
  buildActivityHeatmap,
  buildOverallScoreTrend,
  buildProgressSummary,
  buildSkillTrends,
  buildStreakHistory,
  trendArrow,
  type ProgressDateRange,
} from '@/lib/progress-data';
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
import { getStreakState } from '@/lib/streak';
import { buildWrappedTeaser, monthLabel } from '@/lib/wrapped-data';
import { getUnreadWrappedMonth, getWrappedHistory } from '@/lib/wrapped-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Dimensions,
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
  const chartWidth = Dimensions.get('window').width - 40;

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ProgressDateRange>('30d');
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [drills, setDrills] = useState<Awaited<ReturnType<typeof getDrillHistory>>>([]);
  const [streak, setStreak] = useState<Awaited<ReturnType<typeof getStreakState>> | null>(null);
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
  const [levelExpanded, setLevelExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLevelExpanded(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const [lessonHistory, drillHistory, streakState, wraps, unread] = await Promise.all([
            getLessonHistory(),
            getDrillHistory(),
            getStreakState(),
            getWrappedHistory(),
            getUnreadWrappedMonth(),
          ]);
          if (cancelled) return;
          setLessons(lessonHistory);
          setDrills(drillHistory);
          setStreak(streakState);
          setWrappedHistory(wraps);
          setUnreadWrapped(unread);
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

  const summary = useMemo(
    () => (streak ? buildProgressSummary(lessons, drills, streak) : null),
    [lessons, drills, streak],
  );

  const overallTrend = useMemo(() => buildOverallScoreTrend(lessons, range), [lessons, range]);
  const skillTrends = useMemo(() => buildSkillTrends(lessons, range), [lessons, range]);
  const heatmapWeeks = useMemo(() => buildActivityHeatmap(lessons, drills), [lessons, drills]);
  const streakBars = useMemo(
    () => (streak ? buildStreakHistory(lessons, drills, streak) : []),
    [lessons, drills, streak],
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
        <Text style={styles.pageSubtitle}>Scores, trends, and your Spanish journey</Text>

        {!loading ? (
          <View style={styles.scoreRow}>
            <ScoreCard
              label={todaysScoreInfo.label}
              value={todaysScoreInfo.score != null ? `${todaysScoreInfo.score}%` : '--'}
              onPress={
                todaysScoreInfo.score != null
                  ? () => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setShowTodayModal(true);
                    }
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
            {!loading && unreadWrapped ? (
              <Pressable
                onPress={() => router.push({ pathname: '/wrapped', params: { month: unreadWrapped } })}
                style={styles.wrappedPromo}>
                <Text style={styles.wrappedPromoTitle}>Your Spanish Wrapped is ready 🎉</Text>
                <Text style={styles.wrappedPromoText}>Tap to open {monthLabel(unreadWrapped)}</Text>
              </Pressable>
            ) : null}

            {!loading && wrappedTeaser && wrappedHistory.length === 0 && !unreadWrapped ? (
              <View style={styles.wrappedTeaser}>
                <Text style={styles.wrappedTeaserTitle}>Your first Wrapped is coming</Text>
                <Text style={styles.wrappedTeaserText}>
                  {wrappedTeaser.hasActivity
                    ? `Ready on 1st ${wrappedTeaser.nextWrapLabel} — ${wrappedTeaser.daysUntil} days to go`
                    : 'Complete your first lesson to start building your monthly recap'}
                </Text>
              </View>
            ) : null}

            {!loading && wrappedHistory.length > 0 ? (
              <View style={styles.wrappedHistorySection}>
                <Text style={styles.wrappedHistoryTitle}>Spanish Wrapped history</Text>
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
                title="Level & Barometer"
                summary={levelSummary}
                expanded={levelExpanded}
                onToggle={() => setLevelExpanded((v) => !v)}>
                <LevelBarometerSection
                  barometer={barometer}
                  onSelectBand={setSelectedBandId}
                  hideTitle
                  embedded
                />
              </CollapsibleProfileSection>
            ) : null}

            <MilestonesSection />

            <Text style={styles.journeyHeading}>Your journey</Text>

            {summary ? <ProgressSummaryHeader summary={summary} /> : null}

            <ChartSection
              title="Overall score trend"
              description="Lesson scores over time. Lines break when you have a gap of 2+ days between lessons.">
              <DateRangeToggle value={range} onChange={setRange} />
              <View style={styles.chartSpacer} />
              <ProgressLineChart
                width={chartWidth}
                series={[
                  {
                    color: progressPalette.accent,
                    segments: overallTrend.segments,
                    showBest: true,
                  },
                ]}
              />
              <View style={styles.trendRow}>
                <Text style={styles.trendText}>
                  {trendArrow(overallTrend.trendDirection)} {summary?.trendLabel ?? ''}
                </Text>
                {overallTrend.personalBest != null ? (
                  <Text style={styles.bestNote}>⭐ Personal best: {overallTrend.personalBest}%</Text>
                ) : null}
              </View>
            </ChartSection>

            <ChartSection
              title="Skills breakdown over time"
              description="Grammar, vocabulary, fluency, writing, and structure scores from each lesson.">
              <DateRangeToggle value={range} onChange={setRange} />
              <View style={styles.chartSpacer} />
              <ProgressLineChart
                width={chartWidth}
                series={skillTrends.map((s) => ({
                  color: s.color,
                  segments: s.segments,
                }))}
              />
              <View style={styles.legendRow}>
                {skillTrends.map((s) => (
                  <View key={s.key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.legendLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </ChartSection>

            <ChartSection
              title="Activity heatmap"
              description="Daily practice intensity — lessons, drills, or both.">
              <ActivityHeatmap weeks={heatmapWeeks} />
            </ChartSection>

            <ChartSection
              title="Streak history"
              description="Each bar is a consecutive-day practice streak.">
              <StreakHistoryChart bars={streakBars} />
            </ChartSection>
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

function ChartSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
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
  journeyHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: progressPalette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    lineHeight: 18,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
  },
  chartSpacer: { height: 12 },
  trendRow: { marginTop: 10, gap: 4 },
  trendText: {
    fontSize: 14,
    fontWeight: '800',
    color: progressPalette.text,
  },
  bestNote: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
});
