import {
  checkPracticeExerciseAnswer,
  generatePracticeExercises,
  type DrillCheckJson,
  type DrillExerciseJson,
  type PrioritizedWeakAreaInput,
  type PracticeDrillType,
} from '@/lib/claude';
import { buildPriorityWeakAreas, getLessonHistory, type PriorityWeakArea } from '@/lib/practice-storage';
import { recordPracticeCompleted } from '@/lib/streak';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  blue: '#60A5FA',
};

type ScreenStage = 'choose' | 'practice' | 'result';

const DRILL_TYPES: Array<{ type: PracticeDrillType; label: string }> = [
  { type: 'grammar', label: 'Grammar drill' },
  { type: 'vocabulary', label: 'Vocabulary drill' },
  { type: 'fluency', label: 'Fluency drill' },
];

export default function PracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [priorityWeakAreas, setPriorityWeakAreas] = useState<PriorityWeakArea[]>([]);
  const [recentLessonCount, setRecentLessonCount] = useState(0);
  const [loadingWeakAreas, setLoadingWeakAreas] = useState(true);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);

  const [stage, setStage] = useState<ScreenStage>('choose');
  const [loadingExercises, setLoadingExercises] = useState(false);

  const [drillType, setDrillType] = useState<PracticeDrillType>('grammar');
  const [targetWeakArea, setTargetWeakArea] = useState<string>('');
  const [exercises, setExercises] = useState<DrillExerciseJson[]>([]);
  const [idx, setIdx] = useState(0);

  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<DrillCheckJson | null>(null);

  const [completedCount, setCompletedCount] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [savingStreak, setSavingStreak] = useState(false);

  const didAwardRef = useRef(false);

  const currentExercise = exercises[idx];
  const isLastExercise = idx >= exercises.length - 1;

  const goHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace('/(tabs)');
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingWeakAreas(true);
    getLessonHistory()
      .then((res) => {
        if (cancelled) return;
        const recent = res.slice(-3);
        const ranked = buildPriorityWeakAreas(recent).slice(0, 3);
        setRecentLessonCount(recent.length);
        setPriorityWeakAreas(ranked);
        setWeakAreasError(ranked.length ? null : 'No weak areas saved yet.');
      })
      .catch(() => {
        if (cancelled) return;
        setPriorityWeakAreas([]);
        setRecentLessonCount(0);
        setWeakAreasError('Could not load weak areas.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingWeakAreas(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startDrill = async (type: PracticeDrillType) => {
    if (loadingExercises || savingStreak) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!priorityWeakAreas.length) {
      Alert.alert('Practice not ready', 'Complete today’s lesson first to unlock weak areas.');
      return;
    }

    const weakArea = priorityWeakAreas[0]?.label ?? 'a key area';
    const prioritizedForPrompt: PrioritizedWeakAreaInput[] = priorityWeakAreas.map((item) => ({
      label: item.label,
      frequency: item.frequency,
    }));

    setLoadingExercises(true);
    setStage('practice');
    setDrillType(type);
    setTargetWeakArea(weakArea);
    setExercises([]);
    setIdx(0);
    setAnswer('');
    setChecking(false);
    setLastFeedback(null);
    setCompletedCount(0);
    setStarsEarned(0);
    didAwardRef.current = false;

    try {
      const exs = await generatePracticeExercises(type, prioritizedForPrompt);
      if (!exs.length) {
        Alert.alert('Could not generate exercises', 'Try again in a moment.');
        setStage('choose');
        return;
      }
      setExercises(exs);
      setIdx(0);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not generate exercises', message);
      setStage('choose');
    } finally {
      setLoadingExercises(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentExercise) return;
    const trimmed = answer.trim();
    if (!trimmed || checking || lastFeedback) return;

    setChecking(true);
    try {
      const res = await checkPracticeExerciseAnswer(drillType, currentExercise, trimmed);
      setLastFeedback(res);
      setCompletedCount((c) => c + 1);
      setStarsEarned((s) => s + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not check answer', message);
    } finally {
      setChecking(false);
    }
  };

  const nextStep = () => {
    if (lastFeedback == null) return;

    if (isLastExercise) {
      setSavingStreak(true);
      setStage('result');
      return;
    }

    setIdx((i) => Math.min(i + 1, Math.max(0, exercises.length - 1)));
    setLastFeedback(null);
    setAnswer('');
  };

  useEffect(() => {
    if (stage !== 'result') return;
    if (didAwardRef.current) return;
    didAwardRef.current = true;

    // Award stars + keep today's streak alive in AsyncStorage.
    setSavingStreak(true);
    recordPracticeCompleted(completedCount)
      .catch(() => {
        // Non-blocking: summary should still render even if storage/update fails.
      })
      .finally(() => {
        setSavingStreak(false);
      });
  }, [stage, completedCount]);

  const title = useMemo(() => 'Practice Mode', []);
  const subtitle = useMemo(() => 'Target your weak areas', []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable
              onPress={goHome}
              accessibilityRole="button"
              hitSlop={12}
              accessibilityLabel="Back to home">
              <Text style={styles.backLink}>← Home</Text>
            </Pressable>
          </View>

          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {stage === 'choose' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Priority weak areas</Text>
                {loadingWeakAreas ? (
                  <ActivityIndicator color={palette.muted} />
                ) : priorityWeakAreas.length ? (
                  <View style={styles.chipsWrap}>
                    {priorityWeakAreas.map((w, i) => (
                      <View key={`${w.label}-${i}`} style={[styles.chip, i === 0 ? styles.chipBlue : styles.chipBorder]}>
                        <Text style={styles.chipText}>
                          {w.frequency >= 3 ? '🔴' : w.frequency === 2 ? '🟡' : '🟢'} {w.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>{weakAreasError ?? '—'}</Text>
                )}
              </View>
              {recentLessonCount < 3 ? (
                <View style={styles.patternHintCard}>
                  <Text style={styles.patternHintText}>
                    Javi is learning your patterns — the more lessons you complete the more targeted your practice gets.
                  </Text>
                </View>
              ) : null}

              <View style={styles.drillButtons}>
                {DRILL_TYPES.map(({ type, label }) => (
                  <Pressable
                    key={type}
                    onPress={() => startDrill(type)}
                    disabled={loadingWeakAreas || loadingExercises || !priorityWeakAreas.length}
                    style={({ pressed }) => [
                      styles.drillButton,
                      pressed && styles.drillButtonPressed,
                      !priorityWeakAreas.length && styles.drillButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={label}>
                    <Text style={styles.drillButtonText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {stage === 'practice' ? (
            <>
              {loadingExercises || !currentExercise ? (
                <View style={styles.centerCard}>
                  <ActivityIndicator color={palette.muted} />
                </View>
              ) : (
                <>
                  <Text style={styles.drillMeta}>
                    {drillType === 'grammar'
                      ? 'Grammar drill'
                      : drillType === 'vocabulary'
                        ? 'Vocabulary drill'
                        : 'Fluency drill'}{' '}
                    · Weak: {targetWeakArea}
                  </Text>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      Exercise {idx + 1} / {exercises.length}
                    </Text>
                    <Text style={styles.prompt}>{currentExercise.prompt}</Text>
                  </View>

                  <View style={styles.inputCard}>
                    <Text style={styles.inputLabel}>Your answer</Text>
                    <TextInput
                      style={styles.input}
                      value={answer}
                      onChangeText={setAnswer}
                      placeholder="Type your answer in Spanish..."
                      placeholderTextColor={palette.muted}
                      multiline
                      editable={!checking}
                    />

                    <Pressable
                      onPress={submitAnswer}
                      disabled={checking || !answer.trim() || !!lastFeedback}
                      style={({ pressed }) => [
                        styles.checkButton,
                        (checking || !answer.trim() || !!lastFeedback) && styles.checkButtonDisabled,
                        pressed && !checking && !lastFeedback && answer.trim() && styles.checkButtonPressed,
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
                      <Text style={styles.feedbackTitle}>Javi’s feedback</Text>
                      <Text style={styles.feedbackText}>
                        {lastFeedback.feedbackSpanish}
                        {'\n\n'}
                        {lastFeedback.feedbackEnglish}
                      </Text>
                      {lastFeedback.correctAnswer ? (
                        <Text style={styles.correctAnswer}>
                          Suggested answer: {lastFeedback.correctAnswer}
                        </Text>
                      ) : null}

                      <Pressable
                        onPress={nextStep}
                        accessibilityRole="button"
                        accessibilityLabel={isLastExercise ? 'Finish practice' : 'Next exercise'}
                        style={({ pressed }) => [
                          styles.nextButton,
                          pressed && styles.nextButtonPressed,
                        ]}>
                        <Text style={styles.nextButtonText}>
                          {isLastExercise ? 'Finish' : 'Next'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {stage === 'result' ? (
            <>
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Practice complete</Text>
                <Text style={styles.resultRow}>
                  Exercises completed: <Text style={styles.resultValue}>{completedCount}</Text>
                </Text>
                <Text style={styles.resultRow}>
                  Stars earned: <Text style={styles.resultValue}>{starsEarned}</Text>
                </Text>
                {savingStreak ? (
                  <View style={{ marginTop: 10 }}>
                    <ActivityIndicator color={palette.muted} />
                  </View>
                ) : null}
              </View>

              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <Pressable
                  onPress={goHome}
                  disabled={savingStreak}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !savingStreak && styles.primaryButtonPressed,
                    savingStreak && styles.primaryButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Done, back to home">
                  <Text style={styles.primaryButtonText}>Done</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBar: {
    marginBottom: 12,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accent,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: palette.text,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 18,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsWrap: {
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipBlue: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  chipBorder: {
    backgroundColor: palette.background,
    borderColor: palette.surfaceBorder,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    lineHeight: 20,
  },
  patternHintCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  patternHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    lineHeight: 18,
  },
  drillButtons: {
    gap: 12,
    marginTop: 6,
    marginBottom: 18,
  },
  drillButton: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  drillButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  drillButtonDisabled: {
    opacity: 0.6,
  },
  drillButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: 0.2,
  },
  centerCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  drillMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
  prompt: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 22,
  },
  inputCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 18,
    gap: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 110,
    maxHeight: 220,
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
    fontWeight: '900',
    color: '#0B0F14',
  },
  feedbackCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 18,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 20,
    marginBottom: 14,
  },
  correctAnswer: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    marginBottom: 14,
    lineHeight: 18,
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
    fontWeight: '900',
    color: palette.text,
  },
  resultCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 18,
    marginTop: 6,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  resultRow: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '900',
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
  },
  primaryButtonPressed: {
    backgroundColor: palette.accentPressed,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
});

