import { SummaryErrorBoundary } from '@/components/summary-error-boundary';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppTextInput } from '@/components/app-text-input';
import { SummaryScoreRing } from '@/components/summary-score-ring';
import { InteractiveSpanishText } from '@/components/interactive-spanish-text';
import { checkDrillAnswer, generateDailyThinkingChallenge, generateDrills } from '@/lib/claude';
import { getRecentChallengeTexts, resolveChallengeTypeForLesson, saveDailyChallenge } from '@/lib/daily-challenge';
import {
  buildFocusTipsFromAnalysis,
  getActiveFocusTipsForChallenge,
  markFocusTipsUsedInChallenge,
  saveFocusTipsFromSummaryIfExpired,
} from '@/lib/current-focus-tips';
import { useSummaryReveal } from '@/hooks/use-summary-reveal';
import { useMilestoneCelebration } from '@/contexts/milestone-context';
import { addGems, calculateLessonGems, getTotalGems, OFFLINE_SPEAKING_ATTEMPT_GEMS } from '@/lib/gems';
import { saveLastSummary } from '@/lib/last-summary-storage';
import {
  DEMO_DAILY_CHALLENGE,
  DEMO_DRILLS,
  DEMO_SESSION_NOTICE,
  scoreDemoDrillAnswer,
} from '@/lib/demo-mode';
import { checkPersonalBestMilestone, checkLevelUpMilestone, milestonesOnLessonComplete, type MilestoneCelebration } from '@/lib/milestones';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { getLessonSession, clearLessonSessionMemory, setLessonSession } from '@/lib/lesson-session';
import { stopJaviSpeech } from '@/lib/javi-speech';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import {
  buildSafeSummaryPayload,
  logSummaryData,
  safeNumber,
  type SafeSummaryPayload,
} from '@/lib/summary-safe-data';
import { syncStreakReminder } from '@/lib/streak-notifications';
import { formatLocalDate, updateStreak } from '@/lib/streak';
import { lessonTypeLabel, upsertLessonHistoryEntry, getLessonHistory } from '@/lib/practice-storage';
import { getLevelBarometer } from '@/lib/level-progress';
import { queueMilestoneQuizzesFromCelebrations } from '@/lib/milestone-celebration-quiz';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
};

function splitBilingualMessage(message: string | null | undefined): { spanish: string; english?: string } {
  const safe = typeof message === 'string' ? message : '';
  if (!safe.trim()) return { spanish: '¡Buen trabajo!' };
  const idx = safe.indexOf(' / ');
  if (idx === -1) return { spanish: safe };
  return {
    spanish: safe.slice(0, idx).trim(),
    english: safe.slice(idx + 3).trim(),
  };
}

function formatWritingMetric(value: number | null | undefined, pending: boolean): string {
  if (pending || value == null) return 'Pending ⏳';
  return `${Math.round(value)}%`;
}

function formatSpeakingMetric(
  value: number | null | undefined,
  pending: boolean,
  expired: boolean,
): string {
  if (expired) return 'Expired';
  if (pending || value == null) return 'Pending ⏳';
  return `${Math.round(value)}%`;
}

async function withOneRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Habla] ${label} failed, retrying once:`, err);
    return await fn();
  }
}

export default function SummaryScreen() {
  const router = useRouter();
  const payload = useMemo(() => {
    try {
      const session = getLessonSession();
      const built = buildSafeSummaryPayload(session);
      logSummaryData(built);
      return built;
    } catch (err) {
      console.error('[Habla] buildSafeSummaryPayload failed:', err);
      return buildSafeSummaryPayload({
        warmUpConversation: [],
        speakingConversation: [],
        conversation: [],
      });
    }
  }, []);

  const onErrorGoHome = useCallback(() => {
    stopJaviSpeech();
    clearLessonSessionMemory();
    router.replace('/' as Href);
  }, [router]);

  return (
    <ErrorBoundary onGoHome={onErrorGoHome}>
      <SummaryErrorBoundary payload={payload} onGoHome={onErrorGoHome}>
        <SummaryScreenInner payload={payload} />
      </SummaryErrorBoundary>
    </ErrorBoundary>
  );
}

function SummaryScreenInner({
  payload,
}: {
  payload: SafeSummaryPayload;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = payload.session;
  const analysis = payload.analysis;
  const lessonType = session.lessonType;
  const writing = session.writingEvaluation;
  const speaking = session.speakingEvaluation;
  const summaryNotice = session.summaryNotice;
  const isDemoSession = session.demoSession === true;
  const scorePending = payload.scorePending;
  const strongAreas =
    analysis.strongAreas?.length > 0 ? analysis.strongAreas : ['Good effort today'];
  const weakAreas = analysis.weakAreas?.length > 0 ? analysis.weakAreas : ['Keep practising'];
  const focusAreas = analysis.focusAreas?.length > 0 ? analysis.focusAreas : ['Daily practice'];
  const didRecordRef = useRef(false);
  const pendingCelebrationsRef = useRef<MilestoneCelebration[]>([]);
  const milestoneGemPulse = useRef(new Animated.Value(1)).current;
  const { celebrate } = useMilestoneCelebration();
  const [gemsEarned, setGemsEarned] = useState(payload.gemsEarnedEstimate ?? 2);
  const [gemsBefore, setGemsBefore] = useState(0);
  const [streakHydrated, setStreakHydrated] = useState(false);

  const [mode, setMode] = useState<'summary' | 'drills'>('summary');
  const [loadingDrills, setLoadingDrills] = useState(false);
  const [drills, setDrills] = useState(session.drills ?? []);
  const [drillIdx, setDrillIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{
    score: number;
    feedback: string;
    correctAnswer?: string;
  } | null>(null);
  const [stars, setStars] = useState(0);
  const [dailyChallengeText, setDailyChallengeText] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const didGenerateChallengeRef = useRef(false);
  const persistencePromiseRef = useRef<Promise<void> | null>(null);
  const leavingHomeRef = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const revealRef = useRef<ReturnType<typeof useSummaryReveal> | null>(null);
  const [leavingHome, setLeavingHome] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      if (isMountedRef.current) fn();
    }, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const buildLessonHistoryEntry = useCallback(() => {
    if (!analysis || !lessonType) return null;
    try {
      const today = formatLocalDate();
      const baseBreakdown = analysis.breakdown ?? {
        grammar: {
          score: Math.round(writing?.grammarScore ?? 0),
          topic: 'Grammar',
          details: [],
        },
        vocabulary: {
          score: Math.round(writing?.vocabularyScore ?? 0),
          topic: 'Vocabulary',
          details: [],
        },
        fluency: {
          score: Math.round(writing?.fluencyScore ?? 0),
          details: [],
        },
        writing: {
          score: Math.round(
            ((writing?.grammarScore ?? 0) +
              (writing?.vocabularyScore ?? 0) +
              (writing?.fluencyScore ?? 0)) /
              3,
          ),
          details: [],
        },
      };
      const breakdown = mergeWritingIntoBreakdown(
        baseBreakdown,
        writing ?? undefined,
        session.writingTask?.prompt,
      );

      return {
        date: today,
        overallScore: scorePending
          ? null
          : (analysis.overallScore ?? analysis.correctnessScore ?? 0),
        breakdown,
        weakAreas: weakAreas,
        focusAreas: focusAreas,
        lessonType: lessonTypeLabel(lessonType),
        speaking: speaking
          ? {
              fluencyScore: speaking.pendingEvaluation ? null : speaking.fluencyScore,
              confidenceScore: speaking.pendingEvaluation ? null : speaking.confidenceScore,
              vocabularyRangeScore: speaking.pendingEvaluation
                ? null
                : speaking.vocabularyRangeScore,
              naturalFlowScore: speaking.pendingEvaluation ? null : speaking.naturalFlowScore,
              combinedScore: speaking.pendingEvaluation ? null : speaking.combinedScore,
              javiFeedback: speaking.javiFeedback,
              exchangeCount: speaking.exchangeCount,
              pendingEvaluation: speaking.pendingEvaluation,
              expired: speaking.expired,
              audioPaths: speaking.audioPaths,
            }
          : undefined,
      };
    } catch (err) {
      console.error('[Habla] buildLessonHistoryEntry failed:', err);
      return null;
    }
  }, [analysis, focusAreas, lessonType, scorePending, session.writingTask?.prompt, speaking, weakAreas, writing]);

  const runSummaryPersistence = useCallback(async () => {
    if (isDemoSession) {
      const beforeGems = await getTotalGems();
      if (isMountedRef.current) {
        setGemsBefore(beforeGems);
        setGemsEarned(2);
        setDailyChallengeText(DEMO_DAILY_CHALLENGE);
      }
      return;
    }

    const streakRes = await withOneRetry('updateStreak', updateStreak);
    const today = formatLocalDate();
    const overallScore = scorePending
      ? 0
      : safeNumber(analysis?.overallScore ?? analysis?.correctnessScore ?? 0);
    const gems = scorePending ? 0 : calculateLessonGems(overallScore);
    const beforeGems = await getTotalGems();
    if (isMountedRef.current) setGemsBefore(beforeGems);

    let personalBestCelebration = null;
    if (analysis && lessonType) {
      try {
        personalBestCelebration = await checkPersonalBestMilestone(overallScore, today);
      } catch (err) {
        console.error('[Habla] checkPersonalBestMilestone failed:', err);
      }
    }

    if (gems > 0) {
      await withOneRetry('addGems', () => addGems(gems));
      if (isMountedRef.current) setGemsEarned(gems);
    } else if (isMountedRef.current) {
      setGemsEarned(payload.gemsEarnedEstimate ?? 2);
    }

    if (analysis && lessonType) {
      const lessonHistoryEntry = buildLessonHistoryEntry();
      if (lessonHistoryEntry) {
        console.log(
          '[Habla] Saving to lessonHistory:',
          JSON.stringify(lessonHistoryEntry, null, 2),
        );
        await withOneRetry('lessonHistory', () => upsertLessonHistoryEntry(lessonHistoryEntry));
      }

      const focus = session.lessonFocus ? lessonFocusLabel(session.lessonFocus) : undefined;
      const grammarTopic =
        session.lessonFocus?.kind === 'grammar' ? session.lessonFocus.topic : undefined;

      await withOneRetry('focusTips', () =>
        saveFocusTipsFromSummaryIfExpired(
          buildFocusTipsFromAnalysis(analysis, {
            grammarTopic,
            lessonFocus: focus,
          }),
        ),
      );

      if (!didGenerateChallengeRef.current) {
        didGenerateChallengeRef.current = true;
        if (isMountedRef.current) setChallengeLoading(true);
        void (async () => {
          try {
            const recent = await getRecentChallengeTexts();
            const focusTipsForChallenge = await getActiveFocusTipsForChallenge();
            const challengeType = await resolveChallengeTypeForLesson(lessonType);
            const text = await generateDailyThinkingChallenge(
              {
                lessonType,
                lessonFocus: focus,
                grammarTopic,
                strongAreas,
                weakAreas,
                focusAreas,
                encouragingMessage: analysis.encouragingMessage,
                overallScore: analysis.overallScore,
              },
              challengeType,
              recent,
              focusTipsForChallenge?.tips,
            );
            await saveDailyChallenge(text, challengeType);
            if (focusTipsForChallenge) {
              await markFocusTipsUsedInChallenge();
            }
            if (isMountedRef.current) setDailyChallengeText(text);
          } catch {
            if (isMountedRef.current) setDailyChallengeText(null);
          } finally {
            if (isMountedRef.current) setChallengeLoading(false);
          }
        })();
      }
    }

    let levelUpCelebration: MilestoneCelebration | null = null;
    let levelUpLabel: string | undefined;
    if (analysis && lessonType) {
      const entry = buildLessonHistoryEntry();
      if (entry) {
        try {
          const existing = await getLessonHistory();
          const before = getLevelBarometer(existing);
          const withoutDup = existing.filter(
            (e) => !(e.date === entry.date && e.lessonType === entry.lessonType),
          );
          const after = getLevelBarometer([...withoutDup, entry]);
          if (after && before && after.bandIndex > before.bandIndex) {
            levelUpLabel = after.band.label;
            levelUpCelebration = await checkLevelUpMilestone(levelUpLabel, today);
          }
        } catch (err) {
          console.error('[Habla] level-up milestone check failed:', err);
        }
      }
    }

    const sessionCelebrations = await milestonesOnLessonComplete(
      streakRes.state.currentStreak,
      today,
    );
    const allCelebrations = [
      ...(personalBestCelebration ? [personalBestCelebration] : []),
      ...(levelUpCelebration ? [levelUpCelebration] : []),
      ...sessionCelebrations,
    ];
    if (allCelebrations.length > 0) {
      pendingCelebrationsRef.current = allCelebrations;
      try {
        celebrate(allCelebrations, {
          onAllDismissed: () => {
            const milestoneGems = pendingCelebrationsRef.current.reduce(
              (sum, c) => sum + c.gemsAwarded,
              0,
            );
            if (milestoneGems > 0 && isMountedRef.current) {
              setGemsEarned((prev) => prev + milestoneGems);
              Animated.sequence([
                Animated.timing(milestoneGemPulse, {
                  toValue: 1.22,
                  duration: 180,
                  useNativeDriver: true,
                }),
                Animated.timing(milestoneGemPulse, {
                  toValue: 1,
                  duration: 220,
                  useNativeDriver: true,
                }),
              ]).start();
            }
            const celebrationsSnapshot = [...pendingCelebrationsRef.current];
            pendingCelebrationsRef.current = [];
            void queueMilestoneQuizzesFromCelebrations(celebrationsSnapshot, {
              levelLabel: levelUpLabel,
              achievedDate: today,
            }).catch((quizErr) => {
              console.error('[Habla] milestone quiz queue failed:', quizErr);
            });
          },
        });
      } catch (celebrateErr) {
        console.error('[Habla] milestone celebration failed:', celebrateErr);
      }
    }

    await withOneRetry('saveLastSummary', () => saveLastSummary(payload));

    void syncStreakReminder().catch(() => {
      // Non-blocking: reschedule tomorrow's reminder after today's lesson.
    });
  }, [
    analysis,
    buildLessonHistoryEntry,
    celebrate,
    focusAreas,
    isDemoSession,
    lessonType,
    milestoneGemPulse,
    payload,
    scorePending,
    session.lessonFocus,
    strongAreas,
    weakAreas,
  ]);

  useEffect(() => {
    if (didRecordRef.current) return;
    didRecordRef.current = true;

    persistencePromiseRef.current = runSummaryPersistence()
      .catch((err) => {
        console.error('[Habla] Summary persistence failed:', err);
      })
      .finally(() => {
        if (isMountedRef.current) setStreakHydrated(true);
      });
  }, [runSummaryPersistence]);

  useEffect(() => {
    isMountedRef.current = true;
    stopJaviSpeech();

    return () => {
      isMountedRef.current = false;
      stopJaviSpeech();
      revealRef.current?.stop();
      milestoneGemPulse.stopAnimation();
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [milestoneGemPulse]);

  const startDrills = async () => {
    if (!analysis || !lessonType || loadingDrills) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoadingDrills(true);
    setLastFeedback(null);
    setAnswer('');
    try {
      if (isDemoSession) {
        setLessonSession({ drills: DEMO_DRILLS });
        setDrills(DEMO_DRILLS);
        setDrillIdx(0);
        setStars(0);
        setMode('drills');
        return;
      }

      const exercises = await generateDrills(lessonType, weakAreas, focusAreas);
      if (!exercises.length) {
        Alert.alert('No drills generated', 'Try again in a moment.');
        return;
      }
      setLessonSession({ drills: exercises });
      setDrills(exercises);
      setDrillIdx(0);
      setStars(0);
      setMode('drills');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not generate drills', message);
    } finally {
      setLoadingDrills(false);
    }
  };

  const submitDrillAnswer = async () => {
    if (!lessonType) return;
    const exercise = drills[drillIdx];
    if (!exercise) return;
    const trimmed = answer.trim();
    if (!trimmed || checking) return;

    setChecking(true);
    try {
      if (isDemoSession) {
        const result = scoreDemoDrillAnswer(exercise.expectedAnswer, trimmed);
        const score = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
        setLastFeedback({ score, feedback: result.feedback, correctAnswer: result.correctAnswer });
        if (score >= 75) setStars((s) => s + 1);
        return;
      }

      const result = await checkDrillAnswer(lessonType, exercise, trimmed);
      const score = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
      const feedback = `${result.feedbackSpanish}\n\n${result.feedbackEnglish}`;
      setLastFeedback({ score, feedback, correctAnswer: result.correctAnswer });
      if (score >= 75) setStars((s) => s + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not check answer', message);
    } finally {
      setChecking(false);
    }
  };

  const nextExercise = () => {
    setLastFeedback(null);
    setAnswer('');
    setDrillIdx((i) => Math.min(i + 1, Math.max(0, drills.length - 1)));
  };

  const hasAnalysis = !!analysis;
  const overallScore = scorePending ? 0 : safeNumber(analysis?.overallScore ?? 0);
  const revealEnabled = hasAnalysis && mode === 'summary' && streakHydrated;

  const reveal = useSummaryReveal({
    enabled: revealEnabled,
    overallScore,
    strongCount: strongAreas.length,
    weakCount: weakAreas.length,
    focusCount: focusAreas.length,
    gemsEarned: gemsEarned ?? 2,
    gemsBefore,
  });
  revealRef.current = reveal;

  const confirmAndGoHome = useCallback(async () => {
    if (leavingHomeRef.current) return;
    leavingHomeRef.current = true;
    if (isMountedRef.current) setLeavingHome(true);

    stopJaviSpeech();
    revealRef.current?.stop();
    milestoneGemPulse.stopAnimation();

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let indicatorShown = false;
    const indicatorTimer = scheduleTimeout(() => {
      indicatorShown = true;
      setSaveIndicator('Saving...');
    }, 1000);

    try {
      await (persistencePromiseRef.current ?? runSummaryPersistence());
      await withOneRetry('finalLastSummary', () => saveLastSummary(payload));
      if (indicatorShown && isMountedRef.current) {
        setSaveIndicator('Saving... ✅');
        await new Promise<void>((resolve) => {
          scheduleTimeout(() => resolve(), 450);
        });
      }
    } catch (err) {
      console.error('[Habla] confirmAndGoHome save failed:', err);
    } finally {
      clearTimeout(indicatorTimer);
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== indicatorTimer);
      stopJaviSpeech();
      clearLessonSessionMemory();
      isMountedRef.current = false;
      router.replace('/' as Href);
    }
  }, [milestoneGemPulse, payload, router, runSummaryPersistence, scheduleTimeout]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void confirmAndGoHome();
      return true;
    });
    return () => sub.remove();
  }, [confirmAndGoHome]);

  const goHome = () => {
    void confirmAndGoHome();
  };

  const challengeBorderColor = reveal.challengeHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(37, 45, 58, 1)', 'rgba(255, 122, 89, 0.65)'],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      {hasAnalysis && mode === 'summary' ? (
        <View style={styles.gemTopBar}>
          <Text style={styles.gemTopEmoji}>💎</Text>
          <Text style={styles.gemTopCount}>{reveal.gemCountDisplay}</Text>
        </View>
      ) : null}
      {!reveal.complete && revealEnabled ? (
        <Pressable
          style={styles.skipOverlay}
          onPress={reveal.skip}
          accessibilityRole="button"
          accessibilityLabel="Skip reveal animation"
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: mode === 'summary' && hasAnalysis ? 88 : 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        {!hasAnalysis ? (
          <>
            <Text style={styles.pageTitle}>Lesson Complete</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No summary yet</Text>
              <Text style={styles.emptyText}>
                Go back to the lesson and tap End Lesson to generate your personalised summary.
              </Text>
            </View>
          </>
        ) : mode === 'summary' ? (
          <>
            {(summaryNotice || isDemoSession) ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {isDemoSession ? DEMO_SESSION_NOTICE : summaryNotice}
                </Text>
              </View>
            ) : null}
            <Animated.Text
              style={[
                styles.pageTitle,
                {
                  opacity: reveal.titleOpacity,
                  transform: [{ translateY: reveal.titleTranslateY }],
                },
              ]}>
              Lesson Complete
            </Animated.Text>
            <Animated.Text
              style={[
                styles.pageSubtitle,
                {
                  opacity: reveal.subtitleOpacity,
                  transform: [{ translateY: reveal.subtitleTranslateY }],
                },
              ]}>
              {lessonType === 'Read' ? 'Reading lesson wrapped' : `${lessonType} lesson wrapped`}
            </Animated.Text>

            <View style={styles.scoreSection}>
              <Text style={styles.scoreLabel}>Overall lesson score</Text>
              <SummaryScoreRing
                score={reveal.displayScore}
                progress={reveal.scoreProgress}
                scale={reveal.scoreScale}
                opacity={reveal.scoreOpacity}
                pending={scorePending}
              />
              <Animated.View style={{ opacity: reveal.scoreOpacity }}>
                <Text style={styles.scoreHint}>
                  {scorePending
                    ? 'Some scores are still being calculated'
                    : lessonType === 'Read'
                      ? 'comprehension + discussion'
                      : 'accuracy in writing · fluency in speaking'}
                </Text>
              </Animated.View>
            </View>

            <View style={styles.section}>
              <Animated.Text
                style={[
                  styles.sectionTitle,
                  {
                    opacity: reveal.strongHeaderOpacity,
                    transform: [{ translateX: reveal.strongHeaderTranslateX }],
                  },
                ]}>
                Strong Areas ✅
              </Animated.Text>
              {strongAreas.map((t, idx) => (
                <Animated.View
                  key={`s-${idx}`}
                  style={[
                    styles.item,
                    styles.itemGreen,
                    styles.itemGlowGreen,
                    { opacity: reveal.strongItemOpacities[idx] ?? 1 },
                  ]}>
                  <Text style={[styles.itemText, styles.textGreen]}>{t}</Text>
                </Animated.View>
              ))}
            </View>

            <View style={styles.section}>
              <Animated.Text
                style={[
                  styles.sectionTitle,
                  {
                    opacity: reveal.weakHeaderOpacity,
                    transform: [{ translateX: reveal.weakHeaderTranslateX }],
                  },
                ]}>
                Weak Areas ⚠️
              </Animated.Text>
              {weakAreas.map((t, idx) => (
                <Animated.View
                  key={`w-${idx}`}
                  style={[
                    styles.item,
                    styles.itemAmber,
                    styles.itemGlowAmber,
                    { opacity: reveal.weakItemOpacities[idx] ?? 1 },
                  ]}>
                  <Text style={[styles.itemText, styles.textAmber]}>{t}</Text>
                </Animated.View>
              ))}
            </View>

            <View style={styles.section}>
              <Animated.Text
                style={[
                  styles.sectionTitle,
                  {
                    opacity: reveal.focusHeaderOpacity,
                    transform: [{ translateX: reveal.focusHeaderTranslateX }],
                  },
                ]}>
                Focus Tomorrow 🎯
              </Animated.Text>
              {focusAreas.map((t, idx) => (
                <Animated.View
                  key={`f-${idx}`}
                  style={[
                    styles.item,
                    styles.itemBlue,
                    styles.itemGlowBlue,
                    { opacity: reveal.focusItemOpacities[idx] ?? 1 },
                  ]}>
                  <Text style={[styles.itemText, styles.textBlue]}>{t}</Text>
                </Animated.View>
              ))}
            </View>

            {gemsEarned > 0 ? (
              <Animated.View
                style={[
                  styles.gemsEarnedCard,
                  {
                    opacity: reveal.gemsOpacity,
                    transform: [{ scale: reveal.gemsScale }],
                  },
                ]}>
                <Animated.Text style={[styles.gemsEarnedEmoji, { transform: [{ scale: reveal.gemPulse }] }]}>
                  💎
                </Animated.Text>
                <Text style={styles.gemsEarnedTitle}>Gems earned</Text>
                <Animated.Text style={[styles.gemsEarnedValue, { transform: [{ scale: milestoneGemPulse }] }]}>
                  +{gemsEarned} gems
                </Animated.Text>
              </Animated.View>
            ) : null}

            <Animated.View
              style={[
                styles.challengeCard,
                {
                  opacity: reveal.challengeOpacity,
                  transform: [{ translateY: reveal.challengeTranslateY }],
                  borderColor: challengeBorderColor,
                },
              ]}>
              <Text style={styles.challengeIcon}>💡</Text>
              <Text style={styles.challengeTitle}>Your Spanish Challenge for Today</Text>
              <Text style={styles.challengeSubtitle}>
                Takes 30 seconds. Builds thinking in Spanish.
              </Text>
              {challengeLoading ? (
                <ActivityIndicator color={palette.accent} style={styles.challengeLoader} />
              ) : dailyChallengeText ? (
                <InteractiveSpanishText
                  text={dailyChallengeText}
                  source="conversation"
                  style={styles.challengeText}
                  contextSentence={dailyChallengeText}
                />
              ) : (
                <Text style={styles.challengeFallback}>
                  Take one thing from today&apos;s lesson and name it in Spanish before bed tonight.
                </Text>
              )}
            </Animated.View>

            <Animated.View style={{ opacity: reveal.practiceOpacity }}>
              <Pressable
                onPress={startDrills}
                disabled={loadingDrills || leavingHome}
                style={({ pressed }) => [
                  styles.practiceButton,
                  loadingDrills && styles.practiceButtonDisabled,
                  pressed && !loadingDrills && styles.practiceButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Practice weak areas">
                {loadingDrills ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.practiceButtonText}>Practice Weak Areas</Text>
                )}
              </Pressable>
            </Animated.View>

            {reveal.complete ? (
              <>
                {lessonType === 'Read' && analysis.breakdown?.reading ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>Reading comprehension 📖</Text>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Score</Text>
                      <Text style={styles.writingValue}>
                        {safeNumber(analysis.breakdown.reading.score)}%
                      </Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Text type</Text>
                      <Text style={styles.writingValue}>
                        {analysis.breakdown.reading.textType ?? '—'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {writing ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>
                      {writing.pendingEvaluation
                        ? '✍️ Writing — evaluation pending when back online ⏳'
                        : lessonType === 'Read'
                          ? 'Comprehension responses'
                          : '✍️ Writing — accuracy'}
                    </Text>
                    {writing.pendingEvaluation ? (
                      <Text style={styles.pendingSpeakingNote}>
                        {writing.feedback ||
                          'Your writing will be marked when you are back online. +2 💎 for completing writing offline.'}
                      </Text>
                    ) : null}
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Grammar</Text>
                      <Text style={styles.writingValue}>
                        {formatWritingMetric(writing.grammarScore, !!writing.pendingEvaluation)}
                      </Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Vocabulary</Text>
                      <Text style={styles.writingValue}>
                        {formatWritingMetric(writing.vocabularyScore, !!writing.pendingEvaluation)}
                      </Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Conjugations</Text>
                      <Text style={styles.writingValue}>
                        {formatWritingMetric(writing.fluencyScore, !!writing.pendingEvaluation)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {speaking ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>
                      {speaking.expired
                        ? '🎤 Speaking — expired'
                        : speaking.pendingEvaluation
                          ? '🎤 Speaking — Pending evaluation when back online ⏳'
                          : '🎤 Speaking — fluency'}
                    </Text>
                    {speaking.pendingEvaluation || speaking.expired ? (
                      <Text style={styles.pendingSpeakingNote}>
                        {speaking.expired
                          ? 'Speaking expired — audio deleted'
                          : `Your ${speaking.exchangeCount} recording${speaking.exchangeCount === 1 ? '' : 's'} will be evaluated when you are back online. +${OFFLINE_SPEAKING_ATTEMPT_GEMS} 💎 for completing speaking offline.`}
                      </Text>
                    ) : (
                      <>
                        <View style={styles.writingRow}>
                          <Text style={styles.writingLabel}>Fluency</Text>
                          <Text style={styles.writingValue}>
                            {formatSpeakingMetric(
                              speaking.fluencyScore,
                              !!speaking.pendingEvaluation,
                              !!speaking.expired,
                            )}
                          </Text>
                        </View>
                        <View style={styles.writingRow}>
                          <Text style={styles.writingLabel}>Confidence</Text>
                          <Text style={styles.writingValue}>
                            {formatSpeakingMetric(
                              speaking.confidenceScore,
                              !!speaking.pendingEvaluation,
                              !!speaking.expired,
                            )}
                          </Text>
                        </View>
                        <View style={styles.writingRow}>
                          <Text style={styles.writingLabel}>Vocabulary range</Text>
                          <Text style={styles.writingValue}>
                            {formatSpeakingMetric(
                              speaking.vocabularyRangeScore,
                              !!speaking.pendingEvaluation,
                              !!speaking.expired,
                            )}
                          </Text>
                        </View>
                        <View style={styles.writingRow}>
                          <Text style={styles.writingLabel}>Natural flow</Text>
                          <Text style={styles.writingValue}>
                            {formatSpeakingMetric(
                              speaking.naturalFlowScore,
                              !!speaking.pendingEvaluation,
                              !!speaking.expired,
                            )}
                          </Text>
                        </View>
                        <View style={styles.writingRow}>
                          <Text style={styles.writingLabel}>Overall</Text>
                          <Text style={styles.writingValue}>
                            {formatSpeakingMetric(
                              speaking.combinedScore,
                              !!speaking.pendingEvaluation,
                              !!speaking.expired,
                            )}
                          </Text>
                        </View>
                      </>
                    )}
                    {speaking.javiFeedback && !speaking.pendingEvaluation && !speaking.expired ? (
                      <Text style={styles.speakingFeedbackPlain}>{speaking.javiFeedback}</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.scoreBlock, styles.supplementaryCard]}>
                  <Text style={styles.scoreLabel}>Correctness score</Text>
                  <Text style={styles.scoreValue}>
                    {scorePending || writing?.pendingEvaluation
                      ? 'Pending ⏳'
                      : `${safeNumber(analysis.correctnessScore)}%`}
                  </Text>
                  <Text style={styles.scoreHint}>grammar + vocabulary</Text>
                </View>

                <View style={[styles.encourageCard, styles.supplementaryCard]}>
                  <Text style={styles.encourageTitle}>Javi says</Text>
                  {(() => {
                    const parts = splitBilingualMessage(analysis.encouragingMessage);
                    return (
                      <>
                        <InteractiveSpanishText
                          text={parts.spanish}
                          source="conversation"
                          style={styles.encourageText}
                          contextSentence={parts.spanish}
                        />
                        {parts.english ? (
                          <Text style={styles.encourageEnglish}>{parts.english}</Text>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.drillHeader}>
              <Text style={styles.drillTitle}>Practice</Text>
              <Text style={styles.drillMeta}>
                Exercise {Math.min(drillIdx + 1, drills.length)} / {drills.length} · Stars {stars}
              </Text>
            </View>

            <View style={styles.drillCard}>
              <Text style={styles.drillPrompt}>{drills[drillIdx]?.prompt ?? ''}</Text>
              {drills[drillIdx]?.expectedAnswer ? (
                <Text style={styles.drillHint}>Hint: keep it short.</Text>
              ) : null}
            </View>

            <View style={styles.answerCard}>
              <AppTextInput
                style={styles.answerInput}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type your answer in Spanish..."
                placeholderTextColor={palette.muted}
                editable={!checking}
                multiline
              />
              <Pressable
                onPress={submitDrillAnswer}
                disabled={checking || !answer.trim()}
                style={({ pressed }) => [
                  styles.checkButton,
                  (checking || !answer.trim()) && styles.checkButtonDisabled,
                  pressed && !checking && answer.trim() && styles.checkButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Check answer">
                {checking ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.checkButtonText}>Check</Text>
                )}
              </Pressable>
            </View>

            {lastFeedback ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackTitle}>Score: {lastFeedback.score}%</Text>
                <Text style={styles.feedbackText}>{lastFeedback.feedback}</Text>
                {lastFeedback.correctAnswer ? (
                  <Text style={styles.correctAnswerText}>
                    Suggested answer: {lastFeedback.correctAnswer}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => {
                    if (drillIdx >= drills.length - 1) {
                      setMode('summary');
                      return;
                    }
                    nextExercise();
                  }}
                  style={({ pressed }) => [
                    styles.nextButton,
                    pressed && styles.nextButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next exercise">
                  <Text style={styles.nextButtonText}>
                    {drillIdx >= drills.length - 1 ? 'Back to Summary' : 'Next'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {mode === 'drills' ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={goHome}
            disabled={leavingHome}
            style={({ pressed }) => [
              styles.primaryButton,
              leavingHome && styles.primaryButtonDisabled,
              pressed && !leavingHome && styles.primaryButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            {leavingHome && saveIndicator ? (
              <Text style={styles.primaryButtonText}>{saveIndicator}</Text>
            ) : leavingHome ? (
              <ActivityIndicator color="#0B0F14" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Back to Home 🏠</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.stickyHomeFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={goHome}
            disabled={leavingHome}
            style={({ pressed }) => [
              styles.stickyHomeButton,
              leavingHome && styles.stickyHomeButtonDisabled,
              pressed && !leavingHome && styles.stickyHomeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            {leavingHome && saveIndicator ? (
              <Text style={styles.stickyHomeButtonText}>{saveIndicator}</Text>
            ) : leavingHome ? (
              <ActivityIndicator color="#0B0F14" size="small" />
            ) : (
              <Text style={styles.stickyHomeButtonText}>Back to Home 🏠</Text>
            )}
          </Pressable>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 24,
  },
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
  gemTopCount: { fontSize: 18, fontWeight: '900', color: '#A78BFA' },
  skipOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
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
    zIndex: 50,
  },
  stickyHomeButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
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
  stickyHomeButtonPressed: { backgroundColor: palette.accentPressed, transform: [{ scale: 0.98 }] },
  stickyHomeButtonDisabled: { opacity: 0.85 },
  stickyHomeButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 28,
    paddingVertical: 12,
  },
  gemsEarnedCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    padding: 18,
    marginBottom: 20,
    gap: 4,
  },
  gemsEarnedEmoji: { fontSize: 36, marginBottom: 4 },
  gemsEarnedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gemsEarnedValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#A78BFA',
  },
  gemsEarnedMilestone: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  supplementaryCard: {
    marginTop: 20,
  },
  secondaryHomeButton: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryHomePressed: { opacity: 0.9 },
  secondaryHomeText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  emptyState: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.muted,
    lineHeight: 20,
  },
  banner: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.blue,
  },
  milestoneCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    padding: 14,
    marginBottom: 16,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.amber,
    marginBottom: 6,
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 20,
  },
  writingCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 16,
  },
  writingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  writingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  writingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  writingValue: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.text,
  },
  readWordsBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    gap: 4,
  },
  readWordsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  readWordLine: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
  culturalNoteBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    gap: 6,
  },
  culturalNoteText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
  speakingNotes: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 8,
    lineHeight: 18,
  },
  speakingFeedbackPlain: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 10,
    lineHeight: 20,
  },
  pendingSpeakingNote: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
  },
  speakingFeedback: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginTop: 8,
    lineHeight: 20,
  },
  scoreBlock: {
    alignItems: 'center',
    marginBottom: 28,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -1,
  },
  scoreHint: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.muted,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 10,
  },
  item: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  itemGreen: {
    backgroundColor: palette.greenBg,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  itemAmber: {
    backgroundColor: palette.amberBg,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  itemBlue: {
    backgroundColor: palette.blueBg,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  itemGlowGreen: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  itemGlowAmber: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  itemGlowBlue: {
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  textGreen: {
    color: palette.green,
  },
  textAmber: {
    color: palette.amber,
  },
  textBlue: {
    color: palette.blue,
  },
  encourageCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 18,
  },
  encourageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  encourageText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
  encourageEnglish: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    marginTop: 6,
  },
  practiceButton: {
    backgroundColor: palette.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  practiceButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  practiceButtonDisabled: {
    opacity: 0.6,
  },
  practiceButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
  challengeCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginTop: 8,
    marginBottom: 18,
  },
  challengeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 4,
  },
  challengeSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: 12,
  },
  challengeText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 24,
  },
  challengeFallback: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  challengeLoader: {
    marginVertical: 8,
  },
  drillHeader: {
    marginBottom: 12,
  },
  drillTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 4,
  },
  drillMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  drillCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  drillPrompt: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 22,
  },
  drillHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  answerCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  answerInput: {
    minHeight: 46,
    maxHeight: 140,
    backgroundColor: palette.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  checkButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonPressed: {
    backgroundColor: palette.accentPressed,
  },
  checkButtonDisabled: {
    opacity: 0.55,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B0F14',
  },
  feedbackCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 22,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 10,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    marginBottom: 10,
  },
  correctAnswerText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 14,
  },
  nextButton: {
    backgroundColor: palette.surfaceBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonPressed: {
    opacity: 0.92,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    backgroundColor: palette.background,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
});
