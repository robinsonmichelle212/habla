import { LessonPhaseIndicator } from '@/components/lesson-phase-indicator';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { SpeakingFeedbackCard } from '@/components/speaking-feedback-card';
import { SpeakingScaffold } from '@/components/speaking-scaffold';
import { TextMessageBubble } from '@/components/text-message-bubble';
import { VoiceConversationLog } from '@/components/voice-conversation-log';
import {
  analyzeLessonPhases,
  askJaviWarmUp,
  evaluateSpeakingAttempt1,
  evaluateSpeakingAttempt2,
  evaluateWriting,
  generateSpeakingIntro,
  generateWarmUpOpening,
  generateWritingTask,
  lessonKindToLessonType,
  type JaviMessage,
  type SpeakingAttempt1Json,
  type SpeakingAttempt2Json,
} from '@/lib/claude';
import { parseJaviResponse, safeSpanish } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { mergeErrorDnaFromLesson, getTopErrorsForLesson, type ErrorDNAItem } from '@/lib/error-dna';
import { lessonFocusLabel, prepareLessonFocus, type LessonFocusContext } from '@/lib/lesson-focus';
import { getLevelBarometer } from '@/lib/level-progress';
import {
  conversationToJaviMessages,
  setLessonSession,
  type LessonConversationTurn,
  type SpeakingEvaluation,
  type WritingEvaluation,
} from '@/lib/lesson-session';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { getLessonHistory } from '@/lib/practice-storage';
import { scaffoldSecondsForBand, shouldShowSpeakingScaffold } from '@/lib/speaking-scaffold';
import {
  computeCombinedSpeakingScore,
  speakingPhaseSummaryLabel,
} from '@/lib/speaking-score';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import {
  MIN_RECORDING_MS,
  startVoiceRecording,
  stopVoiceRecording,
} from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
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
  accentMuted: 'rgba(255, 122, 89, 0.18)',
  error: '#F87171',
  green: '#34D399',
};

type LessonKind = 'grammar' | 'vocabulary' | 'your-day' | 'structure' | 'read';
type LessonPhase = 'warmup' | 'writing' | 'speaking';
type SpeakingStep =
  | 'intro'
  | 'scaffold'
  | 'attempt1'
  | 'attempt1-feedback'
  | 'attempt2'
  | 'phase-summary';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

const LESSON_OPTIONS: { id: LessonKind; label: string; subtitle?: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'your-day', label: 'Your day' },
  {
    id: 'structure',
    label: 'Structure 🏗️',
    subtitle: 'Word order · Object pronouns · Natural Spanish',
  },
  {
    id: 'read',
    label: 'Read 📖',
    subtitle: 'Real Spanish texts — news, recipes, stories',
  },
];

const WARMUP_JAVI_TARGET = 4;
const HEARD_TRANSCRIPT_MS = 5000;
const PHASE_SUMMARY_MS = 2000;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toTurns(messages: ChatMessage[]): LessonConversationTurn[] {
  return messages.map((m) => ({
    role: m.role,
    spanish: m.spanish,
    translation: m.translation,
  }));
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.barRow}>
      <View style={styles.barRowTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{pct}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const heardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef<VoiceButtonState>('idle');
  const speakingStepRef = useRef<SpeakingStep>('intro');

  const [lessonKind, setLessonKind] = useState<LessonKind>('grammar');
  const [lessonFocus, setLessonFocus] = useState<LessonFocusContext | null>(null);
  const [topErrorDna, setTopErrorDna] = useState<ErrorDNAItem[]>([]);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [phase, setPhase] = useState<LessonPhase>('warmup');

  const [warmUpMessages, setWarmUpMessages] = useState<ChatMessage[]>([]);
  const [warmUpInput, setWarmUpInput] = useState('');
  const [warmUpSending, setWarmUpSending] = useState(false);

  const [writingPrompt, setWritingPrompt] = useState('');
  const [loadingWritingTask, setLoadingWritingTask] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [writingSubmitting, setWritingSubmitting] = useState(false);
  const [writingResult, setWritingResult] = useState<WritingEvaluation | null>(null);

  const [speakingMessages, setSpeakingMessages] = useState<ChatMessage[]>([]);
  const [speakingStep, setSpeakingStep] = useState<SpeakingStep>('intro');
  const [scaffoldSeconds, setScaffoldSeconds] = useState(0);
  const [attempt1Eval, setAttempt1Eval] = useState<SpeakingAttempt1Json | null>(null);
  const [attempt1Transcript, setAttempt1Transcript] = useState('');
  const [attempt2Eval, setAttempt2Eval] = useState<SpeakingAttempt2Json | null>(null);
  const [attempt2Transcript, setAttempt2Transcript] = useState('');
  const [phaseSummaryText, setPhaseSummaryText] = useState('');
  const [speakingIntroDone, setSpeakingIntroDone] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [heardTranscript, setHeardTranscript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'web');
  const [finishing, setFinishing] = useState(false);

  voiceStateRef.current = voiceState;
  speakingStepRef.current = speakingStep;

  const javiWarmUpCount = warmUpMessages.filter((m) => m.role === 'assistant').length;
  const warmUpComplete = javiWarmUpCount >= WARMUP_JAVI_TARGET;
  const lessonType = lessonKindToLessonType(lessonKind);

  const indicatorStep = useMemo(() => {
    if (phase === 'warmup' || phase === 'writing') return 0;
    if (phase === 'speaking') {
      if (speakingStep === 'attempt2' || speakingStep === 'attempt1-feedback') return 2;
      return 1;
    }
    return 0;
  }, [phase, speakingStep]);

  const latestSpeakingJaviId = useMemo(() => {
    for (let i = speakingMessages.length - 1; i >= 0; i -= 1) {
      if (speakingMessages[i]?.role === 'assistant') return speakingMessages[i].id;
    }
    return null;
  }, [speakingMessages]);

  const latestWarmUpJaviId = useMemo(() => {
    for (let i = warmUpMessages.length - 1; i >= 0; i -= 1) {
      if (warmUpMessages[i]?.role === 'assistant') return warmUpMessages[i].id;
    }
    return null;
  }, [warmUpMessages]);

  const setVoiceStateSafe = useCallback((next: VoiceButtonState) => {
    voiceStateRef.current = next;
    setVoiceState(next);
  }, []);

  const speakJaviMessage = useCallback(
    async (text: string) => {
      const spanish = safeSpanish(text);
      if (!spanish) return;
      setVoiceStateSafe('javi-speaking');
      try {
        await speakJavi(spanish);
      } finally {
        if (voiceStateRef.current === 'javi-speaking') {
          setVoiceStateSafe('idle');
        }
      }
    },
    [setVoiceStateSafe],
  );

  const showHeardTranscript = useCallback((text: string) => {
    setHeardTranscript(text);
    if (heardTimerRef.current) clearTimeout(heardTimerRef.current);
    heardTimerRef.current = setTimeout(() => {
      setHeardTranscript(null);
      heardTimerRef.current = null;
    }, HEARD_TRANSCRIPT_MS);
  }, []);

  const resetLessonState = useCallback(() => {
    stopJaviSpeech();
    setPhase('warmup');
    setWarmUpMessages([]);
    setWarmUpInput('');
    setWritingPrompt('');
    setWritingText('');
    setWritingResult(null);
    setSpeakingMessages([]);
    setSpeakingStep('intro');
    setScaffoldSeconds(0);
    setAttempt1Eval(null);
    setAttempt1Transcript('');
    setAttempt2Eval(null);
    setAttempt2Transcript('');
    setPhaseSummaryText('');
    setSpeakingIntroDone(false);
    setHeardTranscript(null);
    setVoiceError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingFocus(true);
    resetLessonState();

    prepareLessonFocus(lessonKind)
      .then(async (focus) => {
        if (cancelled) return;
        const topErrors = await getTopErrorsForLesson(lessonKind, 3);
        if (cancelled) return;
        setTopErrorDna(topErrors);
        setLessonFocus(focus);
        setLessonSession({
          lessonType: lessonKindToLessonType(lessonKind),
          lessonFocus: focus,
          warmUpConversation: [],
          speakingConversation: [],
          conversation: [],
          analysis: undefined,
          drills: undefined,
          writingTask: undefined,
          writingEvaluation: undefined,
          speakingEvaluation: undefined,
        });

        const openingText = await generateWarmUpOpening(lessonKindToLessonType(lessonKind), focus, topErrors);
        const parsed = parseJaviResponse(openingText);
        setWarmUpMessages([
          {
            id: newId(),
            role: 'assistant',
            spanish: parsed.spanish,
            translation: parsed.translation,
          },
        ]);
      })
      .catch(() => {
        if (cancelled) return;
        setLessonFocus(null);
        setWarmUpMessages([
          {
            id: 'welcome',
            role: 'assistant',
            spanish: '¡Hola! ¿Cómo estás?',
            translation: 'Hello! How are you?',
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFocus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lessonKind, resetLessonState]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [warmUpMessages, writingResult, speakingMessages, phase, heardTranscript]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ensureMicPermission().then((r) => {
      setMicGranted(r.granted);
      if (!r.granted && r.status === 'denied') setVoiceError(MIC_DENIED_MESSAGE);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (heardTimerRef.current) clearTimeout(heardTimerRef.current);
      stopJaviSpeech();
      void stopVoiceRecording();
    };
  }, []);

  const sendWarmUpMessage = async () => {
    const trimmed = warmUpInput.trim();
    if (!trimmed || warmUpSending || !lessonFocus || warmUpComplete) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const prior: JaviMessage[] = warmUpMessages.map((m) => ({
      role: m.role,
      content: m.spanish,
    }));
    const javiCount = warmUpMessages.filter((m) => m.role === 'assistant').length;

    setWarmUpInput('');
    setWarmUpSending(true);
    setWarmUpMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);

    try {
      const reply = await askJaviWarmUp(lessonType, trimmed, prior, lessonFocus, javiCount, topErrorDna);
      const parsed = parseJaviResponse(reply);
      setWarmUpMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', spanish: parsed.spanish, translation: parsed.translation },
      ]);
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
    } finally {
      setWarmUpSending(false);
    }
  };

  const startWritingPhase = async () => {
    if (!lessonFocus) return;
    setPhase('writing');
    setLoadingWritingTask(true);

    try {
      const prior = conversationToJaviMessages(toTurns(warmUpMessages));
      const task = await generateWritingTask(lessonType, prior, lessonFocus);
      setWritingPrompt(task.prompt);
      setLessonSession({
        warmUpConversation: toTurns(warmUpMessages),
        conversation: toTurns(warmUpMessages),
        writingTask: { prompt: task.prompt },
      });
    } catch {
      Alert.alert('Could not load writing task', 'Try again in a moment.');
      setPhase('warmup');
    } finally {
      setLoadingWritingTask(false);
    }
  };

  const submitWriting = async () => {
    const trimmed = writingText.trim();
    if (!trimmed || writingSubmitting || !writingPrompt) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setWritingSubmitting(true);
    try {
      const evalJson = await evaluateWriting(
        lessonType,
        writingPrompt,
        conversationToJaviMessages(toTurns(warmUpMessages)),
        trimmed,
      );

      const evaluation: WritingEvaluation = {
        originalText: trimmed,
        correctedText: evalJson.correctedText,
        grammarScore: evalJson.grammarScore,
        vocabularyScore: evalJson.vocabularyScore,
        fluencyScore: evalJson.fluencyScore,
        structureScore: evalJson.structureScore,
        feedback: evalJson.feedback,
        corrections: Array.isArray(evalJson.corrections) ? evalJson.corrections : [],
        accentIssues: Array.isArray(evalJson.accentIssues) ? evalJson.accentIssues : [],
        structuralFeedback: Array.isArray(evalJson.structuralFeedback)
          ? evalJson.structuralFeedback
          : [],
        wordOrderErrors: Array.isArray(evalJson.wordOrderErrors) ? evalJson.wordOrderErrors : [],
      };

      setWritingResult(evaluation);
      setLessonSession({ writingEvaluation: evaluation });
    } catch {
      Alert.alert('Could not evaluate writing', 'Check your internet and try again.');
    } finally {
      setWritingSubmitting(false);
    }
  };

  const startSpeakingPhase = async () => {
    if (!lessonFocus || !writingResult || !writingPrompt) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setPhase('speaking');
    setSpeakingMessages([]);
    setSpeakingStep('intro');
    setAttempt1Eval(null);
    setAttempt1Transcript('');
    setAttempt2Eval(null);
    setAttempt2Transcript('');
    setPhaseSummaryText('');
    setSpeakingIntroDone(false);
    setVoiceError(null);

    try {
      const history = await getLessonHistory();
      const barometer = getLevelBarometer(history);
      const bandId = barometer?.band.id ?? 'b1-beginner';
      const seconds = scaffoldSecondsForBand(bandId);
      setScaffoldSeconds(seconds);

      const introText = await generateSpeakingIntro(lessonType, writingPrompt, lessonFocus, topErrorDna);
      const parsed = parseJaviResponse(introText);
      const introMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: parsed.spanish,
        translation: parsed.translation,
      };
      setSpeakingMessages([introMsg]);
      setSpeakingIntroDone(true);
      if (Platform.OS !== 'web') {
        await speakJaviMessage(parsed.spanish);
      }

      if (shouldShowSpeakingScaffold(bandId)) {
        setSpeakingStep('scaffold');
      } else {
        setSpeakingStep('attempt1');
      }
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
    }
  };

  const onScaffoldComplete = useCallback(() => {
    setSpeakingStep('attempt1');
  }, []);

  const showPhaseSummaryAndFinish = (
    attempt1Score: number,
    attempt2Score: number | null,
    improved: boolean,
    javiFeedback: string,
    correctionsApplied: boolean,
  ) => {
    setPhaseSummaryText(speakingPhaseSummaryLabel(attempt1Score, attempt2Score, improved));
    setSpeakingStep('phase-summary');
    setTimeout(() => {
      void finishLesson({
        attempt1Score,
        attempt2Score,
        improved,
        javiFeedback,
        correctionsApplied,
      });
    }, PHASE_SUMMARY_MS);
  };

  const processAttempt1 = async (trimmed: string) => {
    if (!lessonFocus || !writingResult || !writingPrompt) return;

    setAttempt1Transcript(trimmed);
    setSpeakingMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);

    try {
      const evalJson = await evaluateSpeakingAttempt1(
        lessonType,
        writingPrompt,
        writingResult.originalText,
        writingResult.correctedText,
        writingResult.corrections,
        trimmed,
      );
      setAttempt1Eval(evalJson);
      setSpeakingMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          spanish: evalJson.javiFeedbackSpanish,
          translation: evalJson.javiFeedbackTranslation,
        },
      ]);
      await speakJaviMessage(evalJson.javiFeedbackSpanish);
      setSpeakingStep('attempt1-feedback');
    } catch {
      setVoiceError('Connection issue — check your internet');
      setVoiceStateSafe('idle');
    }
  };

  const processAttempt2 = async (trimmed: string) => {
    if (!lessonFocus || !writingResult || !writingPrompt || !attempt1Eval) return;

    setAttempt2Transcript(trimmed);
    setSpeakingMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);

    try {
      const evalJson = await evaluateSpeakingAttempt2(
        lessonType,
        writingPrompt,
        writingResult.correctedText,
        attempt1Transcript,
        attempt1Eval.score,
        attempt1Eval.improvementTip,
        trimmed,
      );
      setAttempt2Eval(evalJson);
      setSpeakingMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          spanish: evalJson.javiFeedbackSpanish,
          translation: evalJson.javiFeedbackTranslation,
        },
      ]);
      await speakJaviMessage(evalJson.javiFeedbackSpanish);

      const { improved } = computeCombinedSpeakingScore(attempt1Eval.score, evalJson.score);
      const feedback = [attempt1Eval.javiFeedbackTranslation, evalJson.javiFeedbackTranslation]
        .filter(Boolean)
        .join(' ');
      showPhaseSummaryAndFinish(
        attempt1Eval.score,
        evalJson.score,
        improved,
        feedback,
        evalJson.appliedCorrection,
      );
    } catch {
      setVoiceError('Connection issue — check your internet');
      setVoiceStateSafe('idle');
    }
  };

  const skipSecondAttempt = () => {
    if (!attempt1Eval) return;
    showPhaseSummaryAndFinish(
      attempt1Eval.score,
      null,
      false,
      attempt1Eval.javiFeedbackTranslation,
      false,
    );
  };

  const startSecondAttempt = () => {
    setSpeakingStep('attempt2');
    setVoiceError(null);
  };

  const finishLesson = async (speakingOverride?: {
    attempt1Score: number;
    attempt2Score: number | null;
    improved: boolean;
    javiFeedback: string;
    correctionsApplied: boolean;
  }) => {
    if (finishing || !lessonFocus || !writingResult || !writingPrompt) return;
    setFinishing(true);
    stopJaviSpeech();

    try {
      const warmUpTurns = toTurns(warmUpMessages);
      const speakingTurns = toTurns(speakingMessages);

      const attempt1Score = Math.round(
        speakingOverride?.attempt1Score ?? attempt1Eval?.score ?? 0,
      );
      const attempt2Score =
        speakingOverride?.attempt2Score !== undefined
          ? speakingOverride.attempt2Score
          : attempt2Eval != null
            ? Math.round(attempt2Eval.score)
            : null;
      const { combinedScore, improved } = computeCombinedSpeakingScore(
        attempt1Score,
        attempt2Score,
      );

      const javiFeedback =
        speakingOverride?.javiFeedback ??
        [attempt1Eval?.javiFeedbackTranslation, attempt2Eval?.javiFeedbackTranslation]
          .filter(Boolean)
          .join(' ');

      const speakingEvalJson = {
        score: combinedScore,
        accuracyVsWritten: attempt2Score ?? attempt1Score,
        correctionsApplied:
          speakingOverride?.correctionsApplied ?? attempt2Eval?.appliedCorrection ?? false,
        pronunciationNotes: [] as string[],
        feedback: javiFeedback,
      };

      const speakingEvaluation: SpeakingEvaluation = {
        attempt1Score,
        attempt2Score,
        combinedScore,
        improved: speakingOverride?.improved ?? improved,
        javiFeedback,
        score: combinedScore,
        accuracyVsWritten: speakingEvalJson.accuracyVsWritten,
        correctionsApplied: speakingEvalJson.correctionsApplied,
        pronunciationNotes: [],
        feedback: javiFeedback,
        exchangeCount: attempt2Score != null ? 2 : 1,
      };

      const writingScores = {
        grammarScore: writingResult.grammarScore,
        vocabularyScore: writingResult.vocabularyScore,
        fluencyScore: writingResult.fluencyScore,
        structureScore: writingResult.structureScore,
      };

      const analysisJson = await analyzeLessonPhases(
        lessonType,
        conversationToJaviMessages(warmUpTurns),
        conversationToJaviMessages(speakingTurns),
        writingScores,
        speakingEvalJson,
        lessonFocusLabel(lessonFocus),
      );

      const w = Math.round(
        (writingScores.grammarScore + writingScores.vocabularyScore + writingScores.fluencyScore) / 3,
      );
      const baseBreakdown = analysisJson.breakdown ?? {
        grammar: { score: writingScores.grammarScore, topic: lessonFocusLabel(lessonFocus), details: [], mistakes: [] },
        vocabulary: { score: writingScores.vocabularyScore, topic: 'Vocabulary', details: [] },
        fluency: { score: speakingEvaluation.score, details: [] },
        writing: { score: w, details: [] },
      };

      const analysis = {
        strongAreas: analysisJson.strongAreas ?? [],
        weakAreas: analysisJson.weakAreas ?? [],
        focusAreas: analysisJson.focusAreas ?? [],
        correctnessScore: analysisJson.correctnessScore ?? 0,
        overallScore: analysisJson.overallScore ?? 0,
        encouragingMessage: analysisJson.encouragingMessage ?? '',
        breakdown: mergeWritingIntoBreakdown(baseBreakdown, writingResult, writingPrompt),
      };

      if (analysisJson.errorDNA?.length) {
        await mergeErrorDnaFromLesson(analysisJson.errorDNA);
      }

      setLessonSession({
        lessonType,
        lessonFocus,
        warmUpConversation: warmUpTurns,
        speakingConversation: speakingTurns,
        conversation: [...warmUpTurns, ...speakingTurns],
        writingTask: { prompt: writingPrompt },
        writingEvaluation: writingResult,
        speakingEvaluation,
        analysis,
      });

      router.push('/summary');
    } catch {
      Alert.alert('Could not finish lesson', 'Check your internet and try again.');
    } finally {
      setFinishing(false);
    }
  };

  const handlePressIn = async () => {
    if (
      phase !== 'speaking' ||
      (speakingStep !== 'attempt1' && speakingStep !== 'attempt2') ||
      voiceStateRef.current !== 'idle' ||
      !lessonFocus ||
      finishing
    ) {
      return;
    }
    if (Platform.OS === 'web') {
      setVoiceError('Voice works on iOS and Android.');
      return;
    }

    const permission = await ensureMicPermission();
    setMicGranted(permission.granted);
    if (!permission.granted) {
      setVoiceError(MIC_DENIED_MESSAGE);
      return;
    }

    setVoiceError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await startVoiceRecording();
      setVoiceStateSafe('recording');
    } catch {
      setVoiceError('Connection issue — check your internet');
      setVoiceStateSafe('idle');
    }
  };

  const handlePressOut = async () => {
    if (voiceStateRef.current !== 'recording') return;
    setVoiceStateSafe('processing');

    try {
      const { uri, durationMs } = await stopVoiceRecording();
      if (!uri || durationMs < MIN_RECORDING_MS) {
        setVoiceStateSafe('idle');
        setVoiceError('Hold the button while you speak');
        return;
      }

      const result = await transcribeSpanishAudio(uri);
      if (!result.ok) {
        setVoiceStateSafe('idle');
        setVoiceError(
          result.reason === 'api'
            ? 'Connection issue — check your internet'
            : "Javi didn't catch that — try again 🎤",
        );
        return;
      }

      showHeardTranscript(result.text);
      const step = speakingStepRef.current;
      if (step === 'attempt1') {
        await processAttempt1(result.text);
      } else if (step === 'attempt2') {
        await processAttempt2(result.text);
      } else {
        setVoiceStateSafe('idle');
      }
    } catch {
      setVoiceStateSafe('idle');
      setVoiceError('Connection issue — check your internet');
    }
  };

  const micDisabled =
    phase !== 'speaking' ||
    !speakingIntroDone ||
    speakingStep === 'intro' ||
    speakingStep === 'scaffold' ||
    speakingStep === 'attempt1-feedback' ||
    speakingStep === 'phase-summary' ||
    (speakingStep !== 'attempt1' && speakingStep !== 'attempt2') ||
    finishing ||
    !lessonFocus ||
    !micGranted ||
    voiceState === 'processing' ||
    voiceState === 'javi-speaking';

  const voiceHint = (() => {
    if (!speakingIntroDone || speakingStep === 'intro') return 'Javi is speaking…';
    if (speakingStep === 'scaffold') return 'Memorise your response…';
    if (speakingStep === 'attempt1-feedback') return 'Review Javi\'s feedback';
    if (speakingStep === 'phase-summary') return 'Wrapping up speaking…';
    if (voiceState === 'recording') return 'Release when finished';
    if (voiceState === 'processing') return 'Processing…';
    if (voiceState === 'javi-speaking') return 'Listen to Javi…';
    if (speakingStep === 'attempt2') return 'Now try again — apply Javi\'s feedback 🎤';
    return 'Now say it — Javi is listening 🎤';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backLink}>← Home</Text>
          </Pressable>
        </View>

        <View style={styles.headerBlock}>
          <View style={styles.lessonRow}>
            {LESSON_OPTIONS.map((opt) => {
              const selected = lessonKind === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    if (opt.id === 'read') {
                      router.push('/read-lesson');
                      return;
                    }
                    setLessonKind(opt.id);
                  }}
                  disabled={phase !== 'warmup' || warmUpMessages.length > 1}
                  style={[
                    styles.lessonChip,
                    opt.subtitle && styles.lessonChipWide,
                    selected && styles.lessonChipSelected,
                  ]}>
                  <Text style={[styles.lessonChipText, selected && styles.lessonChipTextSelected]}>
                    {opt.label}
                  </Text>
                  {opt.subtitle && selected ? (
                    <Text style={styles.lessonChipSubtitle}>{opt.subtitle}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.screenTitle}>{"Today's Lesson"}</Text>
          <LessonPhaseIndicator activeStep={indicatorStep} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {loadingFocus ? (
            <ActivityIndicator color={palette.muted} style={{ marginTop: 24 }} />
          ) : null}

          {phase === 'warmup' ? (
            <>
              {warmUpMessages.map((m) => (
                <TextMessageBubble
                  key={m.id}
                  role={m.role}
                  spanish={m.spanish}
                  translation={m.translation}
                  messageKey={m.id}
                  animateTyping={m.role === 'assistant' && m.id === latestWarmUpJaviId}
                />
              ))}
              {warmUpComplete ? (
                <Pressable
                  onPress={() => void startWritingPhase()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                  <Text style={styles.primaryButtonText}>Ready</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {phase === 'writing' ? (
            <View style={styles.writingBlock}>
              {loadingWritingTask ? (
                <ActivityIndicator color={palette.muted} />
              ) : (
                <>
                  <Text style={styles.phaseTitle}>Writing task</Text>
                  <View style={styles.taskCard}>
                    <Text style={styles.taskText}>{writingPrompt || '—'}</Text>
                  </View>

                  {!writingResult ? (
                    <>
                      <Text style={styles.inputLabel}>Your writing</Text>
                      <TextInput
                        style={styles.writingInput}
                        value={writingText}
                        onChangeText={setWritingText}
                        placeholder="Write your response in Spanish..."
                        placeholderTextColor={palette.muted}
                        multiline
                        editable={!writingSubmitting}
                      />
                      <Pressable
                        onPress={() => void submitWriting()}
                        disabled={writingSubmitting || !writingText.trim()}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (writingSubmitting || !writingText.trim()) && styles.primaryButtonDisabled,
                          pressed && styles.primaryButtonPressed,
                        ]}>
                        {writingSubmitting ? (
                          <ActivityIndicator color="#0B0F14" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Submit writing</Text>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.phaseTitle}>Javi&apos;s feedback</Text>
                      <ProgressBar label="Grammar" value={writingResult.grammarScore} />
                      <ProgressBar label="Vocabulary" value={writingResult.vocabularyScore} />
                      {lessonKind === 'structure' && writingResult.structureScore != null ? (
                        <ProgressBar label="Structure" value={writingResult.structureScore} />
                      ) : null}
                      <View style={styles.feedbackCard}>
                        <Text style={styles.feedbackLabel}>Corrected version</Text>
                        <Text style={styles.feedbackText}>{writingResult.correctedText}</Text>
                      </View>
                      <Text style={styles.feedbackBody}>{writingResult.feedback}</Text>
                      {writingResult.corrections.length ? (
                        <View style={styles.correctionsCard}>
                          {writingResult.corrections.map((c, i) => (
                            <View key={i} style={styles.correctionRow}>
                              <Text style={styles.correctionWrong}>{c.mistake}</Text>
                              <Text style={styles.correctionRight}>→ {c.correction}</Text>
                              <Text style={styles.correctionNote}>{c.explanation}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => void startSpeakingPhase()}
                        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                        <Text style={styles.primaryButtonText}>Now say it</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </View>
          ) : null}

          {phase === 'speaking' ? (
            <>
              <VoiceConversationLog
                messages={speakingMessages}
                latestJaviId={latestSpeakingJaviId}
                voiceSyncLatest={voiceState === 'javi-speaking'}
              />
              {speakingStep === 'attempt1-feedback' && attempt1Eval ? (
                <SpeakingFeedbackCard
                  correct={attempt1Eval.correct}
                  incorrect={attempt1Eval.incorrect}
                  improvementTip={attempt1Eval.improvementTip}
                />
              ) : null}
              {speakingStep === 'attempt1-feedback' ? (
                <View style={styles.speakingActions}>
                  <Pressable
                    onPress={startSecondAttempt}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                    <Text style={styles.primaryButtonText}>Try again 🎤</Text>
                  </Pressable>
                  <Pressable
                    onPress={skipSecondAttempt}
                    disabled={finishing}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      finishing && styles.primaryButtonDisabled,
                      pressed && styles.primaryButtonPressed,
                    ]}>
                    <Text style={styles.secondaryButtonText}>Move on →</Text>
                  </Pressable>
                </View>
              ) : null}
              {speakingStep === 'phase-summary' && phaseSummaryText ? (
                <View style={styles.phaseSummaryCard}>
                  <Text style={styles.phaseSummaryTitle}>Speaking complete</Text>
                  <Text style={styles.phaseSummaryText}>{phaseSummaryText}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        {phase === 'warmup' && !warmUpComplete ? (
          <View style={[styles.inputDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.composeRow}>
              <TextInput
                style={styles.textInput}
                value={warmUpInput}
                onChangeText={setWarmUpInput}
                placeholder="Type your reply..."
                placeholderTextColor={palette.muted}
                multiline
                editable={!warmUpSending}
              />
              <Pressable
                onPress={() => void sendWarmUpMessage()}
                disabled={warmUpSending || !warmUpInput.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!warmUpInput.trim() || warmUpSending) && styles.primaryButtonDisabled,
                  pressed && styles.primaryButtonPressed,
                ]}>
                {warmUpSending ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'speaking' ? (
          <View style={[styles.voiceDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {speakingStep === 'scaffold' && writingResult ? (
              <SpeakingScaffold
                writtenText={writingResult.originalText}
                countdownSeconds={scaffoldSeconds}
                onComplete={onScaffoldComplete}
              />
            ) : null}
            {heardTranscript ? (
              <Text style={styles.heardText} numberOfLines={2}>
                Javi heard: {heardTranscript}
              </Text>
            ) : null}
            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
            <PushToTalkButton
              state={voiceState}
              disabled={micDisabled}
              onPressIn={() => void handlePressIn()}
              onPressOut={() => void handlePressOut()}
            />
            <Text style={styles.voiceHint}>{voiceHint}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  backLink: { fontSize: 16, fontWeight: '600', color: palette.accent },
  headerBlock: { paddingHorizontal: 20, paddingBottom: 8 },
  lessonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  lessonChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  lessonChipSelected: { backgroundColor: palette.accentMuted, borderColor: palette.accent },
  lessonChipWide: { minWidth: '46%' },
  lessonChipText: { fontSize: 14, fontWeight: '600', color: palette.muted },
  lessonChipSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  lessonChipTextSelected: { color: palette.text },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 },
  writingBlock: { gap: 12 },
  phaseTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
  taskCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
  },
  taskText: { fontSize: 16, lineHeight: 22, color: palette.text },
  inputLabel: { fontSize: 14, fontWeight: '800', color: palette.muted },
  writingInput: {
    minHeight: 120,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    fontSize: 16,
    color: palette.text,
    textAlignVertical: 'top',
  },
  feedbackCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  feedbackLabel: { fontSize: 12, fontWeight: '800', color: palette.muted, marginBottom: 6 },
  feedbackText: { fontSize: 15, lineHeight: 21, color: palette.text },
  feedbackBody: { fontSize: 14, lineHeight: 20, color: palette.muted },
  correctionsCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  correctionRow: { gap: 4 },
  correctionWrong: { fontSize: 14, color: palette.error, fontWeight: '600' },
  correctionRight: { fontSize: 14, color: palette.green, fontWeight: '700' },
  correctionNote: { fontSize: 13, color: palette.muted, lineHeight: 18 },
  barRow: { marginBottom: 8 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 13, fontWeight: '700', color: palette.muted },
  barValue: { fontSize: 13, fontWeight: '900', color: palette.text },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 999, backgroundColor: palette.accent },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonPressed: { backgroundColor: palette.accentPressed },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#0B0F14' },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '800', color: palette.text },
  inputDock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
  },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: palette.text,
  },
  sendButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  sendButtonText: { fontSize: 15, fontWeight: '800', color: '#0B0F14' },
  voiceDock: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    gap: 8,
  },
  heardText: { fontSize: 13, color: palette.muted, textAlign: 'center' },
  errorText: { fontSize: 13, color: palette.error, textAlign: 'center' },
  voiceHint: { fontSize: 13, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  speakingActions: { gap: 0, marginTop: 4 },
  phaseSummaryCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  phaseSummaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  phaseSummaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 22,
  },
});
