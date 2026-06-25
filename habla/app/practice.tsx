import {
  buildSavedVocabQuestions,
  checkSavedVocabAnswer,
  getActiveVocabulary,
  getSavedVocabulary,
  mixPracticeQuestions,
  practiceQuestionId,
  practiceQuestionPrompt,
  recordVocabDrillAnswer,
  VOCAB_DRILL_SLOTS,
  type PracticeQuestion,
  type VocabMasteryEvent,
} from '@/lib/saved-vocabulary';
import {
  generateQuickFireQuestions,
  generateFluencyDrillQuestions,
  generateWordOrderDrillQuestions,
  type PrioritizedWeakAreaInput,
} from '@/lib/claude';
import { getTopErrorDNA, getWordOrderErrorDNA, hasWordOrderPatterns } from '@/lib/error-dna';
import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { GemEarnedToast } from '@/components/gem-earned-toast';
import { useMilestoneCelebration } from '@/contexts/milestone-context';
import { addGems, gemsForPracticeDrill, practiceDrillEncouragement } from '@/lib/gems';
import { checkStreakMilestones, milestonesAfterDrill } from '@/lib/milestones';
import { buildPriorityWeakAreas, appendDrillHistory, getLessonHistory, type PriorityWeakArea } from '@/lib/practice-storage';
import { checkQuickFireAnswer } from '@/lib/quick-fire';
import { formatWordOrderQuestionType, recordWordOrderDrillMistakes } from '@/lib/word-order-drill';
import { syncStreakReminder } from '@/lib/streak-notifications';
import { formatLocalDate, recordQuickFirePractice } from '@/lib/streak';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

type PracticeDrillKind = 'grammar' | 'vocabulary' | 'fluency' | 'word-order';

const DRILL_OPTIONS: { id: PracticeDrillKind; label: string; emoji: string; hint: string }[] = [
  { id: 'grammar', label: 'Grammar', emoji: '📐', hint: 'Curriculum tense drills' },
  { id: 'vocabulary', label: 'Vocabulary', emoji: '📚', hint: 'Weak areas + saved words' },
  { id: 'fluency', label: 'Fluency', emoji: '🗣️', hint: 'Natural phrases & flow' },
  { id: 'word-order', label: 'Word Order 🔀', emoji: '🔀', hint: 'Sentence structure order' },
];

function parseDrillParam(value: string | undefined): PracticeDrillKind | null {
  if (value === 'grammar' || value === 'vocabulary' || value === 'fluency' || value === 'word-order') {
    return value;
  }
  return null;
}

type ScreenStage = 'choose' | 'loading' | 'drill' | 'result';

type AnswerRecord = {
  practiceQuestion: PracticeQuestion;
  userAnswer: string;
  correct: boolean;
};

type FlashState = 'correct' | 'incorrect' | null;

export default function PracticeScreen() {
  const router = useRouter();
  const { drill, topic } = useLocalSearchParams<{ drill?: string; topic?: string }>();
  const insets = useSafeAreaInsets();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAwardRef = useRef(false);
  const { celebrate } = useMilestoneCelebration();
  const didAutoStartRef = useRef(false);
  const activeDrillRef = useRef<PracticeDrillKind>('vocabulary');

  const initialDrill = parseDrillParam(typeof drill === 'string' ? drill : undefined);

  const [priorityWeakAreas, setPriorityWeakAreas] = useState<PriorityWeakArea[]>([]);
  const [recentLessonCount, setRecentLessonCount] = useState(0);
  const [loadingWeakAreas, setLoadingWeakAreas] = useState(true);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<PracticeDrillKind | null>(initialDrill);
  const [wordOrderSuggested, setWordOrderSuggested] = useState(false);

  const [stage, setStage] = useState<ScreenStage>('choose');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [flash, setFlash] = useState<FlashState>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState<AnswerRecord[]>([]);

  const [score, setScore] = useState(0);
  const [gemsEarned, setGemsEarned] = useState(0);
  const [gemToastAmount, setGemToastAmount] = useState(0);
  const [showGemToast, setShowGemToast] = useState(false);
  const [savingRewards, setSavingRewards] = useState(false);
  const [masteryEvent, setMasteryEvent] = useState<VocabMasteryEvent | null>(null);
  const [vocabExample, setVocabExample] = useState<string | null>(null);

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
        let ranked = buildPriorityWeakAreas(recent).slice(0, 3);
        const focusTopic = typeof topic === 'string' ? topic.trim() : '';
        if (focusTopic) {
          ranked = [
            { label: focusTopic, frequency: 99 },
            ...ranked.filter((r) => r.label.toLowerCase() !== focusTopic.toLowerCase()),
          ].slice(0, 3);
        }
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
  }, [topic]);

  useEffect(() => {
    let cancelled = false;
    hasWordOrderPatterns()
      .then((has) => {
        if (!cancelled) setWordOrderSuggested(has);
      })
      .catch(() => {
        if (!cancelled) setWordOrderSuggested(false);
      });
    return () => {
      cancelled = true;
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
    setMasteryEvent(null);
    setVocabExample(null);
    didAwardRef.current = false;
  };

  const startQuickFire = useCallback(async (drillKind: PracticeDrillKind) => {
    const needsWeakAreas = drillKind === 'vocabulary' || drillKind === 'fluency';

    if (needsWeakAreas && (loadingWeakAreas || !priorityWeakAreas.length)) {
      Alert.alert('Practice not ready', 'Complete a lesson first to unlock targeted practice.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    activeDrillRef.current = drillKind;
    setSelectedDrill(drillKind);
    resetDrillState();
    setStage('loading');

    try {
      if (drillKind === 'word-order') {
        const wordOrderTargets = (await getWordOrderErrorDNA()).slice(0, 2);
        const wordOrderBatch = await generateWordOrderDrillQuestions(TOTAL_QUESTIONS, wordOrderTargets);

        if (wordOrderBatch.length < 1) {
          Alert.alert('Could not load questions', 'Try again in a moment.');
          setStage('choose');
          return;
        }

        setQuestions(
          wordOrderBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      const errorDnaTargets = await getTopErrorDNA(2);

      if (drillKind === 'grammar') {
        const curriculum = await resolveGrammarCurriculum();
        const weekDef = getWeekDefinition(curriculum.currentWeek);
        const grammarBatch = await generateQuickFireQuestions([], TOTAL_QUESTIONS, {
          topic: weekDef.topic,
          weekNumber: weekDef.week,
          focusVerbs: weekDef.focusVerbs,
          includesContrast: weekDef.includesContrast,
        }, errorDnaTargets);

        if (grammarBatch.length < 1) {
          Alert.alert('Could not load questions', 'Try again in a moment.');
          setStage('choose');
          return;
        }

        setQuestions(
          grammarBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      if (drillKind === 'fluency') {
        const fluencyBatch = await generateFluencyDrillQuestions(
          prioritizedForPrompt,
          TOTAL_QUESTIONS,
          errorDnaTargets,
        );

        if (fluencyBatch.length < 1) {
          Alert.alert('Could not load questions', 'Try again in a moment.');
          setStage('choose');
          return;
        }

        setQuestions(
          fluencyBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      const savedWords = await getSavedVocabulary();
      const activeWords = getActiveVocabulary(savedWords);
      const vocabCount = Math.min(VOCAB_DRILL_SLOTS, activeWords.length);
      const weakCount = TOTAL_QUESTIONS - vocabCount;
      const weakBatch = await generateQuickFireQuestions(prioritizedForPrompt, weakCount, undefined, errorDnaTargets);
      const vocabBatch = buildSavedVocabQuestions(activeWords, vocabCount);
      const mixed = mixPracticeQuestions(weakBatch, vocabBatch);

      if (mixed.length < 1) {
        Alert.alert('Could not load questions', 'Try again in a moment.');
        setStage('choose');
        return;
      }
      setQuestions(mixed.slice(0, TOTAL_QUESTIONS));
      setStage('drill');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not load questions', message);
      setStage('choose');
    }
  }, [loadingWeakAreas, priorityWeakAreas.length, prioritizedForPrompt]);

  useEffect(() => {
    if (didAutoStartRef.current) return;
    const autoDrill = parseDrillParam(typeof drill === 'string' ? drill : undefined);
    if (!autoDrill) return;

    if (autoDrill === 'grammar' || autoDrill === 'word-order') {
      didAutoStartRef.current = true;
      void startQuickFire(autoDrill);
      return;
    }
    if (loadingWeakAreas || !priorityWeakAreas.length) return;
    didAutoStartRef.current = true;
    void startQuickFire(autoDrill);
  }, [drill, loadingWeakAreas, priorityWeakAreas.length, startQuickFire]);

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
      setVocabExample(null);
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

  const submitAnswer = async () => {
    if (!currentQuestion || locked || !answer.trim()) return;

    const trimmed = answer.trim();
    let correct = false;

    if (currentQuestion.kind === 'quick') {
      correct = checkQuickFireAnswer(currentQuestion.question, trimmed);
    } else {
      correct = checkSavedVocabAnswer(currentQuestion.question, trimmed);
      const mastery = await recordVocabDrillAnswer(currentQuestion.question.spanish, correct);
      if (mastery) {
        setMasteryEvent(mastery);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }

    const record: AnswerRecord = {
      practiceQuestion: currentQuestion,
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
      const reveal =
        currentQuestion.kind === 'quick'
          ? currentQuestion.question.expectedAnswer
          : currentQuestion.question.expectedAnswer;
      setShowCorrectAnswer(reveal);
    }
    if (currentQuestion.kind === 'vocab') {
      const q = currentQuestion.question;
      setVocabExample(`${q.exampleSpanish}\n${q.exampleEnglish}`);
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
    if (gems > 0) {
      setGemToastAmount(gems);
      setShowGemToast(true);
    }
    setSavingRewards(true);

    void (async () => {
      try {
        await addGems(gems);
        await appendDrillHistory({
          date: formatLocalDate(),
          score: finalScore,
          totalQuestions: TOTAL_QUESTIONS,
          percentage: Math.round((finalScore / TOTAL_QUESTIONS) * 100),
          weakAreasDrilled:
            activeDrillRef.current === 'word-order'
              ? ['Word order']
              : priorityWeakAreas.map((w) => w.label),
          gemsEarned: gems,
          type: 'practice',
        });
        if (activeDrillRef.current === 'word-order') {
          const wordOrderWrong = results
            .filter(
              (r) =>
                !r.correct &&
                r.practiceQuestion.kind === 'quick' &&
                Boolean(r.practiceQuestion.question.wordOrderSubtype),
            )
            .map((r) => ({
              question: (r.practiceQuestion as Extract<PracticeQuestion, { kind: 'quick' }>).question,
              userAnswer: r.userAnswer,
            }));
          await recordWordOrderDrillMistakes(wordOrderWrong);
        }
        const streakState = await recordQuickFirePractice(finalScore, gems);
        const today = formatLocalDate();
        const celebrations = [
          ...(await milestonesAfterDrill(today)),
          ...(await checkStreakMilestones(streakState.state.currentStreak, today)),
        ];
        if (celebrations.length > 0) {
          const milestoneGems = celebrations.reduce((sum, c) => sum + c.gemsAwarded, 0);
          celebrate(celebrations, {
            onAllDismissed: () => {
              if (milestoneGems > 0) {
                setGemsEarned((prev) => prev + milestoneGems);
                setGemToastAmount(milestoneGems);
                setShowGemToast(true);
              }
            },
          });
        }
        await syncStreakReminder();
      } catch {
        // Non-blocking: still show end screen.
      } finally {
        setSavingRewards(false);
      }
    })();
  }, [stage, results, priorityWeakAreas]);

  useEffect(() => {
    if (!masteryEvent) return;
    const t = setTimeout(() => setMasteryEvent(null), 3500);
    return () => clearTimeout(t);
  }, [masteryEvent]);

  const progress = stage === 'drill' ? (questionIdx + (locked ? 1 : 0)) / TOTAL_QUESTIONS : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      {showGemToast ? (
        <GemEarnedToast
          amount={gemToastAmount}
          onDone={() => setShowGemToast(false)}
        />
      ) : null}
      {masteryEvent ? (
        <View style={styles.masteryBanner}>
          <Text style={styles.masteryText}>
            🎉 You&apos;ve mastered &apos;{masteryEvent.spanish}&apos;! +{masteryEvent.gemsAwarded} 💎
          </Text>
        </View>
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

              {wordOrderSuggested ? (
                <Pressable
                  onPress={() => void startQuickFire('word-order')}
                  style={({ pressed }) => [
                    styles.wordOrderSuggestionCard,
                    pressed && styles.wordOrderSuggestionPressed,
                  ]}>
                  <Text style={styles.wordOrderSuggestionText}>
                    Javi noticed some word order patterns — want to drill those? 🔀
                  </Text>
                </Pressable>
              ) : null}

              <Text style={styles.drillPickerTitle}>Choose a drill</Text>
              <View style={styles.drillGrid}>
                {DRILL_OPTIONS.map((option) => {
                  const needsWeakAreas = option.id === 'vocabulary' || option.id === 'fluency';
                  const disabled = needsWeakAreas && (loadingWeakAreas || !priorityWeakAreas.length);
                  const isSelected = selectedDrill === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setSelectedDrill(option.id);
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync();
                        }
                      }}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.drillCard,
                        isSelected && styles.drillCardSelected,
                        disabled && styles.drillCardDisabled,
                        pressed && !disabled && styles.drillCardPressed,
                      ]}>
                      <Text style={styles.drillEmoji}>{option.emoji}</Text>
                      <Text style={styles.drillLabel}>{option.label}</Text>
                      <Text style={styles.drillHint}>{option.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  if (!selectedDrill) {
                    Alert.alert('Pick a drill', 'Choose Grammar, Vocabulary, Fluency, or Word Order first.');
                    return;
                  }
                  void startQuickFire(selectedDrill);
                }}
                disabled={!selectedDrill}
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.startButtonPressed,
                  !selectedDrill && styles.startButtonDisabled,
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
                {currentQuestion.kind === 'quick' && currentQuestion.question.targetsErrorDna ? (
                  <Text style={styles.javiWatchingLabel}>Javi's watching this one 👀</Text>
                ) : null}
                <Text style={styles.questionType}>{formatPracticeQuestionType(currentQuestion)}</Text>
                <Text style={styles.questionPrompt}>{practiceQuestionPrompt(currentQuestion)}</Text>

                {flash ? (
                  <View style={styles.flashRow}>
                    <Text style={styles.flashIcon}>{flash === 'correct' ? '✅' : '❌'}</Text>
                    {showCorrectAnswer ? (
                      <Text style={styles.correctReveal}>{showCorrectAnswer}</Text>
                    ) : null}
                  </View>
                ) : null}
                {flash && vocabExample ? (
                  <View style={styles.exampleBlock}>
                    <Text style={styles.exampleLabel}>Example</Text>
                    <Text style={styles.exampleText}>{vocabExample}</Text>
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
                {practiceDrillEncouragement(score, TOTAL_QUESTIONS)}
              </Text>
              <Text style={styles.scoreBig}>
                {score}/{TOTAL_QUESTIONS}
              </Text>

              <View style={styles.gemCard}>
                <Text style={styles.gemLabel}>Gems earned</Text>
                <Text style={styles.gemValue}>💎 {gemsEarned}</Text>
              </View>

              <Text style={styles.streakNote}>🔥 Streak maintained!</Text>

              {wrongResults.length ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Review mistakes</Text>
                  {wrongResults.map((r, i) => {
                    const prompt = practiceQuestionPrompt(r.practiceQuestion);
                    const expected =
                      r.practiceQuestion.kind === 'quick'
                        ? r.practiceQuestion.question.expectedAnswer
                        : r.practiceQuestion.question.expectedAnswer;
                    return (
                    <View key={`${practiceQuestionId(r.practiceQuestion)}-${i}`} style={styles.reviewRow}>
                      <Text style={styles.reviewPrompt}>{prompt}</Text>
                      <Text style={styles.reviewWrong}>You: {r.userAnswer}</Text>
                      <Text style={styles.reviewRight}>✓ {expected}</Text>
                    </View>
                    );
                  })}
                </View>
              ) : null}

              {savingRewards ? (
                <ActivityIndicator color={palette.muted} style={{ marginTop: 12 }} />
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

function formatPracticeQuestionType(q: PracticeQuestion): string {
  if (q.kind === 'quick' && q.question.wordOrderSubtype) {
    return formatWordOrderQuestionType(q.question);
  }
  if (q.kind === 'vocab') {
    switch (q.question.type) {
      case 'vocab_meaning':
        return 'Saved vocabulary';
      case 'vocab_translate':
        return 'Saved vocabulary';
      case 'vocab_fill_blank':
        return 'Saved vocabulary · fill blank';
      default:
        return 'Saved vocabulary';
    }
  }
  switch (q.question.type) {
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
    case 'conjugate':
      return 'Conjugate';
    case 'choose_tense':
      return 'Choose the tense';
    case 'translate_tense':
      return 'Translate using target tense';
    case 'reorder_words':
      return 'Reorder the words';
    case 'spot_structure_error':
      return 'Fix the structure';
    case 'complete_structure':
      return 'Complete the sentence';
    case 'choose_construction':
      return 'Choose the construction';
    default:
      return 'Grammar drill';
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
  wordOrderSuggestionCard: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    padding: 14,
    marginBottom: 14,
  },
  wordOrderSuggestionPressed: { opacity: 0.88 },
  wordOrderSuggestionText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.gem,
    lineHeight: 20,
    textAlign: 'center',
  },
  drillPickerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  drillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  drillCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 4,
  },
  drillCardSelected: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
  },
  drillCardDisabled: { opacity: 0.45 },
  drillCardPressed: { opacity: 0.9 },
  drillEmoji: { fontSize: 22, marginBottom: 2 },
  drillLabel: { fontSize: 15, fontWeight: '900', color: palette.text },
  drillHint: { fontSize: 11, fontWeight: '600', color: palette.muted, lineHeight: 15 },
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
  javiWatchingLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 8,
  },
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
  masteryBanner: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    zIndex: 50,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  masteryText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.green,
    textAlign: 'center',
  },
  exampleBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(37, 45, 58, 0.8)',
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
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
