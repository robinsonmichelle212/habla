import { checkDrillAnswer, generateDrills } from '@/lib/claude';
import { getLessonSession, resetLessonSession, setLessonSession } from '@/lib/lesson-session';
import { formatLocalDate, updateStreak } from '@/lib/streak';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const didRecordRef = useRef(false);
  const [streakBanner, setStreakBanner] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<{ day: number; starsAwarded: number } | null>(null);

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

  useEffect(() => {
    if (didRecordRef.current) return;
    didRecordRef.current = true;

    updateStreak()
      .then((res) => {
        const currentStreak = res.state.currentStreak;
        const today = formatLocalDate();
        console.log('Streak saved:', currentStreak)
        console.log('Last session date saved:', today)
        if (res.usedFreeze && res.message) setStreakBanner(res.message);
        if (res.milestone) setMilestone(res.milestone);
      })
      .catch(() => {
        // no-op: streak should not block summary UI
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Lesson Complete</Text>

        {streakBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{streakBanner}</Text>
          </View>
        ) : null}

        {milestone ? (
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneTitle}>Streak milestone!</Text>
            <Text style={styles.milestoneText}>
              Day {milestone.day} — +{milestone.starsAwarded} gold star
              {milestone.starsAwarded === 1 ? '' : 's'} ⭐
            </Text>
          </View>
        ) : null}

        {!hasAnalysis ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No summary yet</Text>
            <Text style={styles.emptyText}>
              Go back to the lesson and tap End Lesson to generate your personalised summary.
            </Text>
          </View>
        ) : mode === 'summary' ? (
          <>
            {writing ? (
              <View style={styles.writingCard}>
                <Text style={styles.writingTitle}>Writing scores</Text>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Strong Areas ✅</Text>
              {analysis.strongAreas.map((t, idx) => (
                <View key={`s-${idx}`} style={[styles.item, styles.itemGreen]}>
                  <Text style={[styles.itemText, styles.textGreen]}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weak Areas ⚠️</Text>
              {analysis.weakAreas.map((t, idx) => (
                <View key={`w-${idx}`} style={[styles.item, styles.itemAmber]}>
                  <Text style={[styles.itemText, styles.textAmber]}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Focus Tomorrow 🎯</Text>
              {analysis.focusAreas.map((t, idx) => (
                <View key={`f-${idx}`} style={[styles.item, styles.itemBlue]}>
                  <Text style={[styles.itemText, styles.textBlue]}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.scoreBlock}>
              <Text style={styles.scoreLabel}>Correctness score</Text>
              <Text style={styles.scoreValue}>{Math.round(analysis.correctnessScore)}%</Text>
              <Text style={styles.scoreHint}>grammar + vocabulary</Text>
            </View>

            <View style={styles.encourageCard}>
              <Text style={styles.encourageTitle}>Javi says</Text>
              <Text style={styles.encourageText}>{analysis.encouragingMessage}</Text>
            </View>

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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={goHome}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to home">
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </Pressable>
      </View>
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
    marginBottom: 24,
    textAlign: 'center',
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
