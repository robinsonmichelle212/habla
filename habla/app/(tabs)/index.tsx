import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completeDailyChallenge,
  getTodaysChallengeForHome,
  type DailyChallenge,
} from '@/lib/daily-challenge';
import {
  dismissShopBadge,
  getAffordableNextLevels,
  getGemShopProgress,
  getUrgentPendingUnlock,
  shouldShowShopBadge,
} from '@/lib/gem-shop';
import { formatExpiryCountdownShort } from '@/lib/gem-shop-expiry';
import { addGems, getTotalGems } from '@/lib/gems';
import { DailyActivityRow } from '@/components/daily-activity-row';
import { getLast7DaysActivity, type DailyActivityDay } from '@/lib/daily-activity';
import { repairMissingSessionPlaceholders } from '@/lib/practice-storage';
import { getUserName, shouldShowOnboarding, timeBasedGreeting } from '@/lib/onboarding-storage';
import { getStreakState } from '@/lib/streak';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  gem: '#A78BFA',
  amber: '#FBBF24',
  red: '#F87171',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [streakHydrated, setStreakHydrated] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [totalGems, setTotalGems] = useState(0);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [challengeConfirm, setChallengeConfirm] = useState(false);
  const [completingChallenge, setCompletingChallenge] = useState(false);
  const [showShopBadge, setShowShopBadge] = useState(false);
  const [urgentUnlock, setUrgentUnlock] = useState<ReturnType<typeof getUrgentPendingUnlock>>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [activityDays, setActivityDays] = useState<DailyActivityDay[]>([]);

  useEffect(() => {
    void shouldShowOnboarding().then((show) => {
      if (show) {
        router.replace('/onboarding' as Href);
        return;
      }
      setOnboardingChecked(true);
    });
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (urgentUnlock && urgentUnlock.expiresAt <= now) {
        void getGemShopProgress().then((p) => setUrgentUnlock(getUrgentPendingUnlock(p, now)));
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [urgentUnlock]);

  const refreshShopBadge = useCallback(async (gems: number) => {
    const affordable = await getAffordableNextLevels(gems);
    setShowShopBadge(shouldShowShopBadge(affordable));
    return affordable;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        try {
          await repairMissingSessionPlaceholders();
          const [streak, gems, challenge, shopProgress, name, weekActivity] = await Promise.all([
            getStreakState(),
            getTotalGems(),
            getTodaysChallengeForHome(),
            getGemShopProgress(),
            getUserName(),
            getLast7DaysActivity(),
          ]);
          if (cancelled) return;

          setCurrentStreak(streak.currentStreak);
          setTotalGems(gems);
          setDailyChallenge(challenge);
          setUrgentUnlock(getUrgentPendingUnlock(shopProgress));
          setGreeting(name ? timeBasedGreeting(name) : null);
          setActivityDays(weekActivity);

          await refreshShopBadge(gems);
        } finally {
          if (!cancelled) setStreakHydrated(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [refreshShopBadge]),
  );

  const openGemShop = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const affordable = await getAffordableNextLevels(totalGems);
    dismissShopBadge(affordable);
    setShowShopBadge(false);
    router.push('/gem-shop');
  };

  const handleStartLesson = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/lesson');
  };

  const handleCompleteChallenge = async () => {
    if (completingChallenge || !dailyChallenge || dailyChallenge.completed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCompletingChallenge(true);
    try {
      const result = await completeDailyChallenge();
      if (result.alreadyCompleted) {
        setDailyChallenge(null);
        return;
      }
      if (result.challenge) {
        const nextGems = await addGems(1);
        setTotalGems(nextGems);
        setChallengeConfirm(true);
        await refreshShopBadge(nextGems);
        setTimeout(() => {
          setDailyChallenge(null);
          setChallengeConfirm(false);
        }, 1500);
      }
    } finally {
      setCompletingChallenge(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {!onboardingChecked ? (
        <View style={styles.loadingGate}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      ) : (
        <>
      <View style={styles.topBar}>
        <View style={styles.streakPill} accessibilityLabel="Current streak">
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNumber}>{streakHydrated ? String(currentStreak) : '—'}</Text>
        </View>

        <Pressable
          onPress={() => void openGemShop()}
          style={({ pressed }) => [styles.gemsPill, pressed && styles.gemsPillPressed]}
          accessibilityRole="button"
          accessibilityLabel={showShopBadge ? 'Open gem shop, new unlock available' : 'Open gem shop'}>
          <Text style={styles.gemEmoji}>💎</Text>
          <Text style={styles.gemCount}>{streakHydrated ? String(totalGems) : '—'}</Text>
          {showShopBadge ? (
            <View style={styles.shopBadge}>
              <Text style={styles.shopBadgeText}>!</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {streakHydrated ? <DailyActivityRow days={activityDays} /> : null}

      <View style={[styles.main, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.centerBlock}>
          {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
          <Text style={styles.title}>Habla</Text>

          {dailyChallenge ? (
            <View style={styles.challengeCard}>
              <Text style={styles.challengeEyebrow}>Today&apos;s thinking challenge</Text>
              <Text style={styles.challengeText}>{dailyChallenge.text}</Text>
              {challengeConfirm ? (
                <Text style={styles.challengeConfirm}>💎 +1 Nice work! 🌟</Text>
              ) : (
                <Pressable
                  onPress={() => void handleCompleteChallenge()}
                  disabled={completingChallenge}
                  style={({ pressed }) => [
                    styles.challengeButton,
                    pressed && styles.challengeButtonPressed,
                    completingChallenge && styles.challengeButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark challenge complete">
                  <Text style={styles.challengeButtonText}>
                    {completingChallenge ? 'Saving…' : 'I did it ✅'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleStartLesson}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Start today's lesson">
            <Text style={styles.primaryButtonText}>Start Today&apos;s Lesson</Text>
          </Pressable>

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

          {urgentUnlock ? (
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                router.push({
                  pathname: '/bonus-round',
                  params: { round: urgentUnlock.roundId, level: String(urgentUnlock.level) },
                });
              }}
              style={({ pressed }) => [styles.urgentCard, pressed && styles.urgentCardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${urgentUnlock.roundName} level ${urgentUnlock.level} expires soon`}>
              <Text
                style={[
                  styles.urgentCardText,
                  urgentUnlock.expiresAt - tick < 60 * 60 * 1000 && styles.urgentCardTextRed,
                  urgentUnlock.expiresAt - tick < 6 * 60 * 60 * 1000 &&
                    urgentUnlock.expiresAt - tick >= 60 * 60 * 1000 &&
                    styles.urgentCardTextAmber,
                ]}>
                ⏰ {urgentUnlock.roundName} Level {urgentUnlock.level} expires in{' '}
                {formatExpiryCountdownShort(urgentUnlock.expiresAt, tick)} — Play now
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakEmoji: { fontSize: 22 },
  streakNumber: { fontSize: 20, fontWeight: '900', color: palette.text },
  gemsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    position: 'relative',
  },
  gemsPillPressed: { opacity: 0.88 },
  gemEmoji: { fontSize: 18 },
  gemCount: { fontSize: 18, fontWeight: '900', color: palette.gem },
  shopBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.background,
  },
  shopBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF', lineHeight: 12 },
  main: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  loadingGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: palette.text,
    marginBottom: 28,
    textAlign: 'center',
  },
  challengeCard: {
    width: '100%',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 18,
    gap: 10,
  },
  challengeEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  challengeText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 24,
  },
  challengeConfirm: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.gem,
    marginTop: 4,
  },
  challengeButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  challengeButtonPressed: { backgroundColor: palette.accentPressed },
  challengeButtonDisabled: { opacity: 0.6 },
  challengeButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0B0F14',
  },
  actions: {
    gap: 10,
    paddingBottom: 8,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonPressed: { backgroundColor: palette.accentPressed },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0B0F14',
  },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonPressed: { opacity: 0.9 },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  practiceHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  urgentCard: {
    marginTop: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urgentCardPressed: { opacity: 0.9 },
  urgentCardText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  urgentCardTextAmber: { color: palette.amber },
  urgentCardTextRed: { color: palette.red },
});
