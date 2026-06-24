import {
  generateQuickFireQuestions,
  type PrioritizedWeakAreaInput,
  type QuickFireQuestion,
} from '@/lib/claude';
import { GemEarnedToast } from '@/components/gem-earned-toast';
import { addGems, gemsForPracticeDrill } from '@/lib/gems';
import { buildPriorityWeakAreas, getLessonHistory, type PriorityWeakArea } from '@/lib/practice-storage';
import { checkQuickFireAnswer } from '@/lib/quick-fire';
import { syncStreakReminder } from '@/lib/streak-notifications';
import { recordQuickFirePractice } from '@/lib/streak';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.22)',
  red: '#F87171',
  redBg: 'rgba(248, 113, 113, 0.22)',
  gem: '#A78BFA',
};

const TOTAL_QUESTIONS = 10;
const AUTO_ADVANCE_MS = 2000;

type ScreenStage = 'choose' | 'loading' | 'drill' | 'result';

type AnswerRecord = {
  question: QuickFireQuestion;
  userAnswer: string;
  correct: boolean;
};

type FlashState = 'correct' | 'incorrect' | null;

export default function PracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAwardRef = useRef(false);

  const [priorityWeakAreas, setPriorityWeakAreas] = useState<PriorityWeakArea[]>([]);
  const [recentLessonCount, setRecentLessonCount] = useState(0);
  const [loadingWeakAreas, setLoadingWeakAreas] = useState(true);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);

  const [stage, setStage] = useState<ScreenStage>('choose');
  const [questions, setQuestions] = useState<QuickFireQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [flash, setFlash] = useState<FlashState>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState<AnswerRecord[]>([]);

  const [score, setScore] = useState(0);
  const [gemsEarned, setGemsEarned] = useState(0);
  const [showGemToast, setShowGemToast] = useState(false);
  const [streakMaintained, setStreakMaintained] = useState(false);
  const [savingRewards, setSavingRewards] = useState(false);

  const currentQuestion = questions[questionIdx];
  const correctCount = results.filter((r) => r.correct).length;
  const wrongResults = results.filter((r) => !r.correct);

  const prioritizedForPrompt = useMemo<PrioritizedWeakAreaInput[]>(
    () => priorityWeakAreas.map((item) => ({ label: item.label, frequency: item.frequency })),
    [priorityWeakAreas],
  );

  const goHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace('/(tabs)');
  };

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
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
        if (!cancelled) setLoadingWeakAreas(false);
      });
    return () => {
      cancelled = true;
      clearAdvanceTimer();
    };
  }, []);

  const resetDrillState = () => {
    clearAdvanceTimer();
    setQuestionIdx(0);
    setAnswer('');
    setFlash(null);
    setShowCorrectAnswer(null);
    setLocked(false);
    setResults([]);
    setScore(0);
    setGemsEarned(0);
    setShowGemToast(false);
    setStreakMaintained(false);
    didAwardRef.current = false;
  };

  const startQuickFire = useCallback(async () => {
    if (loadingWeakAreas || !priorityWeakAreas.length) {
      Alert.alert('Practice not ready', 'Complete a lesson first to unlock targeted practice.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    resetDrillState();
    setStage('loading');

    try {
      const batch = await generateQuickFireQuestions(prioritizedForPrompt);
      if (batch.length < TOTAL_QUESTIONS) {
        Alert.alert('Could not load questions', 'Try again in a moment.');
        setStage('choose');
        return;
      }
      setQuestions(batch.slice(0, TOTAL_QUESTIONS));
      setStage('drill');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not load questions', message);
      setStage('choose');
    }
  }, [loadingWeakAreas, priorityWeakAreas.length, prioritizedForPrompt]);

  const finishDrill = useCallback((finalResults: AnswerRecord[]) => {
    const finalScore = finalResults.filter((r) => r.correct).length;
    setScore(finalScore);
    setStage('result');
  }, []);

  const advanceQuestion = useCallback(
    (finalResults: AnswerRecord[]) => {
      clearAdvanceTimer();
      setFlash(null);
      setShowCorrectAnswer(null);
      setLocked(false);
      setAnswer('');

      if (questionIdx >= TOTAL_QUESTIONS - 1) {
        finishDrill(finalResults);
        return;
      }

      setQuestionIdx((i) => i + 1);
    },
    [finishDrill, questionIdx],
  );

  const submitAnswer = () => {
    if (!currentQuestion || locked || !answer.trim()) return;

    const trimmed = answer.trim();
    const correct = checkQuickFireAnswer(currentQuestion, trimmed);
    const record: AnswerRecord = {
      question: currentQuestion,
      userAnswer: trimmed,
      correct,
    };
    const nextResults = [...results, record];

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    }

    setResults(nextResults);
    setLocked(true);
    setFlash(correct ? 'correct' : 'incorrect');
    if (!correct) {
      setShowCorrectAnswer(currentQuestion.expectedAnswer);
    }

    advanceTimerRef.current = setTimeout(() => {
      advanceQuestion(nextResults);
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    if (stage !== 'result') return;
    if (didAwardRef.current) return;
    didAwardRef.current = true;

    const finalScore = results.filter((r) => r.correct).length;
    const gems = gemsForPracticeDrill(finalScore, TOTAL_QUESTIONS);
    setGemsEarned(gems);
    if (gems > 0) setShowGemToast(true);
    setSavingRewards(true);

    void (async () => {
      try {
        await addGems(gems);
        const res = await recordQuickFirePractice(finalScore, gems);
        setStreakMaintained(res.streakMaintained);
        if (res.streakMaintained) {
          await syncStreakReminder();
        }
      } catch {
        // Non-blocking: still show end screen.
      } finally {
        setSavingRewards(false);
      }
    })();
  }, [stage, results]);

  const progress = stage === 'drill' ? (questionIdx + (locked ? 1 : 0)) / TOTAL_QUESTIONS : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      {showGemToast ? (
        <GemEarnedToast
          amount={gemsEarned}
          onDone={() => setShowGemToast(false)}
        />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        {stage === 'drill' ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable onPress={goHome} hitSlop={12} accessibilityRole="button">
              <Text style={styles.backLink}>← Home</Text>
            </Pressable>
          </View>

          {stage === 'choose' ? (
            <>
              <Text style={styles.pageTitle}>Practice Mode</Text>
              <Text style={styles.subtitle}>Quick fire · 10 questions</Text>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Priority weak areas</Text>
                {loadingWeakAreas ? (
                  <ActivityIndicator color={palette.muted} />
                ) : priorityWeakAreas.length ? (
                  <View style={styles.chipsWrap}>
                    {priorityWeakAreas.map((w, i) => (
                      <View
                        key={`${w.label}-${i}`}
                        style={[styles.chip, i === 0 ? styles.chipBlue : styles.chipBorder]}>
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
                    Javi is learning your patterns — the more lessons you complete the more targeted
                    your practice gets.
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void startQuickFire()}
                disabled={loadingWeakAreas || !priorityWeakAreas.length}
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.startButtonPressed,
                  !priorityWeakAreas.length && styles.startButtonDisabled,
                ]}>
                <Text style={styles.startButtonText}>Start Quick Fire</Text>
              </Pressable>
            </>
          ) : null}

          {stage === 'loading' ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={styles.loadingText}>Loading 10 questions…</Text>
            </View>
          ) : null}

          {stage === 'drill' && currentQuestion ? (
            <View style={styles.drillWrap}>
              <Text style={styles.questionMeta}>
                Question {questionIdx + 1} of {TOTAL_QUESTIONS}
              </Text>

              <View style={[styles.questionCard, flash === 'correct' && styles.flashGreenCard, flash === 'incorrect' && styles.flashRedCard]}>
                <Text style={styles.questionType}>{formatQuestionType(currentQuestion.type)}</Text>
                <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>

                {flash ? (
                  <View style={styles.flashRow}>
                    <Text style={styles.flashIcon}>{flash === 'correct' ? '✅' : '❌'}</Text>
                    {showCorrectAnswer ? (
                      <Text style={styles.correctReveal}>{showCorrectAnswer}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {!locked ? (
                <View style={styles.inputCard}>
                  <TextInput
                    style={styles.input}
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder="Type your answer…"
                    placeholderTextColor={palette.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submitAnswer}
                  />
                  <Pressable
                    onPress={submitAnswer}
                    disabled={!answer.trim()}
                    style={({ pressed }) => [
                      styles.submitButton,
                      !answer.trim() && styles.submitButtonDisabled,
                      pressed && answer.trim() && styles.submitButtonPressed,
                    ]}>
                    <Text style={styles.submitButtonText}>Go</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {stage === 'result' ? (
            <View style={styles.resultWrap}>
              <Text style={styles.resultTitle}>
                {score >= 7 ? 'Nice work! 🎉' : 'Keep going 💪'}
              </Text>
              <Text style={styles.scoreBig}>
                {score}/{TOTAL_QUESTIONS}
              </Text>

              <View style={styles.gemCard}>
                <Text style={styles.gemLabel}>Gems earned</Text>
                <Text style={styles.gemValue}>💎 {gemsEarned}</Text>
                {score === TOTAL_QUESTIONS ? (
                  <Text style={styles.gemBonus}>Perfect round bonus +4</Text>
                ) : null}
              </View>

              {streakMaintained ? (
                <Text style={styles.streakNote}>🔥 Streak maintained for today</Text>
              ) : (
                <Text style={styles.streakNoteMuted}>Score 7+ to keep your streak</Text>
              )}

              {wrongResults.length ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Review mistakes</Text>
                  {wrongResults.map((r, i) => (
                    <View key={`${r.question.id}-${i}`} style={styles.reviewRow}>
                      <Text style={styles.reviewPrompt}>{r.question.prompt}</Text>
                      <Text style={styles.reviewWrong}>You: {r.userAnswer}</Text>
                      <Text style={styles.reviewRight}>✓ {r.question.expectedAnswer}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {savingRewards ? (
                <ActivityIndicator color={palette.muted} style={{ marginTop: 12 }} />
              ) : score < 7 ? (
                <Pressable
                  onPress={() => void startQuickFire()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}>
                  <Text style={styles.retryButtonText}>Let&apos;s do that again</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={goHome}
                  style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}>
                  <Text style={styles.homeButtonText}>Back to Home</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatQuestionType(type: QuickFireQuestion['type']): string {
  switch (type) {
    case 'fill_blank':
      return 'Fill in the blank';
    case 'translate_word':
      return 'Translate this word';
    case 'correct_mistake':
      return 'Correct the mistake';
    case 'choose_word':
      return 'Choose the right word';
    case 'quick_translate':
      return 'Quick translate';
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  topBar: { marginBottom: 12 },
  backLink: { fontSize: 16, fontWeight: '700', color: palette.accent },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 18,
  },
  progressTrack: {
    height: 4,
    backgroundColor: palette.surfaceBorder,
  },
  progressFill: {
    height: 4,
    backgroundColor: palette.accent,
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
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  chipBlue: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  chipBorder: { backgroundColor: palette.background, borderColor: palette.surfaceBorder },
  chipText: { fontSize: 14, fontWeight: '800', color: palette.text },
  emptyText: { fontSize: 14, fontWeight: '700', color: palette.muted },
  patternHintCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 12,
  },
  patternHintText: { fontSize: 13, fontWeight: '700', color: palette.muted, lineHeight: 18 },
  startButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonPressed: { backgroundColor: palette.accentPressed },
  startButtonDisabled: { opacity: 0.55 },
  startButtonText: { fontSize: 18, fontWeight: '800', color: '#0B0F14' },
  loadingCard: {
    marginTop: 40,
    alignItems: 'center',
    gap: 14,
    padding: 24,
  },
  loadingText: { fontSize: 15, fontWeight: '700', color: palette.muted },
  drillWrap: { marginTop: 8 },
  questionMeta: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  questionCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 20,
    marginBottom: 16,
    minHeight: 160,
    justifyContent: 'center',
  },
  flashGreenCard: { backgroundColor: palette.greenBg, borderColor: 'rgba(52, 211, 153, 0.5)' },
  flashRedCard: { backgroundColor: palette.redBg, borderColor: 'rgba(248, 113, 113, 0.5)' },
  questionType: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  questionPrompt: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    lineHeight: 28,
  },
  flashRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flashIcon: { fontSize: 28 },
  correctReveal: { fontSize: 17, fontWeight: '800', color: palette.text, flex: 1 },
  inputCard: { gap: 10 },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  submitButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonPressed: { backgroundColor: palette.accentPressed },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
  resultWrap: { marginTop: 8 },
  resultTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  scoreBig: {
    fontSize: 56,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  gemCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  gemLabel: { fontSize: 13, fontWeight: '800', color: palette.muted, marginBottom: 6 },
  gemValue: { fontSize: 28, fontWeight: '900', color: palette.gem },
  gemBonus: { fontSize: 13, fontWeight: '700', color: palette.muted, marginTop: 6 },
  streakNote: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
    textAlign: 'center',
    marginBottom: 16,
  },
  streakNoteMuted: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  reviewTitle: { fontSize: 15, fontWeight: '900', color: palette.text, marginBottom: 4 },
  reviewRow: {
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    paddingTop: 10,
    gap: 4,
  },
  reviewPrompt: { fontSize: 14, fontWeight: '700', color: palette.text },
  reviewWrong: { fontSize: 13, fontWeight: '600', color: palette.red },
  reviewRight: { fontSize: 13, fontWeight: '800', color: palette.green },
  retryButton: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 18,
    alignItems: 'center',
  },
  retryButtonPressed: { opacity: 0.9 },
  retryButtonText: { fontSize: 17, fontWeight: '900', color: palette.text },
  homeButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  homeButtonPressed: { backgroundColor: palette.accentPressed },
  homeButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
});
