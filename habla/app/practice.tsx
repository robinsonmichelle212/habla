import { AppTextInput } from '@/components/app-text-input';
import { useKeyboardScrollToEnd } from '@/components/conversation-input-layout';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { useDemoMode } from '@/contexts/demo-mode-context';
import { DEMO_DRILLS } from '@/lib/demo-mode';
import {
  practiceQuestionId,
  practiceQuestionPrompt,
  type PracticeQuestion,
  type VocabMasteryEvent,
} from '@/lib/saved-vocabulary';
import {
  generateInterleavedPracticeQuestions,
  generateFluencyDrillQuestions,
  generateWordOrderDrillQuestions,
  generateWritingDrillQuestions,
  evaluateWritingDrillBatch,
  evaluateFluencyDrillResponse,
  type PrioritizedWeakAreaInput,
  type QuickFireQuestion,
} from '@/lib/claude';
import { getTopErrorDNA, getWordOrderErrorDNA } from '@/lib/error-dna';
import {
  getActiveFocusTipsForDrill,
  markFocusTipsUsedInDrill,
} from '@/lib/current-focus-tips';
import {
  getMilestoneQuizDrillQueue,
  queueMilestoneQuizzesFromCelebrations,
} from '@/lib/milestone-celebration-quiz';
import { getWeekDefinition, resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { getCoveredVocabThemesFromStorage } from '@/lib/lesson-focus';
import {
  DRILL_KIND_EMOJI,
  DRILL_OVERRIDE_OPTIONS,
  drillDisplayTitle,
  drillSelectionForOverride,
  selectPracticeDrill,
  type DrillSelection,
  type PracticeDrillKind,
} from '@/lib/practice-drill-selection';
import { GemEarnedToast } from '@/components/gem-earned-toast';
import { useMilestoneCelebration } from '@/contexts/milestone-context';
import {
  addGems,
  fluencyDrillEncouragement,
  gemsForFluencyDrill,
  gemsForPracticeDrill,
  practiceDrillEncouragement,
} from '@/lib/gems';
import { checkIsOnline } from '@/lib/network-status';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import { buildInterleavedDrillPlan } from '@/lib/interleaving';
import { cachePracticeQuestions, getCachedPracticeQuestions } from '@/lib/practice-questions-cache';
import { getOfflineGrammarDrillQuestions } from '@/lib/offline-practice-fallbacks';
import { checkStreakMilestones, milestonesAfterDrill } from '@/lib/milestones';
import { buildPriorityWeakAreas, appendDrillHistory, getDrillHistory, getLessonHistory, type PriorityWeakArea } from '@/lib/practice-storage';
import { checkQuickFireAnswer } from '@/lib/quick-fire';
import { formatWordOrderQuestionType, recordWordOrderDrillMistakes } from '@/lib/word-order-drill';
import { syncStreakReminder } from '@/lib/streak-notifications';
import { formatLocalDate, recordQuickFirePractice } from '@/lib/streak';
import {
  MIN_RECORDING_MS,
  ensureRecordingStopped,
  startVoiceRecording,
  stopVoiceRecording,
} from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
import {
  WRITING_DRILL_SECONDS,
  cacheWritingDrillQuestions,
  clearPendingWritingDrillEvaluation,
  consumeWritingFocusQueue,
  getCachedWritingDrillQuestions,
  getOfflineWritingDrillQuestions,
  getPendingWritingDrillEvaluations,
  hasSeenWritingDrillIntro,
  markWritingDrillIntroSeen,
  queueWritingTypesForGrammarFocus,
  resolveWritingDrillGate,
  savePendingWritingDrillEvaluation,
  writingDrillScore,
  writingTimerBarColor,
  type WritingDrillEvaluationItem,
  type WritingDrillQuestionType,
} from '@/lib/writing-drill';
import { useRecordingCountdown } from '@/hooks/use-recording-countdown';
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
  amber: '#FBBF24',
  amberBg: 'rgba(251, 191, 36, 0.22)',
  red: '#F87171',
  redBg: 'rgba(248, 113, 113, 0.22)',
  gem: '#A78BFA',
};

const TOTAL_QUESTIONS = 10;
const AUTO_ADVANCE_MS = 2000;
const FLUENCY_RECORDING_SECONDS = 10;

const DEMO_FLUENCY_QUESTIONS: QuickFireQuestion[] = [
  '¿Qué ves en tu habitación ahora mismo?',
  'Describe tu día de hoy en tres frases.',
  '¿Cómo llegas normalmente al trabajo?',
  '¿Qué opinas del tiempo hoy?',
  '¿Cuál es tu comida favorita y por qué?',
  '¿Qué harías si tuvieras un día libre mañana?',
  'Estás en un restaurante y el camarero te pregunta qué quieres. ¿Qué dices?',
  'Tu amigo español te pregunta por tu familia. ¿Qué le cuentas?',
  'Ayer fui al mercado y de repente... Continúa la historia.',
  '¿Cómo reaccionarías si tuvieras que mudarte a España mañana?',
].map((prompt, index) => ({
  id: `demo-fluency-${index + 1}`,
  type: [
    'describe_and_respond',
    'opinion_question',
    'situation_response',
    'story_completion',
    'reaction_question',
  ][index % 5] as QuickFireQuestion['type'],
  prompt,
  expectedAnswer: 'Open spoken response',
}));

function parseDrillParam(value: string | undefined): PracticeDrillKind | null {
  if (value === 'vocabulary') return 'writing';
  if (value === 'grammar' || value === 'writing' || value === 'fluency' || value === 'word-order') {
    return value;
  }
  return null;
}

type ScreenStage = 'choose' | 'loading' | 'drill' | 'evaluating' | 'pending_offline' | 'result';

type AnswerRecord = {
  practiceQuestion: PracticeQuestion;
  userAnswer: string;
  correct: boolean;
  partialCredit?: boolean;
  feedback?: string;
  modelAnswer?: string;
};

type FlashState = 'correct' | 'incorrect' | null;

export default function PracticeScreen() {
  const router = useRouter();
  const { drill, topic } = useLocalSearchParams<{ drill?: string; topic?: string }>();
  const insets = useSafeAreaInsets();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAwardRef = useRef(false);
  const { celebrate } = useMilestoneCelebration();
  const { enabled: demoMode } = useDemoMode();
  const didAutoStartRef = useRef(false);
  const activeDrillRef = useRef<PracticeDrillKind>('writing');
  const voiceStateRef = useRef<VoiceButtonState>('idle');
  const handleFluencyPressOutRef = useRef<() => Promise<void>>(async () => {});
  const answerRef = useRef('');
  const resultsRef = useRef<AnswerRecord[]>([]);
  const questionIdxRef = useRef(0);
  const writingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const writingSubmittingRef = useRef(false);
  const submitWritingAnswerRef = useRef<(overrideAnswer?: string) => void>(() => {});
  const drillScrollRef = useRef<ScrollView>(null);

  const initialDrill = parseDrillParam(typeof drill === 'string' ? drill : undefined);

  const [priorityWeakAreas, setPriorityWeakAreas] = useState<PriorityWeakArea[]>([]);
  const [recentLessonCount, setRecentLessonCount] = useState(0);
  const [loadingWeakAreas, setLoadingWeakAreas] = useState(true);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);
  const [javiDrillSelection, setJaviDrillSelection] = useState<DrillSelection | null>(null);
  const [grammarTopicHint, setGrammarTopicHint] = useState<string | undefined>();
  const [manualDrillOverride, setManualDrillOverride] = useState<PracticeDrillKind | null>(initialDrill);
  const isUserOverride =
    manualDrillOverride != null &&
    (!javiDrillSelection || manualDrillOverride !== javiDrillSelection.drill);

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
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [heardText, setHeardText] = useState<string | null>(null);
  const [fluencyFeedback, setFluencyFeedback] = useState<string | null>(null);
  const [writingSecondsLeft, setWritingSecondsLeft] = useState(WRITING_DRILL_SECONDS);
  const [writingPendingNote, setWritingPendingNote] = useState<string | null>(null);
  const fluencyCountdown = useRecordingCountdown(
    voiceState === 'recording',
    FLUENCY_RECORDING_SECONDS,
    () => {
      void handleFluencyPressOutRef.current();
    },
  );

  const currentQuestion = questions[questionIdx];
  const wrongResults = results.filter((r) => !r.correct && !r.partialCredit);
  const isWritingDrill = activeDrillRef.current === 'writing';
  const writingReviewResults = isWritingDrill ? results : [];
  const scrollToEnd = useKeyboardScrollToEnd(drillScrollRef, [
    stage,
    questionIdx,
    currentQuestion?.kind,
    isWritingDrill,
  ]);

  const displayDrillSelection = useMemo((): DrillSelection | null => {
    if (isUserOverride && manualDrillOverride) {
      const override = drillSelectionForOverride(manualDrillOverride, grammarTopicHint);
      return { drill: manualDrillOverride, ...override };
    }
    return javiDrillSelection;
  }, [isUserOverride, manualDrillOverride, grammarTopicHint, javiDrillSelection]);

  const prioritizedForPrompt = useMemo<PrioritizedWeakAreaInput[]>(
    () => priorityWeakAreas.map((item) => ({ label: item.label, frequency: item.frequency })),
    [priorityWeakAreas],
  );

  const activeDrillKind = displayDrillSelection?.drill ?? 'grammar';

  const goHome = () => {
    void ensureRecordingStopped();
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

  const clearWritingTimer = () => {
    if (writingTimerRef.current) {
      clearInterval(writingTimerRef.current);
      writingTimerRef.current = null;
    }
  };

  const setVoiceStateSafe = useCallback((next: VoiceButtonState) => {
    voiceStateRef.current = next;
    setVoiceState(next);
  }, []);

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      clearWritingTimer();
      void ensureRecordingStopped();
    };
  }, []);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    questionIdxRef.current = questionIdx;
  }, [questionIdx]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await checkIsOnline())) return;
      const pending = await getPendingWritingDrillEvaluations();
      if (!pending.length || cancelled) return;
      for (const session of pending) {
        try {
          await evaluateWritingDrillBatch(session.questions, session.answers);
          await clearPendingWritingDrillEvaluation(session.id);
        } catch {
          // Keep pending until a later online session.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingWeakAreas(true);
    void (async () => {
      try {
        const [history, wordOrderErrors, drillHistory, curriculum] = await Promise.all([
          getLessonHistory(),
          getWordOrderErrorDNA(),
          getDrillHistory(),
          resolveGrammarCurriculum(),
        ]);
        if (cancelled) return;

        const recent = history.slice(-3);
        let ranked = buildPriorityWeakAreas(recent).slice(0, 3);
        const focusTopic = typeof topic === 'string' ? topic.trim() : '';
        if (focusTopic) {
          ranked = [
            { label: focusTopic, frequency: 99 },
            ...ranked.filter((r) => r.label.toLowerCase() !== focusTopic.toLowerCase()),
          ].slice(0, 3);
        }

        const weekDef = getWeekDefinition(curriculum.currentWeek);
        setGrammarTopicHint(weekDef.topic);
        setRecentLessonCount(recent.length);
        setPriorityWeakAreas(ranked);
        setWeakAreasError(ranked.length ? null : 'No weak areas saved yet.');
        setJaviDrillSelection(
          selectPracticeDrill({
            weakAreas: ranked,
            recentLessons: recent,
            wordOrderErrors,
            rotateIndex: drillHistory.length,
            grammarTopicHint: weekDef.topic,
          }),
        );
      } catch {
        if (cancelled) return;
        setPriorityWeakAreas([]);
        setRecentLessonCount(0);
        setWeakAreasError('Could not load weak areas.');
        setJaviDrillSelection(null);
      } finally {
        if (!cancelled) setLoadingWeakAreas(false);
      }
    })();

    return () => {
      cancelled = true;
      clearAdvanceTimer();
    };
  }, [topic, demoMode]);

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
    setVoiceStateSafe('idle');
    setVoiceError(null);
    setHeardText(null);
    setFluencyFeedback(null);
    setWritingSecondsLeft(WRITING_DRILL_SECONDS);
    setWritingPendingNote(null);
    writingSubmittingRef.current = false;
    didAwardRef.current = false;
  };

  const startQuickFire = useCallback(async (drillKind: PracticeDrillKind) => {
    const effectiveDrill = drillKind;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    activeDrillRef.current = effectiveDrill;
    resetDrillState();
    setStage('loading');

    try {
      if (demoMode) {
        if (effectiveDrill === 'writing') {
          const gate = await resolveWritingDrillGate();
          const demoQs = getOfflineWritingDrillQuestions(gate);
          setQuestions(demoQs.map((question) => ({ kind: 'writing' as const, question })));
          setStage('drill');
          return;
        }
        const source = effectiveDrill === 'fluency' ? DEMO_FLUENCY_QUESTIONS : DEMO_DRILLS;
        const demoQuestions: PracticeQuestion[] = source.map((d) => ({
          kind: 'quick' as const,
          question: {
            id: d.id,
            type:
              effectiveDrill === 'fluency'
                ? (d as QuickFireQuestion).type
                : ('quick_translate' as const),
            prompt: d.prompt,
            expectedAnswer: d.expectedAnswer ?? '',
          },
        }));
        setQuestions(demoQuestions);
        setStage('drill');
        return;
      }

      const online = await checkIsOnline();
      const curriculum = await resolveGrammarCurriculum();
      const weekDef = getWeekDefinition(curriculum.currentWeek);
      const grammarWeek = effectiveDrill === 'grammar' ? weekDef.week : null;

      const getCachedOrFallback = async (
        drillKind: PracticeDrillKind,
        week: number | null,
        fallback?: () => QuickFireQuestion[],
      ): Promise<QuickFireQuestion[] | null> => {
        if (focusTipsForDrill) return null;
        const cached = await getCachedPracticeQuestions(drillKind, week);
        if (cached?.length) return cached;
        if (!online && fallback) return fallback();
        return null;
      };

      const errorDnaTargets = await getTopErrorDNA(2);
      const focusTipsForDrill = await getActiveFocusTipsForDrill();
      const lessonHistory = await getLessonHistory();
      const coveredVocabThemes = await getCoveredVocabThemesFromStorage();
      const drillPlan = buildInterleavedDrillPlan(
        priorityWeakAreas,
        curriculum,
        lessonHistory,
        grammarTopicHint,
        coveredVocabThemes,
      );
      const interleavedPlan =
        effectiveDrill === 'grammar'
          ? { ...drillPlan, primary: weekDef.topic }
          : drillPlan;

      const loadInterleavedBatch = async (): Promise<QuickFireQuestion[]> => {
        if (!online) {
          const cached = await getCachedPracticeQuestions(effectiveDrill, grammarWeek);
          if (cached?.length) return cached;
          if (effectiveDrill === 'grammar') {
            return getOfflineGrammarDrillQuestions(weekDef.week);
          }
          return [];
        }
        const drillQueue = await getMilestoneQuizDrillQueue();
        const writingFocusQueue = await consumeWritingFocusQueue();
        const combinedTips = [
          ...(focusTipsForDrill?.tips ?? []),
          ...drillQueue,
          ...writingFocusQueue,
        ];
        const batch = await generateInterleavedPracticeQuestions(
          interleavedPlan,
          errorDnaTargets,
          combinedTips.length
            ? {
                tips: combinedTips,
                grammarFocus:
                  focusTipsForDrill?.grammarFocus ??
                  (drillQueue.length ? 'Milestone quiz review' : grammarTopicHint ?? weekDef.topic),
              }
            : null,
        );
        if (batch.length) {
          await cachePracticeQuestions(effectiveDrill, grammarWeek, batch);
          if (focusTipsForDrill) {
            await markFocusTipsUsedInDrill();
          }
        }
        return batch;
      };

      if (effectiveDrill === 'word-order') {
        if (!online) {
          const offlineBatch = await getCachedOrFallback('word-order', null);
          if (!offlineBatch?.length) {
            Alert.alert(
              'Offline',
              'No saved word-order questions yet. Connect once while online to cache a drill set.',
            );
            setStage('choose');
            return;
          }
          setQuestions(
            offlineBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
          );
          setStage('drill');
          return;
        }

        const interleavedBatch = await loadInterleavedBatch();
        if (interleavedBatch.length < 1) {
          const wordOrderTargets = (await getWordOrderErrorDNA()).slice(0, 2);
          const wordOrderBatch = await generateWordOrderDrillQuestions(TOTAL_QUESTIONS, wordOrderTargets);
          if (wordOrderBatch.length < 1) {
            Alert.alert('Could not load questions', 'Try again in a moment.');
            setStage('choose');
            return;
          }
          await cachePracticeQuestions('word-order', null, wordOrderBatch);
          setQuestions(
            wordOrderBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
          );
          setStage('drill');
          return;
        }

        setQuestions(
          interleavedBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      if (effectiveDrill === 'grammar') {
        const interleavedBatch = await loadInterleavedBatch();
        if (!interleavedBatch.length) {
          Alert.alert('Could not load questions', 'Try again in a moment.');
          setStage('choose');
          return;
        }

        setQuestions(
          interleavedBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      if (effectiveDrill === 'fluency') {
        if (Platform.OS === 'web') {
          Alert.alert(
            'Voice required',
            'Fluency drill uses push to talk and is available in the iOS and Android app.',
          );
          setStage('choose');
          return;
        }
        if (!online) {
          setStage('choose');
          Alert.alert(
            'Fluency drill needs internet',
            'Fluency drill needs internet for voice recognition. Switch to Grammar or Writing drill instead? Or try later when online.',
            [
              { text: 'Grammar', onPress: () => void startQuickFire('grammar') },
              { text: 'Writing', onPress: () => void startQuickFire('writing') },
              { text: 'Try later', style: 'cancel' },
            ],
          );
          return;
        }

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
        await cachePracticeQuestions('fluency', null, fluencyBatch);
        setQuestions(
          fluencyBatch.slice(0, TOTAL_QUESTIONS).map((question) => ({ kind: 'quick' as const, question })),
        );
        setStage('drill');
        return;
      }

      if (effectiveDrill === 'writing') {
        const gate = await resolveWritingDrillGate();
        let writingQs = online ? await generateWritingDrillQuestions(errorDnaTargets) : null;

        if (!writingQs?.length) {
          writingQs =
            (await getCachedWritingDrillQuestions()) ?? getOfflineWritingDrillQuestions(gate);
        } else {
          await cacheWritingDrillQuestions(writingQs);
        }

        if (!writingQs.length) {
          Alert.alert('Could not load questions', 'Try again in a moment.');
          setStage('choose');
          return;
        }

        if (!(await hasSeenWritingDrillIntro())) {
          Alert.alert(
            'Writing drill ✍️',
            '30 segundos por pregunta.\nEscribe por instinto.\nLa velocidad construye la fluidez.',
          );
          await markWritingDrillIntroSeen();
        }

        setQuestions(
          writingQs.slice(0, TOTAL_QUESTIONS).map((question) => ({
            kind: 'writing' as const,
            question,
          })),
        );
        setStage('drill');
        return;
      }

      Alert.alert('Could not load questions', 'Unknown drill type.');
      setStage('choose');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not load questions', message);
      setStage('choose');
    }
  }, [demoMode, grammarTopicHint, priorityWeakAreas, prioritizedForPrompt]);

  useEffect(() => {
    if (didAutoStartRef.current) return;
    const autoDrill = parseDrillParam(typeof drill === 'string' ? drill : undefined);
    if (!autoDrill) return;

    if (autoDrill === 'grammar' || autoDrill === 'word-order') {
      didAutoStartRef.current = true;
      void startQuickFire(autoDrill);
      return;
    }
    if (loadingWeakAreas) return;
    didAutoStartRef.current = true;
    void startQuickFire(autoDrill);
  }, [drill, loadingWeakAreas, startQuickFire]);

  const finishDrill = useCallback((finalResults: AnswerRecord[]) => {
    const finalScore = finalResults.filter((r) => r.correct).length;
    setScore(finalScore);
    setStage('result');
  }, []);

  const finishWritingDrill = useCallback(
    async (finalResults: AnswerRecord[]) => {
      clearWritingTimer();
      writingSubmittingRef.current = false;
      setLocked(true);
      setStage('evaluating');

      const writingQuestions = finalResults
        .filter((r) => r.practiceQuestion.kind === 'writing')
        .map((r) => (r.practiceQuestion as Extract<PracticeQuestion, { kind: 'writing' }>).question);
      const answers = finalResults.map((r) => r.userAnswer);

      const online = demoMode ? false : await checkIsOnline();

      if (!online) {
        if (!demoMode) {
          await savePendingWritingDrillEvaluation({
            id: `writing-${Date.now()}`,
            savedAt: Date.now(),
            questions: writingQuestions,
            answers,
          });
        }
        const localResults: AnswerRecord[] = finalResults.map((r) => ({
          ...r,
          correct: Boolean(r.userAnswer.trim()),
          partialCredit: false,
          feedback: r.userAnswer.trim()
            ? 'Respuesta guardada para revisión.'
            : 'Sin respuesta.',
          modelAnswer:
            r.practiceQuestion.kind === 'writing'
              ? r.practiceQuestion.question.expectedAnswer
              : r.practiceQuestion.question.expectedAnswer,
        }));
        setResults(localResults);
        setScore(writingDrillScore(localResults));
        setWritingPendingNote(
          'Tus respuestas han sido guardadas.\nJavi las revisará pronto. ⏳',
        );
        setStage(demoMode ? 'result' : 'pending_offline');
        return;
      }

      try {
        const evaluations = await evaluateWritingDrillBatch(writingQuestions, answers);
        const merged: AnswerRecord[] = finalResults.map((r, i) => {
          const evaluation: WritingDrillEvaluationItem | undefined = evaluations[i];
          return {
            ...r,
            correct: evaluation?.correct === true,
            partialCredit: evaluation?.partialCredit === true,
            feedback: evaluation?.feedback,
            modelAnswer: evaluation?.modelAnswer,
          };
        });
        setResults(merged);
        setScore(writingDrillScore(merged));
        setWritingPendingNote(null);
        setStage('result');
      } catch {
        await savePendingWritingDrillEvaluation({
          id: `writing-${Date.now()}`,
          savedAt: Date.now(),
          questions: writingQuestions,
          answers,
        });
        setWritingPendingNote(
          'Tus respuestas han sido guardadas.\nJavi las revisará pronto. ⏳',
        );
        setStage('pending_offline');
      }
    },
    [demoMode],
  );

  const advanceQuestion = useCallback(
    (finalResults: AnswerRecord[]) => {
      clearAdvanceTimer();
      clearWritingTimer();
      setFlash(null);
      setShowCorrectAnswer(null);
      setVocabExample(null);
      setHeardText(null);
      setFluencyFeedback(null);
      setVoiceError(null);
      setVoiceStateSafe('idle');
      setLocked(false);
      setAnswer('');
      answerRef.current = '';
      writingSubmittingRef.current = false;

      if (questionIdxRef.current >= TOTAL_QUESTIONS - 1) {
        if (activeDrillRef.current === 'writing') {
          void finishWritingDrill(finalResults);
          return;
        }
        finishDrill(finalResults);
        return;
      }

      setQuestionIdx((i) => i + 1);
      if (activeDrillRef.current === 'writing') {
        setWritingSecondsLeft(WRITING_DRILL_SECONDS);
      }
    },
    [finishDrill, finishWritingDrill, setVoiceStateSafe],
  );

  const submitWritingAnswer = useCallback(
    (overrideAnswer?: string) => {
      const q = questions[questionIdxRef.current];
      if (!q || q.kind !== 'writing') return;
      if (writingSubmittingRef.current) return;
      writingSubmittingRef.current = true;
      clearWritingTimer();

      const trimmed = (overrideAnswer ?? answerRef.current).trim();
      const record: AnswerRecord = {
        practiceQuestion: q,
        userAnswer: trimmed,
        correct: false,
      };
      const nextResults = [...resultsRef.current, record];
      resultsRef.current = nextResults;
      setResults(nextResults);
      setLocked(true);
      setAnswer('');
      answerRef.current = '';
      advanceQuestion(nextResults);
    },
    [advanceQuestion, questions],
  );

  const submitAnswer = async () => {
    if (!currentQuestion || locked) return;

    if (currentQuestion.kind === 'writing') {
      if (!answer.trim() && writingSecondsLeft > 0) return;
      submitWritingAnswer(answer);
      return;
    }

    if (!answer.trim()) return;

    const trimmed = answer.trim();
    const correct =
      currentQuestion.kind === 'quick'
        ? checkQuickFireAnswer(currentQuestion.question, trimmed)
        : false;

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
      setShowCorrectAnswer(currentQuestion.question.expectedAnswer);
    }

    advanceTimerRef.current = setTimeout(() => {
      advanceQuestion(nextResults);
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    if (stage !== 'drill' || activeDrillRef.current !== 'writing' || locked) {
      return;
    }

    setWritingSecondsLeft(WRITING_DRILL_SECONDS);
    clearWritingTimer();
    writingTimerRef.current = setInterval(() => {
      setWritingSecondsLeft((prev) => {
        if (prev <= 1) {
          clearWritingTimer();
          // Defer so state update finishes before submit.
          setTimeout(() => submitWritingAnswer(answerRef.current), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearWritingTimer();
  }, [stage, questionIdx, locked, submitWritingAnswer]);

  const recordFluencyResult = useCallback(
    (transcription: string, correct: boolean, feedback: string) => {
      if (!currentQuestion || locked) return;
      const record: AnswerRecord = {
        practiceQuestion: currentQuestion,
        userAnswer: transcription,
        correct,
        feedback,
      };
      const nextResults = [...results, record];

      setResults(nextResults);
      setLocked(true);
      setFlash(correct ? 'correct' : 'incorrect');
      setFluencyFeedback(feedback);
      setVoiceStateSafe('idle');

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(
          correct
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }

      advanceTimerRef.current = setTimeout(() => {
        advanceQuestion(nextResults);
      }, AUTO_ADVANCE_MS);
    },
    [advanceQuestion, currentQuestion, locked, results, setVoiceStateSafe],
  );

  const handleFluencyPressIn = async () => {
    if (
      activeDrillRef.current !== 'fluency' ||
      !currentQuestion ||
      locked ||
      voiceStateRef.current !== 'idle'
    ) {
      return;
    }

    if (!(await checkIsOnline())) {
      setStage('choose');
      Alert.alert(
        'Fluency drill needs internet',
        'Fluency drill needs internet for voice recognition. Switch to Grammar or Writing drill instead? Or try later when online.',
        [
          { text: 'Grammar', onPress: () => void startQuickFire('grammar') },
          { text: 'Writing', onPress: () => void startQuickFire('writing') },
          { text: 'Try later', style: 'cancel' },
        ],
      );
      return;
    }

    const permission = await ensureMicPermission();
    if (!permission.granted) {
      setVoiceError(MIC_DENIED_MESSAGE);
      return;
    }

    setVoiceError(null);
    setHeardText(null);
    setFluencyFeedback(null);
    try {
      await startVoiceRecording();
      setVoiceStateSafe('recording');
    } catch (error) {
      console.log('[Habla] Fluency recording start failed:', error);
      setVoiceError('Could not start the microphone. Please try again.');
      setVoiceStateSafe('idle');
    }
  };

  const handleFluencyPressOut = async () => {
    if (voiceStateRef.current !== 'recording' || !currentQuestion) return;
    setVoiceStateSafe('processing');

    try {
      const { uri, durationMs } = await stopVoiceRecording();
      if (!uri || durationMs < MIN_RECORDING_MS) {
        setVoiceError('Hold the button while you answer.');
        setVoiceStateSafe('idle');
        return;
      }

      if (demoMode) {
        const transcript = 'Hoy estoy practicando español y quiero hablar con más confianza.';
        setHeardText(transcript);
        recordFluencyResult(
          transcript,
          true,
          'Great — you gave a clear, complete response with confident flow.',
        );
        return;
      }

      const transcription = await transcribeSpanishAudio(uri);
      if (!transcription.ok) {
        if (transcription.reason === 'offline') {
          setVoiceStateSafe('idle');
          setStage('choose');
          Alert.alert(
            'Fluency drill needs internet',
            'The connection dropped. Switch to Grammar or Writing drill instead? Or try later when online.',
            [
              { text: 'Grammar', onPress: () => void startQuickFire('grammar') },
              { text: 'Writing', onPress: () => void startQuickFire('writing') },
              { text: 'Try later', style: 'cancel' },
            ],
          );
          return;
        }
        const feedback =
          'Javi could not hear a clear sentence — try speaking a little longer and louder.';
        recordFluencyResult('[No clear transcription]', false, feedback);
        return;
      }

      setHeardText(transcription.text);
      let evaluation;
      try {
        evaluation = await evaluateFluencyDrillResponse(
          practiceQuestionPrompt(currentQuestion),
          transcription.text,
        );
      } catch (error) {
        console.log('[Habla] Fluency evaluation failed:', error);
        const attemptedSentence = transcription.text.trim().split(/\s+/).length >= 4;
        evaluation = {
          correct: attemptedSentence,
          feedback: attemptedSentence
            ? 'Good work — you kept speaking in a complete, relevant sentence.'
            : 'Good attempt — try expanding your answer into one complete sentence.',
        };
      }

      recordFluencyResult(transcription.text, evaluation.correct, evaluation.feedback);
    } catch (error) {
      console.log('[Habla] Fluency response failed:', error);
      await ensureRecordingStopped();
      setVoiceError('Javi could not process that answer. Please try again.');
      setVoiceStateSafe('idle');
    }
  };
  handleFluencyPressOutRef.current = handleFluencyPressOut;

  useEffect(() => {
    if (stage !== 'result') return;
    if (didAwardRef.current) return;
    didAwardRef.current = true;

    const finalScore =
      activeDrillRef.current === 'writing'
        ? writingDrillScore(results)
        : results.filter((r) => r.correct).length;
    const gems = demoMode
      ? 0
      : activeDrillRef.current === 'fluency'
        ? gemsForFluencyDrill(finalScore)
        : gemsForPracticeDrill(Math.round(finalScore), TOTAL_QUESTIONS);
    setScore(finalScore);
    setGemsEarned(gems);
    if (gems > 0) {
      setGemToastAmount(gems);
      setShowGemToast(true);
    }
    setSavingRewards(true);

    if (demoMode) {
      setSavingRewards(false);
      return;
    }

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
              : activeDrillRef.current === 'writing'
                ? ['Writing']
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
              // Queue quiz for later — Keep Going navigates home safely from MilestoneProvider.
              void queueMilestoneQuizzesFromCelebrations(celebrations, {
                achievedDate: today,
              }).catch((quizErr) => {
                console.error('[Habla] milestone quiz queue failed:', quizErr);
              });
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
        style={styles.flex}
        keyboardVerticalOffset={80}>
        {stage === 'drill' ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
        ) : null}

        <ScrollView
          ref={drillScrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1, paddingBottom: Math.max(insets.bottom, isWritingDrill ? 28 : 16) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={styles.topBar}>
            <Pressable onPress={goHome} hitSlop={12} accessibilityRole="button">
              <Text style={styles.backLink}>← Home</Text>
            </Pressable>
          </View>

          {stage === 'choose' ? (
            <>
              <Text style={styles.pageTitle}>Practice Mode</Text>
              <Text style={styles.subtitle}>Quick fire · 10 questions</Text>

              <View style={styles.javiNoticeCard}>
                {loadingWeakAreas || !displayDrillSelection ? (
                  <ActivityIndicator color={palette.gem} />
                ) : isUserOverride ? (
                  <>
                    <Text style={styles.javiNoticeTitle}>
                      You&apos;ve chosen: {drillDisplayTitle(displayDrillSelection.drill)}{' '}
                      {DRILL_KIND_EMOJI[displayDrillSelection.drill]}
                    </Text>
                    <Text style={styles.javiNoticeReason}>{displayDrillSelection.reason}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.javiNoticeTitle}>
                      Javi recommends: {drillDisplayTitle(displayDrillSelection.drill)} 🎯
                    </Text>
                    <Text style={styles.javiNoticeReason}>
                      {displayDrillSelection.reason}
                      {priorityWeakAreas[0]
                        ? ` ${priorityWeakAreas[0].frequency >= 3 ? '🔴' : priorityWeakAreas[0].frequency === 2 ? '🟡' : '🟢'}`
                        : ''}
                    </Text>
                    {priorityWeakAreas.length ? (
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
                      <Text style={styles.javiNoticeEmpty}>{weakAreasError ?? '—'}</Text>
                    )}
                  </>
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

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
                style={styles.pillScroll}>
                {DRILL_OVERRIDE_OPTIONS.map((option) => {
                  const isSelected = activeDrillKind === option.id;
                  const isJaviPick = javiDrillSelection?.drill === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        if (javiDrillSelection && option.id === javiDrillSelection.drill) {
                          setManualDrillOverride(null);
                        } else {
                          setManualDrillOverride(option.id);
                        }
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync();
                        }
                      }}
                      style={({ pressed }) => [
                        styles.drillPill,
                        isSelected && styles.drillPillSelected,
                        pressed && styles.drillPillPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${option.label} drill${isJaviPick ? ', Javi recommended' : ''}`}>
                      <Text style={[styles.drillPillText, isSelected && styles.drillPillTextSelected]}>
                        {option.label} {option.emoji}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={() => void startQuickFire(activeDrillKind)}
                disabled={loadingWeakAreas || !displayDrillSelection}
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.startButtonPressed,
                  (loadingWeakAreas || !displayDrillSelection) && styles.startButtonDisabled,
                ]}>
                <Text style={styles.startButtonText}>Start Drill ▶️</Text>
              </Pressable>
            </>
          ) : null}

          {stage === 'loading' ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={styles.loadingText}>
                {activeDrillRef.current === 'writing'
                  ? 'Preparando 10 preguntas…'
                  : 'Loading 10 questions…'}
              </Text>
            </View>
          ) : null}

          {stage === 'evaluating' ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={styles.loadingText}>Javi está revisando tus respuestas…</Text>
            </View>
          ) : null}

          {stage === 'pending_offline' ? (
            <View style={styles.resultWrap}>
              <Text style={styles.resultTitle}>Escritura guardada</Text>
              <Text style={styles.pendingNote}>
                {writingPendingNote ??
                  'Tus respuestas han sido guardadas.\nJavi las revisará pronto. ⏳'}
              </Text>
              <Pressable
                onPress={goHome}
                style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}>
                <Text style={styles.homeButtonText}>Volver al inicio</Text>
              </Pressable>
            </View>
          ) : null}

          {stage === 'drill' && currentQuestion ? (
            <View style={styles.drillWrap}>
              {isWritingDrill ? (
                <>
                  <View style={styles.writingTimerTrack}>
                    <View
                      style={[
                        styles.writingTimerFill,
                        {
                          width: `${Math.max(0, (writingSecondsLeft / WRITING_DRILL_SECONDS) * 100)}%`,
                          backgroundColor: writingTimerBarColor(writingSecondsLeft),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.questionMeta}>
                    Pregunta {questionIdx + 1} de {TOTAL_QUESTIONS}
                  </Text>
                </>
              ) : (
                <Text style={styles.questionMeta}>
                  Question {questionIdx + 1} of {TOTAL_QUESTIONS}
                </Text>
              )}

              <View
                style={[
                  styles.questionCard,
                  flash === 'correct' && styles.flashGreenCard,
                  flash === 'incorrect' &&
                    (activeDrillRef.current === 'fluency'
                      ? styles.flashAmberCard
                      : styles.flashRedCard),
                ]}>
                {currentQuestion.kind === 'writing' ? (
                  <>
                    <Text style={styles.questionType}>{currentQuestion.question.instruction}</Text>
                    <Text style={styles.questionPrompt}>{currentQuestion.question.prompt}</Text>
                  </>
                ) : (
                  <>
                    {currentQuestion.kind === 'quick' && currentQuestion.question.targetsFocusTip ? (
                      <Text style={styles.focusTipLabel}>🎯 Javi&apos;s focus area</Text>
                    ) : currentQuestion.kind === 'quick' && currentQuestion.question.focusLabel ? (
                      <Text style={styles.focusLabel}>{currentQuestion.question.focusLabel}</Text>
                    ) : null}
                    {currentQuestion.kind === 'quick' && currentQuestion.question.targetsErrorDna ? (
                      <Text style={styles.javiWatchingLabel}>Javi&apos;s watching this one 👀</Text>
                    ) : null}
                    <Text style={styles.questionType}>{formatPracticeQuestionType(currentQuestion)}</Text>
                    <Text style={styles.questionPrompt}>{practiceQuestionPrompt(currentQuestion)}</Text>
                  </>
                )}

                {flash ? (
                  <View style={styles.flashRow}>
                    <Text style={styles.flashIcon}>
                      {flash === 'correct'
                        ? '✅'
                        : activeDrillRef.current === 'fluency'
                          ? '⚠️'
                          : '❌'}
                    </Text>
                    {showCorrectAnswer ? (
                      <Text style={styles.correctReveal}>{showCorrectAnswer}</Text>
                    ) : null}
                  </View>
                ) : null}
                {activeDrillRef.current === 'fluency' && heardText ? (
                  <Text style={styles.heardText}>Javi heard: {heardText}</Text>
                ) : null}
                {activeDrillRef.current === 'fluency' && fluencyFeedback ? (
                  <Text
                    style={[
                      styles.fluencyFeedback,
                      flash === 'correct' ? styles.feedbackGood : styles.feedbackHesitant,
                    ]}>
                    {fluencyFeedback}
                  </Text>
                ) : null}
                {flash && vocabExample ? (
                  <View style={styles.exampleBlock}>
                    <Text style={styles.exampleLabel}>Example</Text>
                    <Text style={styles.exampleText}>{vocabExample}</Text>
                  </View>
                ) : null}
              </View>

              {!locked && activeDrillRef.current === 'fluency' ? (
                <View style={styles.voiceAnswerCard}>
                  <Text style={styles.voiceAnswerLabel}>
                    {voiceState === 'processing'
                      ? 'Javi is listening... 🎤'
                      : 'You have 10 seconds 🎤'}
                  </Text>
                  <PushToTalkButton
                    state={voiceState}
                    disabled={locked}
                    onPressIn={() => void handleFluencyPressIn()}
                    onPressOut={() => void handleFluencyPressOut()}
                    countdownSeconds={fluencyCountdown.secondsRemaining}
                    countdownProgress={fluencyCountdown.progressRemaining}
                  />
                  {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
                </View>
              ) : !locked ? (
                <View style={styles.inputCard}>
                  <AppTextInput
                    style={[styles.input, isWritingDrill && styles.writingInput]}
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder={isWritingDrill ? 'Escribe aquí…' : 'Type your answer…'}
                    placeholderTextColor={palette.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    scrollEnabled
                    blurOnSubmit={false}
                    textAlignVertical={isWritingDrill ? 'top' : 'center'}
                    returnKeyType={isWritingDrill ? 'default' : 'done'}
                    onFocus={() => scrollToEnd()}
                    onSubmitEditing={isWritingDrill ? undefined : submitAnswer}
                  />
                  <Pressable
                    onPress={submitAnswer}
                    disabled={!answer.trim() && !isWritingDrill}
                    style={({ pressed }) => [
                      styles.submitButton,
                      !answer.trim() && !isWritingDrill && styles.submitButtonDisabled,
                      pressed && (answer.trim() || isWritingDrill) && styles.submitButtonPressed,
                    ]}>
                    <Text style={styles.submitButtonText}>{isWritingDrill ? 'Listo' : 'Go'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {stage === 'result' ? (
            <View style={styles.resultWrap}>
              <Text style={styles.resultTitle}>
                {activeDrillRef.current === 'fluency'
                  ? fluencyDrillEncouragement(Math.round(score))
                  : activeDrillRef.current === 'writing'
                    ? practiceDrillEncouragement(Math.round(score), TOTAL_QUESTIONS)
                    : practiceDrillEncouragement(score, TOTAL_QUESTIONS)}
              </Text>
              <Text style={styles.scoreBig}>
                {Number.isInteger(score) ? score : score.toFixed(1)}/{TOTAL_QUESTIONS}
              </Text>

              <View style={styles.gemCard}>
                <Text style={styles.gemLabel}>
                  {isWritingDrill ? 'Gemas ganadas' : 'Gems earned'}
                </Text>
                <Text style={styles.gemValue}>💎 {gemsEarned}</Text>
              </View>

              {writingPendingNote && isWritingDrill ? (
                <Text style={styles.pendingNote}>{writingPendingNote}</Text>
              ) : (
                <Text style={styles.streakNote}>
                  {isWritingDrill ? '🔥 ¡Racha mantenida!' : '🔥 Streak maintained!'}
                </Text>
              )}

              {isWritingDrill && writingReviewResults.length ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Revisión</Text>
                  {writingReviewResults.map((r, i) => {
                    const q =
                      r.practiceQuestion.kind === 'writing'
                        ? r.practiceQuestion.question
                        : null;
                    return (
                      <View
                        key={`${practiceQuestionId(r.practiceQuestion)}-${i}`}
                        style={styles.reviewRow}>
                        <Text style={styles.reviewPrompt}>
                          {q ? `${q.instruction}\n${q.prompt}` : practiceQuestionPrompt(r.practiceQuestion)}
                        </Text>
                        <Text style={styles.reviewWrong}>
                          Tú: {r.userAnswer || '(sin respuesta)'}
                        </Text>
                        <Text style={styles.reviewRight}>
                          ✓ {r.modelAnswer ?? q?.expectedAnswer ?? r.practiceQuestion.question.expectedAnswer}
                        </Text>
                        {r.feedback ? (
                          <Text style={styles.writingFeedback}>{r.feedback}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : wrongResults.length ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Review mistakes</Text>
                  {wrongResults.map((r, i) => {
                    const prompt = practiceQuestionPrompt(r.practiceQuestion);
                    return (
                    <View key={`${practiceQuestionId(r.practiceQuestion)}-${i}`} style={styles.reviewRow}>
                      <Text style={styles.reviewPrompt}>{prompt}</Text>
                      <Text style={styles.reviewWrong}>You: {r.userAnswer}</Text>
                      {activeDrillRef.current === 'fluency' ? (
                        <Text style={styles.reviewRight}>{r.feedback}</Text>
                      ) : (
                        <Text style={styles.reviewRight}>
                          ✓ {r.practiceQuestion.question.expectedAnswer}
                        </Text>
                      )}
                    </View>
                    );
                  })}
                </View>
              ) : null}

              {savingRewards ? (
                <ActivityIndicator color={palette.muted} style={{ marginTop: 12 }} />
              ) : (
                <>
                  {isWritingDrill ? (
                    <Pressable
                      onPress={() => {
                        const weakTypes = writingReviewResults
                          .filter((r) => !r.correct)
                          .map((r) =>
                            r.practiceQuestion.kind === 'writing'
                              ? r.practiceQuestion.question.type
                              : null,
                          )
                          .filter((t): t is WritingDrillQuestionType => Boolean(t));
                        void queueWritingTypesForGrammarFocus(weakTypes).then(() => {
                          Alert.alert(
                            'Listo',
                            'Javi añadirá estos tipos de escritura a tu próximo drill de gramática.',
                          );
                        });
                      }}
                      style={({ pressed }) => [
                        styles.practiceMoreButton,
                        pressed && styles.homeButtonPressed,
                      ]}>
                      <Text style={styles.practiceMoreButtonText}>Practicar más</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={goHome}
                    style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}>
                    <Text style={styles.homeButtonText}>
                      {isWritingDrill ? 'Volver al inicio' : 'Back to Home'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatPracticeQuestionType(q: PracticeQuestion): string {
  if (q.kind === 'writing') {
    return q.question.instruction;
  }
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
    case 'say_more_naturally':
      return 'Say it more naturally';
    case 'choose_natural':
      return 'Which sounds more natural?';
    case 'complete_conversation':
      return 'Complete the conversation';
    case 'rewrite_less_translated':
      return 'Sound less translated';
    case 'native_instead':
      return 'What would a native say?';
    case 'describe_and_respond':
      return 'Describe and respond';
    case 'opinion_question':
      return 'Share your opinion';
    case 'situation_response':
      return 'Respond to the situation';
    case 'story_completion':
      return 'Continue the story';
    case 'reaction_question':
      return 'React naturally';
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
  writingTimerTrack: {
    height: 4,
    backgroundColor: palette.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  writingTimerFill: {
    height: 4,
    borderRadius: 2,
  },
  pendingNote: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 18,
  },
  writingFeedback: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.blue,
    marginTop: 4,
  },
  practiceMoreButton: {
    marginTop: 12,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  practiceMoreButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.accent,
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
  javiNoticeCard: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  javiNoticeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.gem,
    lineHeight: 21,
    textAlign: 'center',
  },
  javiNoticeReason: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  javiNoticeEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  pillScroll: {
    marginBottom: 4,
    flexGrow: 0,
  },
  pillRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  drillPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  drillPillSelected: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.16)',
  },
  drillPillPressed: { opacity: 0.9 },
  drillPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.muted,
  },
  drillPillTextSelected: {
    color: palette.text,
  },
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
  flashAmberCard: { backgroundColor: palette.amberBg, borderColor: 'rgba(251, 191, 36, 0.55)' },
  flashRedCard: { backgroundColor: palette.redBg, borderColor: 'rgba(248, 113, 113, 0.5)' },
  javiWatchingLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 8,
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.blue,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  focusTipLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 6,
    letterSpacing: 0.2,
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
  heardText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 20,
  },
  fluencyFeedback: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  feedbackGood: { color: palette.green },
  feedbackHesitant: { color: palette.amber },
  voiceAnswerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  voiceAnswerLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  voiceError: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: palette.amber,
    textAlign: 'center',
    lineHeight: 18,
  },
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
  writingInput: {
    minHeight: 80,
    maxHeight: 120,
    fontWeight: '600',
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
