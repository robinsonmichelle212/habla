import { AppTextInput } from '@/components/app-text-input';
import { useKeyboardScrollToEnd } from '@/components/conversation-input-layout';
import {
  generateProgressionRetakeTip,
  generateProgressionTestQuestions,
} from '@/lib/claude';
import { isDemoModeEnabled } from '@/lib/onboarding-storage';
import { addGems } from '@/lib/gems';
import { advanceGrammarCurriculumOneWeek, getGrammarCurriculum } from '@/lib/grammar-curriculum';
import {
  buildFallbackProgressionQuestions,
  checkProgressionAnswer,
  fallbackRetakeTip,
  gatherProgressionTestContext,
  getProgressionBlockByKey,
  getProgressionBlockForWeek,
  markProgressionOverrideAdvance,
  mergeProgressionQuestions,
  PROGRESSION_BORDERLINE_SCORE,
  PROGRESSION_PASS_GEMS,
  PROGRESSION_PASS_SCORE,
  questionTypeInstruction,
  recordProgressionTestResult,
  type ProgressionBlock,
  type ProgressionTestQuestion,
} from '@/lib/progression-test';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.12)',
  amber: '#FBBF24',
  amberBg: 'rgba(245, 158, 11, 0.12)',
};

type Stage = 'loading' | 'quiz' | 'results';
type Outcome = 'pass' | 'borderline' | 'repeat';

export default function ProgressionTestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [block, setBlock] = useState<ProgressionBlock | null>(null);
  const [questions, setQuestions] = useState<ProgressionTestQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongPrompts, setWrongPrompts] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attemptsAfter, setAttemptsAfter] = useState(0);
  const [encouragingTip, setEncouragingTip] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const finishingRef = useRef(false);

  const scrollToEnd = useKeyboardScrollToEnd(scrollRef, [stage, questionIdx, feedback, answer]);

  const loadTest = useCallback(async () => {
    setStage('loading');
    const curriculum = await getGrammarCurriculum();
    const nextBlock =
      getProgressionBlockForWeek(curriculum.currentWeek) ?? getProgressionBlockByKey('present_tense');
    if (!nextBlock) {
      setStage('quiz');
      return;
    }
    setBlock(nextBlock);
    const ctx = await gatherProgressionTestContext(nextBlock);
    let generated: ProgressionTestQuestion[] = [];
    try {
      generated = await generateProgressionTestQuestions({
        topicName: nextBlock.displayName,
        topicSpanish: ctx.weekDef.topicSpanish,
        weekSummary: ctx.weekDef.summary,
        focusVerbs: ctx.weekDef.focusVerbs,
        errorDna: ctx.errorDna.map((e) => ({
          error: e.error,
          example: e.example,
          correction: e.correction,
        })),
        commonMistakes: ctx.commonMistakes,
      });
    } catch {
      generated = [];
    }
    const merged = mergeProgressionQuestions(
      generated,
      buildFallbackProgressionQuestions(nextBlock),
    );
    setQuestions(merged);
    setQuestionIdx(0);
    setAnswer('');
    setCorrectCount(0);
    setWrongPrompts([]);
    setFeedback(null);
    setStage('quiz');
  }, []);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  const current = questions[questionIdx] ?? null;

  const finishTest = async (finalCorrect: number, finalWrong: string[]) => {
    if (!block || finishingRef.current) return;
    finishingRef.current = true;
    const score = finalCorrect;
    const passed = score >= PROGRESSION_PASS_SCORE;
    const borderline = score === PROGRESSION_BORDERLINE_SCORE;
    const nextOutcome: Outcome = passed ? 'pass' : borderline ? 'borderline' : 'repeat';
    setOutcome(nextOutcome);

    const demo = await isDemoModeEnabled();
    let gems = 0;
    if (passed && !demo) {
      gems = PROGRESSION_PASS_GEMS;
      try {
        await addGems(gems);
      } catch {
        gems = 0;
      }
    }

    const record = await recordProgressionTestResult({
      block,
      score,
      questionsWrong: finalWrong,
      gemsEarned: gems,
      passed,
      completed: passed,
    });
    setAttemptsAfter(record.attempts);

    if (!passed && record.attempts >= 3) {
      const ctx = await gatherProgressionTestContext(block);
      try {
        const tip = await generateProgressionRetakeTip({
          topicName: block.displayName,
          attempts: record.attempts,
          errorDna: ctx.errorDna.map((e) => ({
            error: e.error,
            example: e.example,
            correction: e.correction,
          })),
        });
        setEncouragingTip(tip || fallbackRetakeTip(ctx.errorDna, block));
      } catch {
        setEncouragingTip(fallbackRetakeTip(ctx.errorDna, block));
      }
    }

    setStage('results');
  };

  const submitAnswer = () => {
    if (!current || locked) return;
    const trimmed = answer.trim();
    if (!trimmed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const correct = checkProgressionAnswer(current, trimmed);
    setLocked(true);
    setFeedback({
      correct,
      explanation: correct
        ? current.explanation || '¡Bien!'
        : `${current.explanation || 'Casi.'} Respuesta: ${current.expectedAnswer}`,
    });
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextWrong = correct ? wrongPrompts : [...wrongPrompts, current.prompt];
    setCorrectCount(nextCorrect);
    if (!correct) setWrongPrompts(nextWrong);

    setTimeout(() => {
      setFeedback(null);
      setAnswer('');
      setLocked(false);
      if (questionIdx + 1 >= questions.length) {
        void finishTest(nextCorrect, nextWrong);
      } else {
        setQuestionIdx((i) => i + 1);
      }
    }, 1100);
  };

  const goHome = () => router.replace('/(tabs)');

  const continueToNextTopic = async () => {
    if (!block || saving) return;
    setSaving(true);
    try {
      const demo = await isDemoModeEnabled();
      if (!demo) {
        if (outcome === 'borderline') {
          await markProgressionOverrideAdvance(block.key);
        }
        await advanceGrammarCurriculumOneWeek(block.endWeek);
      }
      goHome();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        <View style={styles.header}>
          <Pressable onPress={goHome} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Prueba de progresión 📝</Text>
          <View style={styles.back} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          {block ? (
            <Text style={styles.subtitle}>
              {block.displayName} — ¿Estás listo para continuar?
            </Text>
          ) : null}

          {stage === 'loading' ? (
            <View style={styles.centered}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={styles.muted}>Javi está preparando tu prueba…</Text>
            </View>
          ) : null}

          {stage === 'quiz' && current ? (
            <View style={styles.card}>
              <Text style={styles.progress}>
                {questionIdx + 1} / {questions.length}
              </Text>
              <Text style={styles.instruction}>{current.instruction || questionTypeInstruction(current.type)}</Text>
              <Text style={styles.prompt}>{current.prompt}</Text>
              <AppTextInput
                style={styles.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Escribe tu respuesta…"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                editable={!locked}
                textAlignVertical="top"
                onFocus={() => scrollToEnd()}
              />
              {feedback ? (
                <View style={[styles.feedback, feedback.correct ? styles.feedbackGood : styles.feedbackWarm]}>
                  <Text style={styles.feedbackText}>
                    {feedback.correct ? '¡Bien! ' : ''}
                    {feedback.explanation}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={submitAnswer}
                  disabled={!answer.trim() || locked}
                  style={[styles.primaryBtn, (!answer.trim() || locked) && styles.btnDisabled]}>
                  <Text style={styles.primaryBtnText}>Comprobar</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {stage === 'results' && outcome === 'pass' ? (
            <View style={styles.card}>
              <Text style={styles.headline}>¡Aprobado! 🎉 {correctCount}/10</Text>
              <Text style={styles.body}>Estás listo para continuar.</Text>
              <Text style={styles.gemLine}>+{PROGRESSION_PASS_GEMS} 💎 gems for passing</Text>
              <Pressable
                onPress={() => void continueToNextTopic()}
                disabled={saving}
                style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>
                  {saving ? '…' : 'Siguiente tema →'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {stage === 'results' && outcome === 'borderline' ? (
            <View style={styles.card}>
              <Text style={styles.headline}>¡Casi! 6/10 — muy cerca.</Text>
              <Text style={styles.body}>Javi recomienda una semana más de práctica.</Text>
              {encouragingTip ? <Text style={styles.tip}>{encouragingTip}</Text> : null}
              <Pressable onPress={goHome} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Repetir el tema</Text>
              </Pressable>
              <Pressable
                onPress={() => void continueToNextTopic()}
                disabled={saving}
                style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Continuar de todas formas →</Text>
              </Pressable>
            </View>
          ) : null}

          {stage === 'results' && outcome === 'repeat' ? (
            <View style={styles.card}>
              <Text style={styles.headline}>Necesitas más práctica. {correctCount}/10</Text>
              <Text style={styles.body}>No te preocupes — una semana más y lo tendrás.</Text>
              {attemptsAfter >= 3 ? (
                <Text style={styles.tip}>
                  Llevas {attemptsAfter} intentos en este tema.{'\n'}
                  Es difícil — eso es normal.{'\n'}
                  {encouragingTip
                    ? `Aquí tienes un consejo específico: ${encouragingTip}`
                    : null}
                </Text>
              ) : null}
              <Pressable onPress={goHome} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Seguir practicando →</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { fontSize: 22, fontWeight: '700', color: palette.accent, width: 28 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: palette.text },
  scroll: { paddingHorizontal: 20, gap: 16, flexGrow: 1 },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 48 },
  muted: { fontSize: 14, fontWeight: '600', color: palette.muted },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 12,
  },
  progress: { fontSize: 12, fontWeight: '800', color: palette.muted },
  instruction: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prompt: { fontSize: 18, fontWeight: '800', color: palette.text, lineHeight: 26 },
  input: {
    minHeight: 88,
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '800', color: palette.muted },
  btnDisabled: { opacity: 0.45 },
  feedback: { borderRadius: 12, padding: 12 },
  feedbackGood: { backgroundColor: palette.greenBg },
  feedbackWarm: { backgroundColor: palette.amberBg },
  feedbackText: { fontSize: 14, fontWeight: '700', color: palette.text, lineHeight: 20 },
  headline: { fontSize: 22, fontWeight: '900', color: palette.text, textAlign: 'center' },
  body: { fontSize: 15, fontWeight: '600', color: palette.muted, textAlign: 'center', lineHeight: 22 },
  gemLine: { fontSize: 16, fontWeight: '800', color: palette.green, textAlign: 'center' },
  tip: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 21 },
});
