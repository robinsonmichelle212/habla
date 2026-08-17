import { AppTextInput } from '@/components/app-text-input';
import { GatewayAnimation } from '@/components/gateway-animation';
import { InteractiveSpanishText } from '@/components/interactive-spanish-text';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { useKeyboardScrollToEnd } from '@/components/conversation-input-layout';
import { useDemoMode } from '@/contexts/demo-mode-context';
import { useRecordingCountdown } from '@/hooks/use-recording-countdown';
import {
  evaluateProgressionTest,
  generateProgressionTestQuestions,
} from '@/lib/claude';
import { unlockedTopicsForWeek } from '@/lib/curriculum-drill-gate';
import { addGems } from '@/lib/gems';
import { advanceGrammarCurriculumOneWeek, getGrammarCurriculum } from '@/lib/grammar-curriculum';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import { isDemoModeEnabled } from '@/lib/onboarding-storage';
import {
  buildFallbackProgressionQuestions,
  buildFallbackSpeakingPrompt,
  demoProgressionEvaluation,
  gatherProgressionTestContext,
  getProgressionBlockByKey,
  getProgressionBlockForWeek,
  loadProgressionTests,
  localProgressionEvaluation,
  markProgressionOverrideAdvance,
  mergeProgressionQuestions,
  nextProgressionBlock,
  PROGRESSION_BORDERLINE_SCORE,
  PROGRESSION_PASS_GEMS,
  PROGRESSION_PASS_SCORE,
  PROGRESSION_SPEAKING_SECONDS,
  PROGRESSION_TRY_GEMS,
  progressionTopicSpanishTitle,
  questionTypeInstruction,
  recordProgressionTestResult,
  type ProgressionBlock,
  type ProgressionEvaluation,
  type ProgressionSpeakingPrompt,
  type ProgressionTestQuestion,
} from '@/lib/progression-test';
import {
  ensureRecordingStopped,
  MIN_RECORDING_MS,
  startVoiceRecording,
  stopVoiceRecording,
} from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  red: '#F87171',
};

const JAVI_INTRO =
  'Has trabajado duro estas dos semanas. Ahora vamos a ver lo que has aprendido. 5 preguntas escritas y una tarea oral. Sin prisa — tómate tu tiempo.';

type Stage = 'intro' | 'written' | 'transition' | 'speaking' | 'evaluating' | 'results';
type Outcome = 'pass' | 'borderline' | 'repeat';

export default function ProgressionTestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: demoMode } = useDemoMode();
  const scrollRef = useRef<ScrollView>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [block, setBlock] = useState<ProgressionBlock | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [questions, setQuestions] = useState<ProgressionTestQuestion[]>([]);
  const [speakingPrompt, setSpeakingPrompt] = useState<ProgressionSpeakingPrompt | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [writtenAnswers, setWrittenAnswers] = useState<string[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingTranscript, setSpeakingTranscript] = useState('');
  const [typedSpeech, setTypedSpeech] = useState('');
  const [evaluation, setEvaluation] = useState<ProgressionEvaluation | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [gemsEarned, setGemsEarned] = useState(0);
  const [saving, setSaving] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const finishingRef = useRef(false);
  const voiceStateRef = useRef<VoiceButtonState>('idle');
  voiceStateRef.current = voiceState;

  const reveal = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const transitionOpacity = useRef(new Animated.Value(0)).current;

  const scrollToEnd = useKeyboardScrollToEnd(scrollRef, [stage, questionIdx, answer, typedSpeech]);

  const loadTest = useCallback(async () => {
    const curriculum = await getGrammarCurriculum();
    const nextBlock =
      getProgressionBlockForWeek(curriculum.currentWeek) ?? getProgressionBlockByKey('present_tense');
    if (!nextBlock) return;
    setBlock(nextBlock);
    const tests = await loadProgressionTests();
    const record = tests[nextBlock.key];
    setBestScore(record?.bestScore ?? 0);
    setAttempts(record?.attempts ?? 0);

    const ctx = await gatherProgressionTestContext(nextBlock);
    let generated: ProgressionTestQuestion[] = [];
    let speaking: ProgressionSpeakingPrompt | null = null;
    try {
      const payload = await generateProgressionTestQuestions({
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
        unlockedTopics: unlockedTopicsForWeek(curriculum.currentWeek),
        currentWeek: curriculum.currentWeek,
      });
      generated = payload.questions;
      speaking = payload.speaking;
    } catch {
      generated = [];
    }
    setQuestions(mergeProgressionQuestions(generated, buildFallbackProgressionQuestions(nextBlock)));
    setSpeakingPrompt(speaking ?? buildFallbackSpeakingPrompt(nextBlock));
  }, []);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  useEffect(() => {
    if (stage !== 'transition') return;
    transitionOpacity.setValue(0);
    Animated.timing(transitionOpacity, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setStage('speaking'), 2000);
    return () => clearTimeout(timer);
  }, [stage, transitionOpacity]);

  useEffect(() => {
    if (stage !== 'results' || !evaluation) return;
    reveal.forEach((value) => value.setValue(0));
    setDisplayScore(0);
    const target = evaluation.totalScore;
    const started = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / 600);
      setDisplayScore(Math.round(target * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    Animated.stagger(
      300,
      reveal.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [evaluation, reveal, stage]);

  const current = questions[questionIdx] ?? null;
  const topicTitle = block ? progressionTopicSpanishTitle(block) : '';
  const ready = questions.length === 5 && speakingPrompt != null;

  const goHome = () => {
    void ensureRecordingStopped();
    router.replace('/(tabs)');
  };

  const submitWritten = () => {
    if (!current) return;
    const trimmed = answer.trim();
    if (!trimmed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const nextAnswers = [...writtenAnswers, trimmed];
    setWrittenAnswers(nextAnswers);
    setAnswer('');
    if (questionIdx + 1 >= questions.length) {
      setStage('transition');
    } else {
      setQuestionIdx((i) => i + 1);
    }
  };

  const finishWithTranscript = async (transcript: string) => {
    if (!block || finishingRef.current) return;
    finishingRef.current = true;
    setSpeakingTranscript(transcript);
    setStage('evaluating');
    const demo = demoMode || (await isDemoModeEnabled());
    const ctx = await gatherProgressionTestContext(block);

    let result: ProgressionEvaluation;
    if (demo) {
      result = demoProgressionEvaluation(questions, writtenAnswers);
      await new Promise((resolve) => setTimeout(resolve, 2200));
    } else {
      try {
        result = await evaluateProgressionTest({
          topicName: block.displayName,
          topicSpanish: ctx.weekDef.topicSpanish,
          errorDna: ctx.errorDna.map((e) => ({
            error: e.error,
            example: e.example,
            correction: e.correction,
          })),
          questions: questions.map((q, i) => ({
            prompt: q.prompt,
            type: q.type,
            expectedAnswer: q.expectedAnswer,
            userAnswer: writtenAnswers[i] ?? '',
          })),
          speakingPrompt: speakingPrompt?.spanish ?? '',
          speakingTranscript: transcript,
        });
      } catch {
        result = localProgressionEvaluation({
          questions,
          writtenAnswers,
          speakingTranscript: transcript,
          speakingPrompt: speakingPrompt?.spanish ?? '',
          block,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const nextOutcome: Outcome =
      result.totalScore >= PROGRESSION_PASS_SCORE
        ? 'pass'
        : result.totalScore === PROGRESSION_BORDERLINE_SCORE
          ? 'borderline'
          : 'repeat';
    const gems = result.passed ? PROGRESSION_PASS_GEMS : PROGRESSION_TRY_GEMS;
    setEvaluation(result);
    setOutcome(nextOutcome);
    setGemsEarned(gems);

    if (!demo) {
      const wrong = result.writtenScores.filter((item) => !item.correct);
      try {
        if (gems > 0) await addGems(gems);
      } catch {
        // keep UI gems even if storage fails
      }
      const nextBlock = nextProgressionBlock(block);
      await recordProgressionTestResult({
        block,
        score: result.totalScore,
        writtenScore: result.writtenScores.reduce((sum, item) => sum + item.score, 0),
        speakingScore: result.speakingScore + result.speakingBonus,
        questionsWrong: wrong.map((item) => questions[item.question - 1]?.prompt ?? ''),
        wrongQuestionNumbers: wrong.map((item) => item.question),
        javiFeedback: result.javiFeedback,
        gemsEarned: gems,
        passed: result.passed,
        completed: result.passed,
        advancedTo: result.passed && nextBlock ? nextBlock.displayName : null,
      });
    }

    setStage('results');
  };

  const handlePressIn = async () => {
    if (voiceStateRef.current !== 'idle' || stage !== 'speaking') return;
    if (Platform.OS === 'web') {
      setVoiceError('En la web, escribe tu respuesta abajo.');
      return;
    }
    const permission = await ensureMicPermission();
    if (!permission.granted) {
      setVoiceError(MIC_DENIED_MESSAGE);
      return;
    }
    setVoiceError(null);
    try {
      await startVoiceRecording();
      setVoiceState('recording');
    } catch {
      setVoiceError('No se pudo grabar. Inténtalo de nuevo.');
    }
  };

  const handlePressOut = async () => {
    if (voiceStateRef.current !== 'recording') return;
    const demo = demoMode || (await isDemoModeEnabled());
    if (demo) {
      await ensureRecordingStopped();
      setVoiceState('idle');
      await finishWithTranscript(
        'La semana pasada fui al cine, comí con amigos y hablé con mi hermana.',
      );
      return;
    }
    setVoiceState('processing');
    try {
      const { uri, durationMs } = await stopVoiceRecording();
      if (!uri || durationMs < MIN_RECORDING_MS) {
        setVoiceState('idle');
        setVoiceError('Mantén el botón mientras hablas.');
        return;
      }
      const result = await transcribeSpanishAudio(uri);
      if (!result.ok || !result.text.trim()) {
        setVoiceState('idle');
        setVoiceError('No se entendió. Inténtalo otra vez.');
        finishingRef.current = false;
        return;
      }
      await finishWithTranscript(result.text);
    } catch {
      setVoiceState('idle');
      setVoiceError('Error al transcribir. Inténtalo otra vez.');
      finishingRef.current = false;
    }
  };

  const speakingCountdown = useRecordingCountdown(
    voiceState === 'recording',
    PROGRESSION_SPEAKING_SECONDS,
    () => {
      void handlePressOut();
    },
  );

  const continueToNextTopic = async () => {
    if (!block || saving) return;
    setSaving(true);
    try {
      const demo = demoMode || (await isDemoModeEnabled());
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

  const scoreColor =
    (evaluation?.totalScore ?? 0) >= 7
      ? palette.green
      : (evaluation?.totalScore ?? 0) === 6
        ? palette.amber
        : palette.red;

  return (
    <GatewayAnimation>
      {({ titlePulse }) => (
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
              <Animated.View style={{ transform: [{ scale: titlePulse }] }}>
                <Text style={styles.headerTitle}>Prueba de progresión 📝</Text>
              </Animated.View>
              <View style={styles.back} />
            </View>

            {demoMode ? (
              <View style={styles.demoBanner}>
                <Text style={styles.demoBannerText}>🎭 Demo — sin guardar datos reales</Text>
              </View>
            ) : null}

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[
                styles.scroll,
                { paddingBottom: Math.max(insets.bottom, 28) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive">
              {stage === 'intro' ? (
                <View style={styles.intro}>
                  <Text style={styles.introTitle}>Prueba de progresión 📝</Text>
                  {topicTitle ? <Text style={styles.introTopic}>{topicTitle}</Text> : null}
                  <View style={styles.javiCard}>
                    <InteractiveSpanishText
                      text={JAVI_INTRO}
                      source="conversation"
                      style={styles.javiText}
                      contextSentence={JAVI_INTRO}
                    />
                  </View>
                  <Text style={styles.stat}>Pass mark: 7/10</Text>
                  <Text style={styles.stat}>
                    Your best score on this topic:{' '}
                    {attempts > 0 ? `${bestScore}/10` : 'First attempt'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (!ready) return;
                      setStage('written');
                    }}
                    disabled={!ready}
                    style={[styles.primaryBtn, !ready && styles.btnDisabled]}>
                    <Text style={styles.primaryBtnText}>
                      {ready ? 'Empezar →' : 'Preparando…'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {stage === 'written' && current ? (
                <View style={styles.card}>
                  <Text style={styles.progress}>Pregunta {questionIdx + 1} de 5</Text>
                  <Text style={styles.instruction}>
                    {current.instruction || questionTypeInstruction(current.type)}
                  </Text>
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
                    textAlignVertical="top"
                    onFocus={() => scrollToEnd()}
                  />
                  <Pressable
                    onPress={submitWritten}
                    disabled={!answer.trim()}
                    style={[styles.primaryBtn, !answer.trim() && styles.btnDisabled]}>
                    <Text style={styles.primaryBtnText}>Siguiente →</Text>
                  </Pressable>
                </View>
              ) : null}

              {stage === 'transition' ? (
                <Animated.View style={[styles.transition, { opacity: transitionOpacity }]}>
                  <Text style={styles.transitionEs}>Última parte — ahora hablamos. 🎤</Text>
                  <Text style={styles.transitionEn}>Final part — now we speak.</Text>
                </Animated.View>
              ) : null}

              {stage === 'speaking' && speakingPrompt ? (
                <View style={styles.card}>
                  <InteractiveSpanishText
                    text={speakingPrompt.spanish}
                    source="conversation"
                    style={styles.prompt}
                    contextSentence={speakingPrompt.spanish}
                  />
                  {Platform.OS === 'web' ? (
                    <>
                      <AppTextInput
                        style={styles.input}
                        value={typedSpeech}
                        onChangeText={setTypedSpeech}
                        placeholder="Escribe tu respuesta oral…"
                        placeholderTextColor={palette.muted}
                        multiline
                        textAlignVertical="top"
                      />
                      <Pressable
                        onPress={() => void finishWithTranscript(typedSpeech.trim())}
                        disabled={!typedSpeech.trim()}
                        style={[styles.primaryBtn, !typedSpeech.trim() && styles.btnDisabled]}>
                        <Text style={styles.primaryBtnText}>Enviar →</Text>
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.voiceBlock}>
                      <PushToTalkButton
                        state={voiceState}
                        onPressIn={() => void handlePressIn()}
                        onPressOut={() => void handlePressOut()}
                        countdownSeconds={speakingCountdown.secondsRemaining}
                        countdownProgress={speakingCountdown.progressRemaining}
                      />
                      <Text style={styles.muted}>
                        {voiceState === 'recording'
                          ? `${speakingCountdown.secondsRemaining}s`
                          : 'Mantén el botón y habla (máx. 30s)'}
                      </Text>
                      {voiceError ? <Text style={styles.error}>{voiceError}</Text> : null}
                    </View>
                  )}
                </View>
              ) : null}

              {stage === 'evaluating' ? (
                <View style={styles.centered}>
                  <Text style={styles.saved}>Respuesta guardada ✓</Text>
                  <ActivityIndicator color={palette.accent} size="large" />
                  <Text style={styles.muted}>Calculando resultados...</Text>
                </View>
              ) : null}

              {stage === 'results' && evaluation && outcome ? (
                <View style={styles.results}>
                  <Animated.View style={{ opacity: reveal[0], transform: [{ scale: reveal[0] }] }}>
                    <Text style={[styles.scoreHuge, { color: scoreColor }]}>
                      {displayScore}/10
                    </Text>
                  </Animated.View>
                  <Animated.View style={{ opacity: reveal[1] }}>
                    {outcome === 'pass' ? (
                      <Text style={[styles.status, { color: palette.green }]}>✅ ¡Aprobado!</Text>
                    ) : outcome === 'borderline' ? (
                      <Text style={[styles.status, { color: palette.amber }]}>⚠️ Casi — 6/10</Text>
                    ) : (
                      <Text style={[styles.status, { color: palette.accent }]}>
                        ↩️ Sigue practicando
                      </Text>
                    )}
                  </Animated.View>

                  {evaluation.javiFeedback ? (
                    <Animated.View style={[styles.javiCard, { opacity: reveal[2] }]}>
                      <InteractiveSpanishText
                        text={evaluation.javiFeedback}
                        source="conversation"
                        style={styles.javiText}
                        contextSentence={evaluation.javiFeedback}
                      />
                    </Animated.View>
                  ) : null}

                  <Animated.View style={[styles.card, { opacity: reveal[3] }]}>
                    <Text style={styles.sectionTitle}>Escrito</Text>
                    {evaluation.writtenScores.map((item) => (
                      <View key={item.question} style={styles.breakdownRow}>
                        <Text style={styles.breakdownMark}>{item.correct ? '✅' : '❌'}</Text>
                        <View style={styles.flex}>
                          <Text style={styles.breakdownQ}>
                            {item.question}. {questions[item.question - 1]?.prompt}
                          </Text>
                          {!item.correct ? (
                            <Text style={styles.breakdownAnswer}>→ {item.correctAnswer}</Text>
                          ) : null}
                          {item.feedback ? (
                            <Text style={styles.breakdownFeedback}>{item.feedback}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </Animated.View>

                  <Animated.View style={[styles.card, { opacity: reveal[4] }]}>
                    <Text style={styles.sectionTitle}>Oral — {evaluation.speakingScore}/3</Text>
                    {speakingTranscript ? (
                      <Text style={styles.body}>«{speakingTranscript}»</Text>
                    ) : null}
                    {evaluation.speakingFeedback ? (
                      <Text style={styles.breakdownFeedback}>{evaluation.speakingFeedback}</Text>
                    ) : null}
                  </Animated.View>

                  <Animated.View style={{ opacity: reveal[5] }}>
                    <Text style={styles.gemLine}>
                      {evaluation.passed
                        ? `+${gemsEarned || PROGRESSION_PASS_GEMS} 💎 Aprobado`
                        : `+${gemsEarned || PROGRESSION_TRY_GEMS} 💎 Por intentarlo`}
                      {demoMode ? ' (demo)' : ''}
                    </Text>

                    {outcome === 'pass' ? (
                      <>
                        <Pressable
                          onPress={() => void continueToNextTopic()}
                          disabled={saving}
                          style={styles.primaryBtn}>
                          <Text style={styles.primaryBtnText}>
                            {saving ? '…' : 'Siguiente tema →'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => scrollToEnd()} style={styles.secondaryBtn}>
                          <Text style={styles.secondaryBtnText}>Repasar respuestas</Text>
                        </Pressable>
                      </>
                    ) : null}

                    {outcome === 'borderline' ? (
                      <>
                        <Text style={styles.hint}>Javi recomienda una semana más</Text>
                        <Pressable
                          onPress={() => void continueToNextTopic()}
                          disabled={saving}
                          style={styles.primaryBtn}>
                          <Text style={styles.primaryBtnText}>
                            {saving ? '…' : 'Continuar de todas formas →'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={goHome} style={styles.secondaryBtn}>
                          <Text style={styles.secondaryBtnText}>Repetir el tema</Text>
                        </Pressable>
                      </>
                    ) : null}

                    {outcome === 'repeat' ? (
                      <>
                        <Text style={styles.hint}>Disponible de nuevo en 3 lecciones</Text>
                        <Pressable onPress={goHome} style={styles.primaryBtn}>
                          <Text style={styles.primaryBtnText}>Seguir practicando →</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </Animated.View>
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </GatewayAnimation>
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
  demoBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(251, 146, 60, 0.16)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  demoBannerText: { fontSize: 13, fontWeight: '800', color: '#FB923C', textAlign: 'center' },
  scroll: { paddingHorizontal: 20, gap: 16, flexGrow: 1 },
  intro: { gap: 16, paddingTop: 12 },
  introTitle: { fontSize: 26, fontWeight: '900', color: palette.text, textAlign: 'center' },
  introTopic: { fontSize: 18, fontWeight: '800', color: palette.accent, textAlign: 'center' },
  javiCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  javiText: { fontSize: 16, fontWeight: '600', color: palette.text, lineHeight: 24 },
  stat: { fontSize: 14, fontWeight: '700', color: palette.muted, textAlign: 'center' },
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
  transition: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  transitionEs: { fontSize: 22, fontWeight: '900', color: palette.text, textAlign: 'center' },
  transitionEn: { fontSize: 15, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  voiceBlock: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  muted: { fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  error: { fontSize: 13, fontWeight: '700', color: palette.red, textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 64 },
  saved: { fontSize: 18, fontWeight: '900', color: palette.green },
  results: { gap: 16, alignItems: 'stretch' },
  scoreHuge: { fontSize: 56, fontWeight: '900', textAlign: 'center' },
  status: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: palette.muted, textTransform: 'uppercase' },
  breakdownRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  breakdownMark: { fontSize: 16, marginTop: 2 },
  breakdownQ: { fontSize: 14, fontWeight: '700', color: palette.text, lineHeight: 20 },
  breakdownAnswer: { fontSize: 13, fontWeight: '700', color: palette.green, marginTop: 2 },
  breakdownFeedback: { fontSize: 13, fontWeight: '600', color: palette.muted, marginTop: 2, lineHeight: 18 },
  body: { fontSize: 15, fontWeight: '600', color: palette.text, lineHeight: 22 },
  gemLine: { fontSize: 16, fontWeight: '800', color: palette.green, textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 13, fontWeight: '700', color: palette.muted, textAlign: 'center', marginBottom: 4 },
});
