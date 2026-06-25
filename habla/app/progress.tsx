import { ActivityHeatmap } from '@/components/progress/activity-heatmap';
import { progressPalette } from '@/components/progress/chart-theme';
import { DateRangeToggle } from '@/components/progress/date-range-toggle';
import { LevelStepsChart } from '@/components/progress/level-steps-chart';
import { ProgressLineChart } from '@/components/progress/progress-line-chart';
import { ProgressSummaryHeader } from '@/components/progress/progress-summary';
import { StreakHistoryChart } from '@/components/progress/streak-history-chart';
import { getLevelBarometer } from '@/lib/level-progress';
import {
  buildActivityHeatmap,
  buildLevelProgression,
  buildOverallScoreTrend,
  buildProgressSummary,
  buildSkillTrends,
  buildStreakHistory,
  trendArrow,
  type ProgressDateRange,
} from '@/lib/progress-data';
import { getDrillHistory, getLessonHistory } from '@/lib/practice-storage';
import { getStreakState } from '@/lib/streak';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Dimensions,
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const [lessonHistory, drillHistory, streakState] = await Promise.all([
            getLessonHistory(),
            getDrillHistory(),
            getStreakState(),
          ]);
          if (cancelled) return;
          setLessons(lessonHistory);
          setDrills(drillHistory);
          setStreak(streakState);
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
  const levelSteps = useMemo(() => buildLevelProgression(lessons, 'all'), [lessons]);
  const heatmapWeeks = useMemo(() => buildActivityHeatmap(lessons, drills), [lessons, drills]);
  const streakBars = useMemo(
    () => (streak ? buildStreakHistory(lessons, drills, streak) : []),
    [lessons, drills, streak],
  );
  const barometer = useMemo(() => getLevelBarometer(lessons), [lessons]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backLink} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.pageTitle}>My Progress 📈</Text>
        <Text style={styles.pageSubtitle}>Score trends and activity over time</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={progressPalette.accent} size="large" />
          </View>
        ) : (
          <>
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
              title="Level progression"
              description="Bands reached based on your rolling 10-lesson average.">
              <LevelStepsChart
                steps={levelSteps}
                currentBandIndex={barometer?.bandIndex ?? 0}
              />
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
    </SafeAreaView>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  backLink: { marginBottom: 8 },
  backText: { fontSize: 16, fontWeight: '700', color: progressPalette.accent },
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
    marginBottom: 18,
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
