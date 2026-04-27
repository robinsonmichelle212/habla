import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { debugLogAllAsyncStorage, getStreakState } from '@/lib/streak';

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
  const [freezes, setFreezes] = useState(0);
  const [last7Days, setLast7Days] = useState<{ date: string; completed: boolean }[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadStreak = async () => {
        try {
          const full = await getStreakState();
          console.log('Streak loaded from storage:', full.currentStreak);
          console.log('Last session date loaded:', full.lastSessionDate);
          setCurrentStreak(full.currentStreak);
          setLongestStreak(full.longestStreak);
          setTotalSessions(full.totalSessionsCompleted);
          setFreezes(full.freezes);
          setLast7Days(full.last7Days);
        } finally {
          setStreakHydrated(true);
        }
      };
      loadStreak();
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

            <View style={styles.freezeWrap} accessibilityLabel="Streak freezes">
              <Text style={styles.shieldEmoji}>🛡️</Text>
              <Text style={styles.freezeCount}>{String(freezes)}</Text>
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

        <View style={styles.statsRow}>
          <StatCard label="Today's score" value="85" />
          <StatCard label="Top Score This Week" value="92" />
          <StatCard label="Level" value="3" />
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
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  freezeWrap: {
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
  shieldEmoji: {
    fontSize: 16,
  },
  freezeCount: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
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
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 6,
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
