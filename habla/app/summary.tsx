import { SummaryScoreRing } from '@/components/summary-score-ring';
import { checkDrillAnswer, generateDailyThinkingChallenge, generateDrills } from '@/lib/claude';
import { getRecentChallengeTexts, resolveChallengeTypeForLesson, saveDailyChallenge } from '@/lib/daily-challenge';
import { useSummaryReveal } from '@/hooks/use-summary-reveal';
import { addGems, calculateLessonGems, gemsForStreakMilestone, getTotalGems } from '@/lib/gems';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { getLessonSession, resetLessonSession, setLessonSession } from '@/lib/lesson-session';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import { syncStreakReminder } from '@/lib/streak-notifications';
import { formatLocalDate, updateStreak } from '@/lib/streak';
import { appendLessonHistory, lessonTypeLabel } from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

export default function SummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useMemo(() => getLessonSession(), []);
  const analysis = session.analysis;
  const lessonType = session.lessonType;
  const writing = session.writingEvaluation;
  const speaking = session.speakingEvaluation;
  const didRecordRef = useRef(false);
  const [milestone, setMilestone] = useState<{ day: number } | null>(null);
  const [gemsEarned, setGemsEarned] = useState(0);
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

  useEffect(() => {
    if (didRecordRef.current) return;
    didRecordRef.current = true;

    updateStreak()
      .then(async (res) => {
        const currentStreak = res.state.currentStreak;
        const today = formatLocalDate();
        console.log('Streak saved:', currentStreak)
        console.log('Last session date saved:', today)
        if (res.milestone) setMilestone({ day: res.milestone.day });

        const overallScore =
          analysis?.overallScore ?? analysis?.correctnessScore ?? 0;
        const milestoneDay =
          res.milestone && gemsForStreakMilestone(res.milestone.day) > 0
            ? res.milestone.day
            : null;
        const gems = calculateLessonGems(overallScore, milestoneDay);

        const beforeGems = await getTotalGems();
        setGemsBefore(beforeGems);

        if (gems > 0) {
          try {
            await addGems(gems);
            setGemsEarned(gems);
          } catch {
            // Non-blocking: summary should not fail if gems cannot be saved.
          }
        }

        if (analysis && lessonType) {
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

          const lessonHistoryEntry = {
            date: today,
            overallScore: analysis.overallScore ?? analysis.correctnessScore ?? 0,
            breakdown,
            weakAreas: analysis.weakAreas ?? [],
            focusAreas: analysis.focusAreas ?? [],
            lessonType: lessonTypeLabel(lessonType),
            speaking: speaking
              ? {
                  attempt1Score: speaking.attempt1Score,
                  attempt2Score: speaking.attempt2Score,
                  combinedScore: speaking.combinedScore,
                  improved: speaking.improved,
                  javiFeedback: speaking.javiFeedback,
                }
              : undefined,
          };
          console.log('[Habla] Saving to lessonHistory:', JSON.stringify(lessonHistoryEntry, null, 2));

          void appendLessonHistory(lessonHistoryEntry).catch(() => {
            // Non-blocking: summary should not fail if lesson history cannot be saved.
          });

          if (!didGenerateChallengeRef.current) {
            didGenerateChallengeRef.current = true;
            setChallengeLoading(true);
            void (async () => {
              try {
                const recent = await getRecentChallengeTexts();
                const focus = session.lessonFocus
                  ? lessonFocusLabel(session.lessonFocus)
                  : undefined;
                const grammarTopic =
                  session.lessonFocus?.kind === 'grammar'
                    ? session.lessonFocus.topic
                    : undefined;
                const challengeType = await resolveChallengeTypeForLesson(lessonType);
                const text = await generateDailyThinkingChallenge(
                  {
                    lessonType,
                    lessonFocus: focus,
                    grammarTopic,
                    strongAreas: analysis.strongAreas ?? [],
                    weakAreas: analysis.weakAreas ?? [],
                    focusAreas: analysis.focusAreas ?? [],
                    encouragingMessage: analysis.encouragingMessage,
                    overallScore: analysis.overallScore,
                  },
                  challengeType,
                  recent,
                );
                await saveDailyChallenge(text, challengeType);
                setDailyChallengeText(text);
              } catch {
                setDailyChallengeText(null);
              } finally {
                setChallengeLoading(false);
              }
            })();
          }
        }

        void syncStreakReminder().catch(() => {
          // Non-blocking: reschedule tomorrow's reminder after today's lesson.
        });
      })
      .catch(() => {
        // no-op: streak should not block summary UI
      })
      .finally(() => {
        setStreakHydrated(true);
      });
  }, []);

  const goHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    resetLessonSession();
    router.replace('/(tabs)');
  };

  const startDrills = async () => {
    if (!analysis || !lessonType || loadingDrills) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoadingDrills(true);
    setLastFeedback(null);
    setAnswer('');
    try {
      const exercises = await generateDrills(lessonType, analysis.weakAreas, analysis.focusAreas);
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
  const overallScore = Math.round(analysis?.overallScore ?? 0);
  const revealEnabled = hasAnalysis && mode === 'summary' && streakHydrated;

  const reveal = useSummaryReveal({
    enabled: revealEnabled,
    overallScore,
    strongCount: analysis?.strongAreas.length ?? 0,
    weakCount: analysis?.weakAreas.length ?? 0,
    focusCount: analysis?.focusAreas.length ?? 0,
    gemsEarned,
    gemsBefore,
  });

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
          { paddingBottom: 16 },
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
              />
              <Animated.View style={{ opacity: reveal.scoreOpacity }}>
                <Text style={styles.scoreHint}>
                  {lessonType === 'Read' ? 'comprehension + discussion' : 'writing + speaking combined'}
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
              {analysis.strongAreas.map((t, idx) => (
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
              {analysis.weakAreas.map((t, idx) => (
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
              {analysis.focusAreas.map((t, idx) => (
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

            {gemsEarned > 0 || (milestone && gemsForStreakMilestone(milestone.day) > 0) ? (
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
                <Text style={styles.gemsEarnedValue}>+{gemsEarned} gems</Text>
                {milestone && gemsForStreakMilestone(milestone.day) > 0 ? (
                  <Text style={styles.gemsEarnedMilestone}>
                    Streak day {milestone.day} milestone included 🎉
                  </Text>
                ) : null}
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
                <Text style={styles.challengeText}>{dailyChallengeText}</Text>
              ) : (
                <Text style={styles.challengeFallback}>
                  Take one thing from today&apos;s lesson and name it in Spanish before bed tonight.
                </Text>
              )}
            </Animated.View>

            <Animated.View style={{ opacity: reveal.practiceOpacity }}>
              <Pressable
                onPress={startDrills}
                disabled={loadingDrills}
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

            <Animated.View style={{ opacity: reveal.homeOpacity, marginTop: 10 }}>
              <Pressable
                onPress={goHome}
                style={({ pressed }) => [styles.secondaryHomeButton, pressed && styles.secondaryHomePressed]}
                accessibilityRole="button"
                accessibilityLabel="Back to home">
                <Text style={styles.secondaryHomeText}>Back to Home</Text>
              </Pressable>
            </Animated.View>

            {reveal.complete ? (
              <>
                {lessonType === 'Read' && analysis.breakdown.reading ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>Reading comprehension 📖</Text>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Score</Text>
                      <Text style={styles.writingValue}>
                        {Math.round(analysis.breakdown.reading.score)}%
                      </Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Text type</Text>
                      <Text style={styles.writingValue}>{analysis.breakdown.reading.textType}</Text>
                    </View>
                  </View>
                ) : null}

                {writing ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>
                      {lessonType === 'Read' ? 'Comprehension responses' : 'Writing scores'}
                    </Text>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Grammar</Text>
                      <Text style={styles.writingValue}>{Math.round(writing.grammarScore)}%</Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Vocabulary</Text>
                      <Text style={styles.writingValue}>{Math.round(writing.vocabularyScore)}%</Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Fluency</Text>
                      <Text style={styles.writingValue}>{Math.round(writing.fluencyScore)}%</Text>
                    </View>
                  </View>
                ) : null}

                {speaking ? (
                  <View style={[styles.writingCard, styles.supplementaryCard]}>
                    <Text style={styles.writingTitle}>Speaking scores</Text>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Attempt 1</Text>
                      <Text style={styles.writingValue}>{Math.round(speaking.attempt1Score)}%</Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Attempt 2</Text>
                      <Text style={styles.writingValue}>
                        {speaking.attempt2Score != null
                          ? `${Math.round(speaking.attempt2Score)}%`
                          : 'Skipped'}
                      </Text>
                    </View>
                    <View style={styles.writingRow}>
                      <Text style={styles.writingLabel}>Combined</Text>
                      <Text style={styles.writingValue}>
                        {Math.round(speaking.combinedScore)}%
                        {speaking.improved ? ' · Improved' : ''}
                      </Text>
                    </View>
                    {speaking.javiFeedback ? (
                      <Text style={styles.speakingFeedback}>{speaking.javiFeedback}</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.scoreBlock, styles.supplementaryCard]}>
                  <Text style={styles.scoreLabel}>Correctness score</Text>
                  <Text style={styles.scoreValue}>{Math.round(analysis.correctnessScore)}%</Text>
                  <Text style={styles.scoreHint}>grammar + vocabulary</Text>
                </View>

                <View style={[styles.encourageCard, styles.supplementaryCard]}>
                  <Text style={styles.encourageTitle}>Javi says</Text>
                  <Text style={styles.encourageText}>{analysis.encouragingMessage}</Text>
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
              <TextInput
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
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            <Text style={styles.primaryButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      ) : null}
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
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
});
