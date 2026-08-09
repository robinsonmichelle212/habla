import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { hasFullActivityToday } from '@/lib/practice-storage';
import { recoverUnregisteredSessions } from '@/lib/session-recovery';
import { hasLastSummary } from '@/lib/last-summary-storage';
import { getCrashLog, logCrashBreadcrumb } from '@/lib/crash-breadcrumb';
import {
  homeRecommendationPreview,
  resolveLessonNudge,
} from '@/lib/lesson-type-nudge';
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
  const [displayStreak, setDisplayStreak] = useState(0);
  const [totalGems, setTotalGems] = useState(0);
  const [displayGems, setDisplayGems] = useState(0);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [challengeExpanded, setChallengeExpanded] = useState(false);
  const [challengeConfirm, setChallengeConfirm] = useState(false);
  const [completingChallenge, setCompletingChallenge] = useState(false);
  const [showShopBadge, setShowShopBadge] = useState(false);
  const [urgentUnlock, setUrgentUnlock] = useState<ReturnType<typeof getUrgentPendingUnlock>>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [activityDays, setActivityDays] = useState<DailyActivityDay[]>([]);
  const [showLastSummaryLink, setShowLastSummaryLink] = useState(false);
  const [javiRecommendation, setJaviRecommendation] = useState<string | null>(null);
  const [showSparkButton, setShowSparkButton] = useState(false);
  const titleTapCountRef = useRef(0);
  const titleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const previousGems = useRef(0);
  const gemsHydratedOnce = useRef(false);
  const gemsRafRef = useRef<number | null>(null);

  const triggerBounce = useCallback(() => {
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bounceAnim]);

  const animateGemsTo = useCallback((target: number) => {
    const start = previousGems.current;
    const difference = target - start;
    if (difference <= 0) {
      setDisplayGems(target);
      return;
    }

    const duration = Math.min(difference * 100, 1000);
    const startTime = Date.now();

    if (gemsRafRef.current != null) {
      cancelAnimationFrame(gemsRafRef.current);
      gemsRafRef.current = null;
    }

    const tickFrame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayGems(Math.round(start + difference * eased));
      if (progress < 1) {
        gemsRafRef.current = requestAnimationFrame(tickFrame);
      } else {
        gemsRafRef.current = null;
      }
    };

    gemsRafRef.current = requestAnimationFrame(tickFrame);
  }, []);

  useEffect(() => {
    if (currentStreak === 0) {
      setDisplayStreak(0);
      return;
    }

    const duration = 800;
    const startFrom = currentStreak > 10 ? currentStreak - 10 : 0;
    const steps = Math.max(currentStreak - startFrom, 1);
    const stepDuration = duration / steps;

    setDisplayStreak(startFrom);
    let current = startFrom;
    const timer = setInterval(() => {
      current += 1;
      setDisplayStreak(current);
      if (current >= currentStreak) {
        clearInterval(timer);
        triggerBounce();
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [currentStreak, triggerBounce]);

  useEffect(() => {
    return () => {
      if (gemsRafRef.current != null) cancelAnimationFrame(gemsRafRef.current);
    };
  }, []);

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
      // Always re-read home stats when returning from a milestone or lesson.
      setStreakHydrated(false);

      void (async () => {
        try {
          await logCrashBreadcrumb('home_screen_mounted');
          const crashLog = await getCrashLog();
          console.log('Last crash breadcrumbs:', crashLog);

          await recoverUnregisteredSessions();
          const [streak, gems, challenge, shopProgress, name, weekActivity, lastSummary, nudge, fullToday] =
            await Promise.all([
              getStreakState(),
              getTotalGems(),
              getTodaysChallengeForHome(),
              getGemShopProgress(),
              getUserName(),
              getLast7DaysActivity(),
              hasLastSummary(),
              resolveLessonNudge(),
              hasFullActivityToday(),
            ]);
          if (cancelled) return;

          setCurrentStreak(streak.currentStreak);
          setTotalGems(gems);
          if (!gemsHydratedOnce.current) {
            setDisplayGems(gems);
            previousGems.current = gems;
            gemsHydratedOnce.current = true;
          } else if (gems > previousGems.current) {
            animateGemsTo(gems);
            previousGems.current = gems;
          } else {
            setDisplayGems(gems);
            previousGems.current = gems;
          }
          setDailyChallenge(challenge);
          setUrgentUnlock(getUrgentPendingUnlock(shopProgress));
          setGreeting(name ? timeBasedGreeting(name) : null);
          setActivityDays(weekActivity);
          setShowLastSummaryLink(lastSummary);
          setJaviRecommendation(homeRecommendationPreview(nudge));
          setShowSparkButton(!fullToday);

          await refreshShopBadge(gems);
        } finally {
          if (!cancelled) setStreakHydrated(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [animateGemsTo, refreshShopBadge]),
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

  const handleTitleTap = () => {
    titleTapCountRef.current += 1;
    if (titleTapTimerRef.current) clearTimeout(titleTapTimerRef.current);
    titleTapTimerRef.current = setTimeout(() => {
      titleTapCountRef.current = 0;
    }, 1500);
    if (titleTapCountRef.current >= 5) {
      titleTapCountRef.current = 0;
      if (titleTapTimerRef.current) clearTimeout(titleTapTimerRef.current);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push('/crash-log' as Href);
    }
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
        if (nextGems > previousGems.current) {
          animateGemsTo(nextGems);
        } else {
          setDisplayGems(nextGems);
        }
        previousGems.current = nextGems;
        setTotalGems(nextGems);
        setChallengeConfirm(true);
        await refreshShopBadge(nextGems);
        setTimeout(() => {
          setDailyChallenge(null);
          setChallengeConfirm(false);
          setChallengeExpanded(false);
        }, 2000);
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
        <View style={[styles.page, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.topBar}>
            <Pressable onPress={handleTitleTap} hitSlop={8} accessibilityRole="button">
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting ?? 'Habla'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void openGemShop()}
              style={({ pressed }) => [styles.gemsPill, pressed && styles.gemsPillPressed]}
              accessibilityRole="button"
              accessibilityLabel={showShopBadge ? 'Open gem shop, new unlock available' : 'Open gem shop'}>
              <Text style={styles.gemEmoji}>💎</Text>
              <Text style={styles.gemCount}>{streakHydrated ? String(displayGems) : '—'}</Text>
              {showShopBadge ? (
                <View style={styles.shopBadge}>
                  <Text style={styles.shopBadgeText}>!</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.streakRow} accessibilityLabel="Current streak">
            <Animated.Text style={[styles.streakEmoji, { transform: [{ scale: bounceAnim }] }]}>
              🔥
            </Animated.Text>
            <Text style={styles.streakNumber}>{streakHydrated ? String(displayStreak) : '—'}</Text>
          </View>

          {streakHydrated ? <DailyActivityRow days={activityDays} /> : null}

          {dailyChallenge ? (
            <View
              style={[
                styles.challengeCard,
                !challengeExpanded && !challengeConfirm && styles.challengeCardCollapsed,
              ]}>
              {challengeConfirm ? (
                <Text style={styles.challengeDoneText}>✅ Challenge complete · +1 💎</Text>
              ) : (
                <View style={styles.challengeRow}>
                  <Pressable
                    style={styles.challengeTextCol}
                    onPress={() => setChallengeExpanded((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      challengeExpanded ? 'Collapse challenge' : 'Expand challenge text'
                    }>
                    <Text style={styles.challengeLabel}>💡 Today&apos;s Challenge</Text>
                    <Text
                      style={styles.challengeText}
                      numberOfLines={challengeExpanded ? undefined : 2}
                      ellipsizeMode="tail">
                      {dailyChallenge.text}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleCompleteChallenge()}
                    disabled={completingChallenge}
                    style={({ pressed }) => [
                      styles.challengePill,
                      pressed && styles.challengePillPressed,
                      completingChallenge && styles.challengePillDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Mark challenge complete">
                    <Text style={styles.challengePillText}>
                      {completingChallenge ? '…' : 'I did it ✅'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

          {showLastSummaryLink ? (
            <Pressable
              onPress={() => router.push('/last-summary' as Href)}
              style={({ pressed }) => [styles.lastSummaryLink, pressed && styles.lastSummaryPressed]}
              accessibilityRole="button"
              accessibilityLabel="View last summary">
              <Text style={styles.lastSummaryText}>View last summary →</Text>
            </Pressable>
          ) : null}

          <View style={styles.flexSpacer} />

          <View style={styles.actions}>
            <Pressable
              onPress={handleStartLesson}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Start today's lesson">
              <Text style={styles.primaryButtonText}>Start Today&apos;s Lesson</Text>
              {javiRecommendation ? (
                <Text style={styles.primaryButtonHint}>{javiRecommendation}</Text>
              ) : null}
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
              <Text style={styles.secondaryButtonHint}>5 mins · drill your errors</Text>
            </Pressable>

            {showSparkButton ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push('/spark' as Href);
                }}
                style={({ pressed }) => [styles.sparkButton, pressed && styles.sparkButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Streak session, 60 seconds">
                <Text style={styles.sparkButtonText}>⚡ Streak — 60 seconds</Text>
                <Text style={styles.sparkButtonHint}>Keeps your streak alive. Nothing more.</Text>
              </Pressable>
            ) : null}

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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    gap: 12,
  },
  greeting: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakEmoji: { fontSize: 36 },
  streakNumber: { fontSize: 44, fontWeight: '900', color: palette.text, letterSpacing: -1 },
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
    flexShrink: 0,
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
  flexSpacer: {
    flex: 1,
    minHeight: 12,
  },
  loadingGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  challengeCardCollapsed: {
    maxHeight: 70,
    overflow: 'hidden',
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  challengeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  challengeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 15,
  },
  challengePill: {
    flexShrink: 0,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengePillPressed: { opacity: 0.9 },
  challengePillDisabled: { opacity: 0.5 },
  challengePillText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  challengeDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  primaryButtonPressed: { backgroundColor: palette.accentPressed },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0B0F14',
    textAlign: 'center',
  },
  primaryButtonHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(11, 15, 20, 0.72)',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  secondaryButtonPressed: { opacity: 0.9 },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
  },
  secondaryButtonHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  sparkButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  sparkButtonPressed: { opacity: 0.75 },
  sparkButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
  },
  sparkButtonHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7380',
    textAlign: 'center',
  },
  lastSummaryLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  lastSummaryPressed: { opacity: 0.75 },
  lastSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
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
