import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LessonScoreBreakdownModal } from '@/components/lesson-score-breakdown';
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
import { getProgressionLevel } from '@/lib/level-progress';
import { debugLogAllAsyncStorage, getStreakState } from '@/lib/streak';
import { getTotalGems } from '@/lib/gems';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [streakHydrated, setStreakHydrated] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalGems, setTotalGems] = useState(0);
  const [last7Days, setLast7Days] = useState<{ date: string; completed: boolean }[]>([]);
  const [statsHydrated, setStatsHydrated] = useState(false);
  const [todaysScoreInfo, setTodaysScoreInfo] = useState<TodayScoreInfo>({
    score: null,
    label: "Today's score",
    lessonEntry: null,
    drillEntry: null,
  });
  const [topScoreWeek, setTopScoreWeek] = useState<number | null>(null);
  const [levelLabel, setLevelLabel] = useState<string | null>(null);
  const [bestWeekLessonEntry, setBestWeekLessonEntry] = useState<LessonHistoryEntry | null>(null);
  const [bestWeekDrillEntry, setBestWeekDrillEntry] = useState<DrillHistoryEntry | null>(null);
  const [weekChart, setWeekChart] = useState<WeekChartDay[]>([]);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadHomeData = async () => {
        try {
          const [full, history, drills, gems] = await Promise.all([
            getStreakState(),
            getLessonHistory(),
            getDrillHistory(),
            getTotalGems(),
          ]);
          if (cancelled) return;

          console.log('Streak loaded from storage:', full.currentStreak);
          console.log('Last session date loaded:', full.lastSessionDate);
          setCurrentStreak(full.currentStreak);
          setLongestStreak(full.longestStreak);
          setTotalSessions(full.totalSessionsCompleted);
          setTotalGems(gems);
          setLast7Days(full.last7Days);

          setTodaysScoreInfo(getTodayScoreInfo(history, drills));
          setTopScoreWeek(getTopScoreThisWeek(history, drills));
          setLevelLabel(getProgressionLevel(history));
          const bestWeek = getBestDayThisWeek(history, drills);
          setBestWeekLessonEntry(bestWeek?.lessonEntry ?? null);
          setBestWeekDrillEntry(bestWeek?.drillEntry ?? null);
          setWeekChart(getWeekScoreChart(history, drills));
        } finally {
          if (!cancelled) {
            setStreakHydrated(true);
            setStatsHydrated(true);
          }
        }
      };

      void loadHomeData();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const streakLabel = useMemo(() => {
    if (!streakHydrated) return 'Loading…';
    const current = currentStreak;
    if (current <= 0) return 'Start your streak today';
    if (current === 1) return 'Day 1';
    return `${current} day streak`;
  }, [currentStreak, streakHydrated]);

  const handleStartLesson = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/lesson');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 8 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Habla</Text>

        <View style={styles.streakBlock}>
          <View style={styles.streakTopRow}>
            <View style={styles.streakFlameWrap}>
              <Text style={styles.flameEmoji} accessibilityLabel="Streak">
                🔥
              </Text>
              <Text style={styles.streakNumber}>
                {streakHydrated ? String(currentStreak) : '—'}
              </Text>
            </View>

            <View style={styles.gemsWrap} accessibilityLabel="Total gems">
              <Text style={styles.gemEmoji}>💎</Text>
              <Text style={styles.gemCount}>{streakHydrated ? String(totalGems) : '—'}</Text>
            </View>
          </View>

          <Text style={styles.streakLabel}>{streakLabel}</Text>

          <View style={styles.dotsRow} accessibilityLabel="Last 7 days activity">
            {last7Days.map((d) => (
              <View
                key={d.date}
                style={[styles.dot, d.completed ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
            {!last7Days.length
              ? Array.from({ length: 7 }).map((_, i) => (
                  <View key={`p-${i}`} style={[styles.dot, styles.dotEmpty]} />
                ))
              : null}
          </View>

          <Text style={styles.longestLabel}>
            Longest streak: {streakHydrated ? `${String(longestStreak)} days` : '—'}
          </Text>
          <Text style={styles.longestLabel}>
            Total sessions: {streakHydrated ? String(totalSessions) : '—'}
          </Text>
        </View>

        <Pressable
          onPress={handleStartLesson}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start today's lesson">
          <Text style={styles.primaryButtonText}>{"Start Today's Lesson"}</Text>
        </Pressable>

        <View style={styles.practiceBlock}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.push('/practice');
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Practice mode">
            <Text style={styles.secondaryButtonText}>Practice</Text>
          </Pressable>
          <Text style={styles.practiceHint}>5 mins · keeps your streak alive</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label={todaysScoreInfo.label}
            value={
              !statsHydrated
                ? '—'
                : todaysScoreInfo.score != null
                  ? `${todaysScoreInfo.score}%`
                  : '--'
            }
            onPress={
              statsHydrated && todaysScoreInfo.score != null
                ? () => {
                    console.log("[Habla] Today's score tile tapped:", JSON.stringify(todaysScoreInfo, null, 2));
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setShowTodayModal(true);
                  }
                : undefined
            }
          />
          <StatCard
            label="Top Score This Week"
            value={
              !statsHydrated ? '—' : topScoreWeek != null ? `${topScoreWeek}%` : '--'
            }
            onPress={
              statsHydrated && topScoreWeek != null
                ? () => {
                    console.log('[Habla] Top score this week tile tapped:', JSON.stringify({ bestWeekLessonEntry, bestWeekDrillEntry }, null, 2));
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setShowWeekModal(true);
                  }
                : undefined
            }
          />
          <StatCard
            label="Level"
            value={!statsHydrated ? '—' : levelLabel ?? '--'}
            compact
            onPress={
              statsHydrated
                ? () => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    router.push('/level');
                  }
                : undefined
            }
          />
        </View>

        <Pressable
          onPress={() => {
            void debugLogAllAsyncStorage();
          }}
          style={({ pressed }) => [styles.debugDumpButton, pressed && styles.debugDumpButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Debug dump AsyncStorage to console">
          <Text style={styles.debugDumpText}>Debug: dump AsyncStorage</Text>
        </Pressable>
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
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  compact = false,
  onPress,
}: {
  label: string;
  value: string;
  compact?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.statCard}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statCard, styles.statCardTappable, pressed && styles.statCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    color: palette.text,
    marginBottom: 28,
  },
  streakBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  streakTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  streakFlameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flameEmoji: {
    fontSize: 56,
    lineHeight: 64,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: -1,
  },
  streakLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.muted,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  gemsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  gemEmoji: {
    fontSize: 16,
  },
  gemCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#A78BFA',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  dotFilled: {
    backgroundColor: palette.accent,
    borderColor: 'rgba(255, 122, 89, 0.55)',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderColor: palette.surfaceBorder,
  },
  longestLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  primaryButtonPressed: {
    backgroundColor: palette.accentPressed,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
  practiceBlock: {
    marginBottom: 28,
  },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  secondaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: 0.2,
  },
  practiceHint: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statCardTappable: {
    borderColor: 'rgba(255, 122, 89, 0.35)',
  },
  statCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  statValueCompact: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 14,
  },
  debugDumpButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface,
  },
  debugDumpButtonPressed: {
    opacity: 0.85,
  },
  debugDumpText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
});
