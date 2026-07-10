import { AppTextInput } from '@/components/app-text-input';
import { addGems } from '@/lib/gems';
import {
  calculateMilestoneQuizGems,
  completeMilestoneQuiz,
  gatherMilestoneQuizContext,
  getDaysPractisingForQuiz,
  getMilestoneQuizById,
  JAVI_QUIZ_INTRO,
  javiReactionForScore,
  queueMissedQuizItemsForDrills,
  skipMilestoneQuiz,
  storeMilestoneQuizQuestions,
  type MilestoneQuizAnswer,
} from '@/lib/milestone-celebration-quiz';
import {
  checkMilestoneQuizAnswer,
  generateMilestoneCelebrationQuiz,
  type MilestoneQuizQuestion,
} from '@/lib/milestone-quiz-generator';
import { speakEnglish, stopJaviSpeech } from '@/lib/javi-speech';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  gold: '#FBBF24',
  amber: '#F59E0B',
  amberBg: 'rgba(245, 158, 11, 0.12)',
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.12)',
};

type Stage = 'intro' | 'loading' | 'quiz' | 'results' | 'review';

type FeedbackState = {
  correct: boolean;
  explanation: string;
  correctAnswer: string;
  gemsDelta: number;
} | null;

export default function MilestoneQuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const quizId = typeof id === 'string' ? id : '';

  const [stage, setStage] = useState<Stage>('intro');
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof getMilestoneQuizById>>>(null);
  const [questions, setQuestions] = useState<MilestoneQuizQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<MilestoneQuizAnswer[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [locked, setLocked] = useState(false);
  const [daysPractising, setDaysPractising] = useState(1);
  const [gemsEarned, setGemsEarned] = useState(0);
  const didSpeakIntro = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAdvanceTimer = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      stopJaviSpeech();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      if (!quizId) {
        setLoading(false);
        return;
      }
      const rec = await getMilestoneQuizById(quizId);
      setRecord(rec);
      const days = await getDaysPractisingForQuiz();
      setDaysPractising(days);
      if (!rec || rec.status === 'completed') {
        setStage(rec?.status === 'completed' ? 'results' : 'intro');
        if (rec?.questions?.length) setQuestions(rec.questions);
        if (rec?.answers) setAnswers(rec.answers);
        if (rec?.gemsEarned) setGemsEarned(rec.gemsEarned);
        if (rec?.correctCount != null && rec.answers) {
          setAnswers(rec.answers);
        }
        setLoading(false);
        return;
      }
      if (rec.questions?.length) {
        setQuestions(rec.questions);
        setStage('intro');
      }
      setLoading(false);
    })();
  }, [quizId]);

  useEffect(() => {
    if (stage !== 'intro' || didSpeakIntro.current || loading) return;
    didSpeakIntro.current = true;
    void speakEnglish(JAVI_QUIZ_INTRO);
  }, [stage, loading]);

  const loadQuestions = useCallback(async () => {
    if (!record) return;
    setStage('loading');
    try {
      const context = await gatherMilestoneQuizContext(record);
      const generated = await generateMilestoneCelebrationQuiz(
        record.triggerId,
        context,
        record.questionCount,
      );
      setQuestions(generated);
      await storeMilestoneQuizQuestions(record.id, generated);
    } catch {
      setQuestions([]);
    } finally {
      setStage('quiz');
      setQuestionIdx(0);
      setAnswers([]);
      setFeedback(null);
      setTextAnswer('');
    }
  }, [record]);

  const currentQuestion = questions[questionIdx];

  const revealCorrectAnswer = (question: MilestoneQuizQuestion): string => {
    if (question.format === 'multiple_choice' && question.options && question.correctIndex != null) {
      return question.options[question.correctIndex];
    }
    return question.expectedAnswer ?? '';
  };

  const submitAnswer = (userAnswer: string) => {
    if (!currentQuestion || locked) return;
    setLocked(true);
    const correct = checkMilestoneQuizAnswer(currentQuestion, userAnswer);
    const correctAnswer = revealCorrectAnswer(currentQuestion);

    const answerRecord: MilestoneQuizAnswer = {
      questionId: currentQuestion.id,
      userAnswer,
      correct,
    };
    const nextAnswers = [...answers, answerRecord];
    setAnswers(nextAnswers);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    }

    setFeedback({
      correct,
      explanation: currentQuestion.explanation,
      correctAnswer,
      gemsDelta: correct ? 1 : 0,
    });

    clearAdvanceTimer();
    advanceTimer.current = setTimeout(() => {
      setFeedback(null);
      setLocked(false);
      setTextAnswer('');
      if (questionIdx >= questions.length - 1) {
        void finishQuiz(nextAnswers);
        return;
      }
      setQuestionIdx((i) => i + 1);
    }, 2000);
  };

  const finishQuiz = async (finalAnswers: MilestoneQuizAnswer[]) => {
    if (!record) return;
    const correctCount = finalAnswers.filter((a) => a.correct).length;
    const gemBreakdown = calculateMilestoneQuizGems(correctCount, questions.length);
    setGemsEarned(gemBreakdown.totalGems);
    await addGems(gemBreakdown.totalGems);
    await completeMilestoneQuiz(record.id, {
      questions,
      answers: finalAnswers,
      correctCount,
      gemsEarned: gemBreakdown.totalGems,
      daysPractising,
    });

    const misses = finalAnswers
      .filter((a) => !a.correct)
      .map((a) => {
        const q = questions.find((item) => item.id === a.questionId);
        return q
          ? { drillTag: q.drillTag ?? q.prompt.slice(0, 40), explanation: q.explanation }
          : null;
      })
      .filter((m): m is { drillTag: string; explanation: string } => m != null);
    await queueMissedQuizItemsForDrills(misses);
    setStage('results');
  };

  const handleSkip = async () => {
    stopJaviSpeech();
    if (record) await skipMilestoneQuiz(record.id);
    router.replace('/(tabs)');
  };

  const formatUserAnswer = (question: MilestoneQuizQuestion, userAnswer: string): string => {
    if (question.format === 'multiple_choice' && question.options) {
      const idx = Number(userAnswer);
      if (Number.isFinite(idx) && question.options[idx] != null) {
        return question.options[idx];
      }
    }
    return userAnswer;
  };

  const wrongItems = answers
    .filter((a) => !a.correct)
    .map((a) => {
      const question = questions.find((q) => q.id === a.questionId);
      if (!question) return null;
      return { answer: a, question };
    })
    .filter((item): item is { answer: MilestoneQuizAnswer; question: MilestoneQuizQuestion } => item != null);

  const correctCount = answers.filter((a) => a.correct).length;
  const gemBreakdown = calculateMilestoneQuizGems(correctCount, questions.length || record?.questionCount || 10);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.body}>No celebration quiz found.</Text>
          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back to home 🏠</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}>
        {stage === 'intro' ? (
          <View style={styles.block}>
            <Text style={styles.eyebrow}>One more thing before you go... 🎉</Text>
            <View style={styles.quoteCard}>
              <Text style={styles.quoteLabel}>Javi</Text>
              <Text style={styles.quoteText}>{JAVI_QUIZ_INTRO}</Text>
            </View>
            <Pressable onPress={() => void loadQuestions()} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Show me 💪</Text>
            </Pressable>
            <Pressable onPress={() => void handleSkip()} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Maybe later</Text>
            </Pressable>
          </View>
        ) : null}

        {stage === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Javi is picking moments from your lessons...</Text>
          </View>
        ) : null}

        {stage === 'quiz' && currentQuestion ? (
          <View style={styles.block}>
            <Text style={styles.progressMeta}>
              Question {questionIdx + 1} of {questions.length}
            </Text>
            <View style={styles.questionCard}>
              <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>

              {!feedback && currentQuestion.format === 'multiple_choice' && currentQuestion.options ? (
                <View style={styles.optionsWrap}>
                  {currentQuestion.options.map((opt, i) => (
                    <Pressable
                      key={`${opt}-${i}`}
                      disabled={locked}
                      onPress={() => submitAnswer(String(i))}
                      style={({ pressed }) => [styles.optionBtn, pressed && styles.optionPressed]}>
                      <Text style={styles.optionText}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {!feedback && currentQuestion.format === 'text_input' ? (
                <View style={styles.inputWrap}>
                  <AppTextInput
                    style={styles.input}
                    value={textAnswer}
                    onChangeText={setTextAnswer}
                    placeholder="Type your answer…"
                    placeholderTextColor={palette.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!locked}
                    onSubmitEditing={() => {
                      if (textAnswer.trim()) submitAnswer(textAnswer.trim());
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      if (textAnswer.trim()) submitAnswer(textAnswer.trim());
                    }}
                    disabled={!textAnswer.trim() || locked}
                    style={[styles.submitBtn, (!textAnswer.trim() || locked) && styles.submitBtnDisabled]}>
                    <Text style={styles.submitBtnText}>Go</Text>
                  </Pressable>
                </View>
              ) : null}

              {feedback ? (
                <View
                  style={[
                    styles.feedbackCard,
                    feedback.correct ? styles.feedbackCorrect : styles.feedbackWarm,
                  ]}>
                  <Text style={styles.feedbackTitle}>
                    {feedback.correct
                      ? `¡Sí! 💚 +${feedback.gemsDelta} 💎`
                      : `This one's tricky — ${feedback.explanation}`}
                  </Text>
                  {!feedback.correct ? (
                    <Text style={styles.feedbackSub}>
                      The answer was {feedback.correctAnswer}. You&apos;ll get it next time.
                    </Text>
                  ) : (
                    <Text style={styles.feedbackSub}>{feedback.explanation}</Text>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {stage === 'results' ? (
          <View style={styles.block}>
            <Text style={styles.resultsHeadline}>
              {correctCount} out of {questions.length || record.questionCount} Spanish words already
              living in your head 🧠
            </Text>
            <Text style={styles.resultsSub}>
              On day 1 you wouldn&apos;t have known any of these. Today you got {correctCount} right.
            </Text>
            <View style={styles.quoteCard}>
              <Text style={styles.quoteLabel}>Javi</Text>
              <Text style={styles.quoteText}>
                {javiReactionForScore(correctCount, questions.length || record.questionCount)}
              </Text>
            </View>
            <View style={styles.gemCard}>
              <Text style={styles.gemTitle}>💎 +{gemsEarned || gemBreakdown.totalGems} earned</Text>
              <Text style={styles.gemLine}>+5 for attempting</Text>
              <Text style={styles.gemLine}>
                +{gemBreakdown.correctGems} for correct answers
              </Text>
              {gemBreakdown.perfectBonus > 0 ? (
                <Text style={styles.gemLine}>+ {gemBreakdown.perfectBonus} bonus 🌟</Text>
              ) : null}
            </View>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Back to home 🏠</Text>
            </Pressable>
            {wrongItems.length > 0 ? (
              <Pressable onPress={() => setStage('review')} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Review the ones I missed 📖</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {stage === 'review' ? (
          <View style={styles.block}>
            <Text style={styles.reviewTitle}>Ones to revisit</Text>
            {wrongItems.map(({ answer, question }) => (
              <View key={question.id} style={styles.reviewCard}>
                <Text style={styles.reviewQuestion}>{question.prompt}</Text>
                <Text style={styles.reviewMeta}>
                  You answered: {formatUserAnswer(question, answer.userAnswer)}
                </Text>
                <Text style={styles.reviewCorrect}>
                  Correct: {revealCorrectAnswer(question)}
                </Text>
                <Text style={styles.reviewExplanation}>{question.explanation}</Text>
                <Text style={styles.reviewAdded}>Added to your next drill 🎯</Text>
              </View>
            ))}
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Back to home 🏠</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20 },
  block: { gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  eyebrow: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  quoteCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: palette.accent,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 24,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: palette.muted },
  loadingText: { fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  progressMeta: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  questionCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 20,
    gap: 14,
  },
  questionPrompt: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    lineHeight: 26,
  },
  optionsWrap: { gap: 10 },
  optionBtn: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionPressed: { opacity: 0.88, borderColor: palette.accent },
  optionText: { fontSize: 15, fontWeight: '700', color: palette.text },
  inputWrap: { gap: 10 },
  input: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  submitBtn: {
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 15, fontWeight: '900', color: '#0B0F14' },
  feedbackCard: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  feedbackCorrect: {
    backgroundColor: palette.greenBg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  feedbackWarm: {
    backgroundColor: palette.amberBg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  feedbackTitle: { fontSize: 15, fontWeight: '800', color: palette.text, lineHeight: 22 },
  feedbackSub: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
  resultsHeadline: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.gold,
    textAlign: 'center',
    lineHeight: 32,
  },
  resultsSub: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  gemCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 4,
  },
  gemTitle: { fontSize: 18, fontWeight: '900', color: palette.text, marginBottom: 4 },
  gemLine: { fontSize: 14, fontWeight: '600', color: palette.muted },
  reviewTitle: { fontSize: 20, fontWeight: '900', color: palette.text },
  reviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 8,
  },
  reviewQuestion: { fontSize: 15, fontWeight: '800', color: palette.text, lineHeight: 22 },
  reviewMeta: { fontSize: 13, fontWeight: '600', color: palette.muted },
  reviewCorrect: { fontSize: 14, fontWeight: '800', color: palette.gold },
  reviewExplanation: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
  reviewAdded: { fontSize: 12, fontWeight: '800', color: palette.accent, marginTop: 4 },
  body: { fontSize: 15, fontWeight: '600', color: palette.muted, textAlign: 'center' },
});
