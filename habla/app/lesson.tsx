import { ConversationInputDock, useKeyboardScrollToEnd } from '@/components/conversation-input-layout';
import { AppTextInput } from '@/components/app-text-input';
import { InteractiveSpanishText } from '@/components/interactive-spanish-text';
import { LessonPhaseIndicator } from '@/components/lesson-phase-indicator';
import { LessonTimer } from '@/components/lesson-timer';
import { Phase1VerbGuide } from '@/components/phase1-verb-guide';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { TextMessageBubble } from '@/components/text-message-bubble';
import {
  analyzeLessonPhases,
  askJaviSpeakingConversation,
  askJaviWarmUp,
  evaluateSpeakingFluency,
  evaluateWriting,
  evaluateFeynmanExplanation,
  generateSpeakingIntro,
  generateWarmUpOpening,
  generateWritingTask,
  lessonKindToLessonType,
  type JaviMessage,
} from '@/lib/claude';
import { parseJaviResponse, safeSpanish, stripReadyForWritingMarker } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { addGems, OFFLINE_SPEAKING_ATTEMPT_GEMS, OFFLINE_WRITING_GEMS } from '@/lib/gems';
import { mergeErrorDnaFromLesson, getTopErrorsForLesson, type ErrorDNAItem } from '@/lib/error-dna';
import { cacheLessonIntro, getCachedLessonIntro } from '@/lib/lesson-intro-cache';
import {
  buildOfflineLessonAnalysis,
  buildPendingWritingEvaluation,
  addPendingLessonSummary,
} from '@/lib/offline-lesson';
import {
  focusCacheKey,
  getOfflineLessonOpening,
  getOfflineWritingPrompt,
  offlineWarmUpReply,
} from '@/lib/offline-lesson-content';
import {
  grammarTopicFromFocus,
  offlineJaviReply,
  OFFLINE_SPEAKING_INTRO,
  writingScoresFromEvaluation,
} from '@/lib/offline-speaking';
import { addPendingAudioTask, saveRecordingToPendingAudio } from '@/lib/pending-audio-storage';
import { addPendingWritingTask } from '@/lib/pending-writing-storage';
import { cacheWritingTask, getCachedWritingTask } from '@/lib/writing-task-cache';
import {
  conversationToJaviMessages,
  getLessonSession,
  setLessonSession,
  type LessonConversationTurn,
  type SpeakingEvaluation,
  type WritingEvaluation,
} from '@/lib/lesson-session';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import {
  buildFeynmanQuestion,
  markFeynmanCompletedForWeek,
  shouldTriggerFeynman,
} from '@/lib/feynman-storage';
import { buildInterleavingContext, type InterleavingContext } from '@/lib/interleaving';
import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { lessonFocusLabel, prepareLessonFocus, type LessonFocusContext } from '@/lib/lesson-focus';
import { checkIsOnline } from '@/lib/network-status';
import { saveLessonCheckpoint, clearLessonCheckpoint } from '@/lib/lesson-checkpoint';
import { lessonTypeLabel, upsertLessonHistoryEntry } from '@/lib/practice-storage';
import {
  buildHistoryEntryFromAnalysis,
  persistLessonProgress,
  recoverUnregisteredSessions,
} from '@/lib/session-recovery';
import {
  buildFallbackLessonAnalysis,
  buildPendingSpeakingEvaluation,
} from '@/lib/lesson-summary-fallback';
import { computeSpeakingCombinedScore } from '@/lib/speaking-score';
import {
  LESSON_ANALYSIS_TIMEOUT_MS,
  SPEAKING_EVAL_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from '@/lib/with-timeout';
import { useDemoMode } from '@/contexts/demo-mode-context';
import {
  DEMO_SESSION_NOTICE,
  DEMO_WRITING_PROMPT,
  demoLessonAnalysis,
  demoSpeakingEvaluation,
  demoTopicLabel,
  demoWarmUpOpening,
  demoWritingEvaluation,
} from '@/lib/demo-mode';
import { saveLastSummary } from '@/lib/last-summary-storage';
import { buildSafeSummaryPayload } from '@/lib/summary-safe-data';
import { formatLocalDate } from '@/lib/streak';
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
type LessonPhase = 'warmup' | 'feynman' | 'writing' | 'speaking';
type SpeakingStep = 'intro' | 'conversation';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

const LESSON_OPTIONS: { id: LessonKind; label: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'your-day', label: 'Your day' },
  { id: 'structure', label: 'Structure 🏗️' },
  { id: 'read', label: 'Read 📖' },
];

const WARMUP_SKIP_AFTER_MESSAGES = 4;
const WARMUP_MAX_JAVI_MESSAGES = 4;
const SPEAKING_USER_TURNS = 3;
const MAX_FEYNMAN_ATTEMPTS = 2;
const SPEAKING_SKIP_LINK_MS = 30_000;
const FINISH_FALLBACK_NOTICE = 'Almost there — let\'s see your results 📊';
const SPEAKING_TIMEOUT_NOTICE = 'Taking longer than expected — moving to summary';

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
  const { enabled: demoMode } = useDemoMode();
  const demoModeRef = useRef(demoMode);
  demoModeRef.current = demoMode;
  const scrollRef = useRef<ScrollView>(null);
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
  const [warmUpReadyForWriting, setWarmUpReadyForWriting] = useState(false);
  const [feynmanNeeded, setFeynmanNeeded] = useState(false);
  const [feynmanAttempts, setFeynmanAttempts] = useState(0);
  const [interleavingContext, setInterleavingContext] = useState<InterleavingContext | null>(null);

  const [writingPrompt, setWritingPrompt] = useState('');
  const [loadingWritingTask, setLoadingWritingTask] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [writingSubmitting, setWritingSubmitting] = useState(false);
  const [writingResult, setWritingResult] = useState<WritingEvaluation | null>(null);

  const [speakingMessages, setSpeakingMessages] = useState<ChatMessage[]>([]);
  const [speakingStep, setSpeakingStep] = useState<SpeakingStep>('intro');
  const [speakingUserTurns, setSpeakingUserTurns] = useState(0);
  const [speakingTranscripts, setSpeakingTranscripts] = useState<string[]>([]);
  const [speakingIntroDone, setSpeakingIntroDone] = useState(false);
  const [offlineSpeakingMode, setOfflineSpeakingMode] = useState(false);
  const [offlineIntroNote, setOfflineIntroNote] = useState(false);
  const [pendingAudioPaths, setPendingAudioPaths] = useState<string[]>([]);

  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'web');
  const [finishing, setFinishing] = useState(false);
  const [showSkipToSummary, setShowSkipToSummary] = useState(false);
  const [showJaviRevealPanel, setShowJaviRevealPanel] = useState(false);
  const [phaseTransitionNotice, setPhaseTransitionNotice] = useState<string | null>(null);
  const finishLessonRef = useRef<(speaking?: SpeakingEvaluation, notice?: string) => Promise<void>>(
    async () => {},
  );
  const pendingSpeakingEvalRef = useRef<SpeakingEvaluation | null>(null);

  useEffect(() => {
    if (phase !== 'speaking') {
      setShowSkipToSummary(false);
      return;
    }
    const timer = setTimeout(() => setShowSkipToSummary(true), SPEAKING_SKIP_LINK_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  voiceStateRef.current = voiceState;
  speakingStepRef.current = speakingStep;

  const showWarmUpSkip = warmUpMessages.length >= WARMUP_SKIP_AFTER_MESSAGES;
  const lessonType = lessonKindToLessonType(lessonKind);

  const scheduleBackgroundSpeakingEval = useCallback(
    (
      transcripts: string[],
      conversation: JaviMessage[],
      lessonDate: string,
      typeLabel: string,
    ) => {
      void withTimeout(
        evaluateSpeakingFluency(lessonType, writingPrompt ?? '', transcripts, conversation),
        60_000,
        'background-speaking-eval',
      )
        .then(async (evalJson) => {
          const combinedScore = computeSpeakingCombinedScore({
            fluencyScore: evalJson.fluencyScore,
            confidenceScore: evalJson.confidenceScore,
            vocabularyRangeScore: evalJson.vocabularyRangeScore,
            naturalFlowScore: evalJson.naturalFlowScore,
          });
          await upsertLessonHistoryEntry(
            buildHistoryEntryFromAnalysis({
              date: lessonDate,
              lessonType: typeLabel,
              analysis: buildFallbackLessonAnalysis({
                lessonType,
                lessonFocus: lessonFocus!,
                writing: writingResult!,
                writingPrompt: writingPrompt!,
                speaking: {
                  fluencyScore: evalJson.fluencyScore,
                  confidenceScore: evalJson.confidenceScore,
                  vocabularyRangeScore: evalJson.vocabularyRangeScore,
                  naturalFlowScore: evalJson.naturalFlowScore,
                  combinedScore,
                  score: combinedScore,
                  javiFeedback: evalJson.feedback,
                  feedback: evalJson.feedback,
                  pronunciationNotes: evalJson.pronunciationNotes,
                  exchangeCount: transcripts.length,
                  pendingEvaluation: false,
                },
              }),
              speaking: {
                fluencyScore: evalJson.fluencyScore,
                confidenceScore: evalJson.confidenceScore,
                vocabularyRangeScore: evalJson.vocabularyRangeScore,
                naturalFlowScore: evalJson.naturalFlowScore,
                combinedScore,
                score: combinedScore,
                javiFeedback: evalJson.feedback,
                feedback: evalJson.feedback,
                pronunciationNotes: evalJson.pronunciationNotes,
                exchangeCount: transcripts.length,
              },
            }),
          );
        })
        .catch((err) => {
          console.warn('[Habla] Background speaking evaluation retry failed:', err);
        });
    },
    [lessonFocus, lessonType, writingPrompt, writingResult],
  );

  const indicatorStep = useMemo(() => {
    if (phase === 'warmup' || phase === 'feynman' || phase === 'writing') return 0;
    if (phase === 'speaking') return speakingUserTurns >= 2 ? 2 : 1;
    return 0;
  }, [phase, speakingUserTurns]);

  const latestJaviSpeaking = useMemo(() => {
    for (let i = speakingMessages.length - 1; i >= 0; i -= 1) {
      if (speakingMessages[i]?.role === 'assistant') return speakingMessages[i];
    }
    return null;
  }, [speakingMessages]);

  const allowJaviReveal = useMemo(() => {
    if (!writingResult || writingResult.pendingEvaluation) return false;
    const scores = [
      writingResult.grammarScore,
      writingResult.vocabularyScore,
      writingResult.fluencyScore,
    ];
    if (writingResult.structureScore != null) scores.push(writingResult.structureScore);
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return avg < 60;
  }, [writingResult]);

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

  const showHeardTranscript = useCallback((_text: string) => {
    // Transcripts are used for evaluation only — not shown during voice-only speaking.
  }, []);

  const resetLessonState = useCallback(() => {
    stopJaviSpeech();
    setPhase('warmup');
    setWarmUpMessages([]);
    setWarmUpInput('');
    setWarmUpReadyForWriting(false);
    setFeynmanNeeded(false);
    setFeynmanAttempts(0);
    setInterleavingContext(null);
    setWritingPrompt('');
    setWritingText('');
    setWritingResult(null);
    setSpeakingMessages([]);
    setSpeakingStep('intro');
    setSpeakingUserTurns(0);
    setSpeakingTranscripts([]);
    setShowJaviRevealPanel(false);
    setSpeakingIntroDone(false);
    setOfflineSpeakingMode(false);
    setPendingAudioPaths([]);
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
        const [needsFeynman, interleaving] = await Promise.all([
          shouldTriggerFeynman(lessonKind, focus),
          buildInterleavingContext(),
        ]);
        if (cancelled) return;
        setFeynmanNeeded(needsFeynman);
        setInterleavingContext(interleaving);
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
          demoSession: demoMode,
        });

        if (demoMode) {
          const topic = demoTopicLabel(focus);
          const opening = demoWarmUpOpening(topic);
          setWarmUpReadyForWriting(true);
          setOfflineIntroNote(false);
          setWarmUpMessages([
            {
              id: newId(),
              role: 'assistant',
              spanish: opening.spanish,
              translation: opening.translation,
            },
          ]);
          return;
        }

        const online = await checkIsOnline();
        const weekNumber = focus.kind === 'grammar' ? focus.weekNumber : null;

        if (!online) {
          const cached = await getCachedLessonIntro(lessonKind, weekNumber);
          const opening = cached
            ? { spanish: cached.spanish, translation: cached.translation, usedBundle: false }
            : getOfflineLessonOpening(lessonKind, focus);
          setOfflineIntroNote(!cached && opening.usedBundle);
          setWarmUpMessages([
            {
              id: newId(),
              role: 'assistant',
              spanish: opening.spanish,
              translation: opening.translation,
            },
          ]);
          return;
        }

        const openingText = await generateWarmUpOpening(lessonKindToLessonType(lessonKind), focus, topErrors);
        const { text: openingClean, ready: openingReady } = stripReadyForWritingMarker(openingText);
        const parsed = parseJaviResponse(openingClean);
        if (openingReady) setWarmUpReadyForWriting(true);
        void cacheLessonIntro({
          lessonKind,
          weekNumber,
          spanish: parsed.spanish,
          translation: parsed.translation ?? '',
        });
        setOfflineIntroNote(false);
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
  }, [lessonKind, resetLessonState, demoMode]);

  const scrollToEnd = useKeyboardScrollToEnd(scrollRef, [
    warmUpMessages,
    writingResult,
    speakingMessages,
    phase,
    writingPrompt,
    loadingWritingTask,
  ]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ensureMicPermission().then((r) => {
      setMicGranted(r.granted);
      if (!r.granted && r.status === 'denied') setVoiceError(MIC_DENIED_MESSAGE);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopJaviSpeech();
      void stopVoiceRecording();
    };
  }, []);

  const completeFeynmanAndStartWriting = async () => {
    const curriculum = await resolveGrammarCurriculum();
    await markFeynmanCompletedForWeek(curriculum.currentWeek);
    setFeynmanNeeded(false);
    void startWritingPhase();
  };

  const beginFeynmanPhase = () => {
    if (!lessonFocus) return;
    const question = buildFeynmanQuestion(lessonFocus);
    setPhase('feynman');
    setFeynmanAttempts(0);
    setWarmUpMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: 'assistant',
        spanish: question.spanish,
        translation: question.translation,
      },
    ]);
  };

  const proceedAfterWarmup = () => {
    if (feynmanNeeded && phase !== 'feynman') {
      beginFeynmanPhase();
      return;
    }
    void startWritingPhase();
  };

  const handleFeynmanResponse = async (trimmed: string) => {
    if (!lessonFocus || warmUpSending) return;

    const attempt = feynmanAttempts + 1;
    setFeynmanAttempts(attempt);
    setWarmUpSending(true);

    try {
      const online = await checkIsOnline();
      const question = buildFeynmanQuestion(lessonFocus);

      if (!online) {
        setWarmUpMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            spanish: 'Perfecto. Lo entiendes bien. Ahora vamos a practicarlo.',
            translation: 'Perfect. You understand it well. Now let\'s practise it.',
          },
        ]);
        setTimeout(() => {
          void completeFeynmanAndStartWriting();
        }, 800);
        return;
      }

      const evaluation = await evaluateFeynmanExplanation(
        lessonType,
        lessonFocus,
        question.conceptLabel,
        trimmed,
        attempt,
      );

      setWarmUpMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          spanish: evaluation.javiSpanish,
          translation: evaluation.javiTranslation,
        },
      ]);

      if (evaluation.moveToWriting || attempt >= MAX_FEYNMAN_ATTEMPTS) {
        setTimeout(() => {
          void completeFeynmanAndStartWriting();
        }, 800);
      }
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
    } finally {
      setWarmUpSending(false);
    }
  };

  const sendWarmUpMessage = async () => {
    const trimmed = warmUpInput.trim();
    if (!trimmed || warmUpSending || !lessonFocus) return;

    if (phase === 'feynman') {
      setWarmUpInput('');
      setWarmUpMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);
      await handleFeynmanResponse(trimmed);
      return;
    }

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
      const online = await checkIsOnline();
      if (!online) {
        const reply = offlineWarmUpReply(javiCount);
        setWarmUpMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', spanish: reply.spanish, translation: reply.translation },
        ]);
        return;
      }

      const reply = await askJaviWarmUp(lessonType, trimmed, prior, lessonFocus, javiCount, topErrorDna);
      const { text: replyClean, ready } = stripReadyForWritingMarker(reply);
      const parsed = parseJaviResponse(replyClean);
      const javiReplies = javiCount + 1;
      if (ready || javiReplies >= WARMUP_MAX_JAVI_MESSAGES) setWarmUpReadyForWriting(true);
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

  const confirmSkipIntroduction = () => {
    Alert.alert(
      'Skip introduction?',
      "Skip Javi's explanation and go straight to writing?",
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            void (async () => {
              const curriculum = await resolveGrammarCurriculum();
              await markFeynmanCompletedForWeek(curriculum.currentWeek);
              setFeynmanNeeded(false);
              void startWritingPhase();
            })();
          },
        },
      ],
    );
  };

  const startWritingPhase = async () => {
    if (!lessonFocus) return;
    setPhase('writing');
    setLoadingWritingTask(true);

    try {
      if (demoModeRef.current) {
        setWritingPrompt(DEMO_WRITING_PROMPT);
        setLessonSession({
          warmUpConversation: toTurns(warmUpMessages),
          conversation: toTurns(warmUpMessages),
          writingTask: { prompt: DEMO_WRITING_PROMPT },
          demoSession: true,
        });
        return;
      }

      const online = await checkIsOnline();
      const focusKey = focusCacheKey(lessonFocus);

      if (!online) {
        const cached = await getCachedWritingTask(lessonType, focusKey);
        const prompt = cached ?? getOfflineWritingPrompt(lessonFocus);
        setWritingPrompt(prompt);
        setLessonSession({
          warmUpConversation: toTurns(warmUpMessages),
          conversation: toTurns(warmUpMessages),
          writingTask: { prompt },
        });
        return;
      }

      const prior = conversationToJaviMessages(toTurns(warmUpMessages));
      const task = await generateWritingTask(
        lessonType,
        prior,
        lessonFocus,
        interleavingContext ?? undefined,
      );
      setWritingPrompt(task.prompt);
      await cacheWritingTask(lessonType, focusKey, task.prompt);
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
    if (!trimmed || writingSubmitting || !writingPrompt || !lessonFocus) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setWritingSubmitting(true);
    try {
      if (demoModeRef.current) {
        const evaluation = demoWritingEvaluation(trimmed);
        setWritingResult(evaluation);
        setLessonSession({ writingEvaluation: evaluation, demoSession: true });
        void startSpeakingPhase(evaluation);
        return;
      }

      const online = await checkIsOnline();

      if (!online) {
        const taskId = `writing-pending-${Date.now()}`;
        const lessonDate = formatLocalDate();
        const warmUpTurns = toTurns(warmUpMessages);

        await addPendingWritingTask({
          id: taskId,
          writtenResponse: trimmed,
          lessonDate,
          lessonType,
          grammarTopic: grammarTopicFromFocus(lessonFocus),
          writingPrompt,
          submittedAt: Date.now(),
          evaluated: false,
          warmUpConversation: warmUpTurns,
          lessonFocusLabel: lessonFocusLabel(lessonFocus),
          lessonTypeEnum: lessonType,
        });

        const evaluation = buildPendingWritingEvaluation(trimmed);
        evaluation.pendingTaskId = taskId;

        setWritingResult(evaluation);
        setLessonSession({ writingEvaluation: evaluation });
        await addGems(OFFLINE_WRITING_GEMS);

        setTimeout(() => {
          void startSpeakingPhase(evaluation);
        }, 600);
        return;
      }

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

  const startSpeakingPhase = async (writingOverride?: WritingEvaluation) => {
    const activeWriting = writingOverride ?? writingResult;
    if (!lessonFocus || !activeWriting || !writingPrompt) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const online = await checkIsOnline();
    setOfflineSpeakingMode(!online);
    setPendingAudioPaths([]);

    setPhase('speaking');
    setSpeakingMessages([]);
    setSpeakingStep('intro');
    setSpeakingUserTurns(0);
    setSpeakingTranscripts([]);
    setSpeakingIntroDone(false);
    setShowJaviRevealPanel(false);
    setVoiceError(null);

    if (demoModeRef.current) {
      const introMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: 'Demo mode: ¡Hablemos!',
        translation: "Demo mode: Let's talk!",
      };
      setSpeakingMessages([introMsg]);
      setSpeakingIntroDone(true);
      setSpeakingStep('conversation');
      setVoiceStateSafe('idle');
      return;
    }

    if (!online) {
      const introMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: OFFLINE_SPEAKING_INTRO.spanish,
        translation: OFFLINE_SPEAKING_INTRO.translation,
      };
      setSpeakingMessages([introMsg]);
      setSpeakingIntroDone(true);
      setSpeakingStep('conversation');
      if (Platform.OS !== 'web') {
        await speakJaviMessage(OFFLINE_SPEAKING_INTRO.spanish);
      }
      return;
    }

    try {
      const introText = await generateSpeakingIntro(
        lessonType,
        writingPrompt,
        lessonFocus,
        topErrorDna,
        interleavingContext ?? undefined,
      );
      const parsed = parseJaviResponse(introText);
      const introMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: parsed.spanish,
        translation: parsed.translation,
      };
      setSpeakingMessages([introMsg]);
      setSpeakingIntroDone(true);
      setSpeakingStep('conversation');
      if (Platform.OS !== 'web') {
        await speakJaviMessage(parsed.spanish);
      }
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
    }
  };

  const showPhaseSummaryAndFinish = (
    speakingEvaluation: SpeakingEvaluation,
    notice?: string,
  ) => {
    pendingSpeakingEvalRef.current = speakingEvaluation;
    if (notice) setPhaseTransitionNotice(notice);

    if (lessonFocus && writingResult && writingPrompt) {
      void saveLessonCheckpoint({
        id: `checkpoint-${Date.now()}`,
        lessonDate: formatLocalDate(),
        lessonType: lessonTypeLabel(lessonType),
        lessonTypeEnum: lessonType,
        lessonFocusLabel: lessonFocusLabel(lessonFocus),
        warmUpConversation: toTurns(warmUpMessages),
        speakingConversation: toTurns(speakingMessages),
        writingPrompt,
        writingEvaluation: writingResult,
        speakingEvaluation,
        savedAt: Date.now(),
      });
    }

    void finishLessonRef.current(speakingEvaluation, notice);
  };

  const skipToSummary = () => {
    if (finishing || !lessonFocus || !writingResult || !writingPrompt) return;
    stopJaviSpeech();
    const pendingSpeaking = buildPendingSpeakingEvaluation(
      speakingUserTurns,
      'Skipped to summary — speaking score pending.',
    );
    void finishLessonRef.current(pendingSpeaking, 'Skipping to summary…');
  };

  const processOfflineSpeakingTurn = async (audioUri: string, nextTurn: number) => {
    if (!lessonFocus || !writingPrompt || !writingResult) return;

    const savedPath = await saveRecordingToPendingAudio(audioUri);
    const audioPaths = await new Promise<string[]>((resolve) => {
      setPendingAudioPaths((prev) => {
        const next = savedPath ? [...prev, savedPath] : prev;
        resolve(next);
        return next;
      });
    });

    const reply = offlineJaviReply(nextTurn - 1);

    const updatedSpeakingTurns: LessonConversationTurn[] = [
      ...toTurns(speakingMessages),
      { role: 'user', spanish: '🎤 Recording saved for review' },
      { role: 'assistant', spanish: reply.spanish, translation: reply.translation },
    ];

    setSpeakingMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', spanish: '🎤 Recording saved for review' },
      {
        id: newId(),
        role: 'assistant',
        spanish: reply.spanish,
        translation: reply.translation,
      },
    ]);

    if (Platform.OS !== 'web') {
      await speakJaviMessage(reply.spanish);
    }

    if (nextTurn >= SPEAKING_USER_TURNS) {
      const pendingTaskId = `pending-${Date.now()}`;
      const lessonDate = formatLocalDate();
      const warmUpTurns = toTurns(warmUpMessages);

      await addPendingAudioTask({
        id: pendingTaskId,
        audioPaths,
        lessonDate,
        lessonType,
        grammarTopic: grammarTopicFromFocus(lessonFocus),
        phase: 'speaking',
        recordedAt: Date.now(),
        processed: false,
        writingPrompt,
        writingScores: writingScoresFromEvaluation(writingResult),
        lessonFocusLabel: lessonFocusLabel(lessonFocus),
        warmUpConversation: warmUpTurns,
        speakingConversation: updatedSpeakingTurns,
        lessonTypeEnum: lessonType,
      });

      await addGems(OFFLINE_SPEAKING_ATTEMPT_GEMS);

      showPhaseSummaryAndFinish({
        fluencyScore: null,
        confidenceScore: null,
        vocabularyRangeScore: null,
        naturalFlowScore: null,
        combinedScore: null,
        score: null,
        javiFeedback: 'Pending evaluation when back online.',
        feedback: 'Pending evaluation when back online.',
        exchangeCount: nextTurn,
        pendingEvaluation: true,
        audioPaths,
        pendingTaskId,
      });
    } else {
      setVoiceStateSafe('idle');
    }
  };

  const processSpeakingTurn = async (trimmed: string) => {
    if (!lessonFocus || !writingPrompt) return;

    const nextTurn = speakingUserTurns + 1;
    const priorExchanges: JaviMessage[] = speakingMessages.map((m) => ({
      role: m.role,
      content: m.spanish,
    }));

    setSpeakingUserTurns(nextTurn);
    setSpeakingTranscripts((prev) => [...prev, trimmed]);
    setSpeakingMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);

    try {
      const replyText = await askJaviSpeakingConversation(
        lessonType,
        trimmed,
        priorExchanges,
        lessonFocus,
        writingPrompt,
        nextTurn,
        SPEAKING_USER_TURNS,
        topErrorDna,
        interleavingContext ?? undefined,
      );
      const parsed = parseJaviResponse(replyText);
      setShowJaviRevealPanel(false);
      setSpeakingMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          spanish: parsed.spanish,
          translation: parsed.translation,
        },
      ]);
      await speakJaviMessage(parsed.spanish);

      if (nextTurn >= SPEAKING_USER_TURNS) {
        const fullConversation: JaviMessage[] = [
          ...priorExchanges,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: parsed.spanish },
        ];
        const transcripts = [...speakingTranscripts, trimmed];
        let evalJson;
        try {
          evalJson = await withTimeout(
            evaluateSpeakingFluency(
              lessonType,
              writingPrompt,
              transcripts,
              fullConversation,
            ),
            SPEAKING_EVAL_TIMEOUT_MS,
            'speaking-fluency-eval',
          );
        } catch (evalErr) {
          console.error('[Habla] Speaking evaluation failed:', evalErr);
          const pendingSpeaking = buildPendingSpeakingEvaluation(nextTurn);
          if (evalErr instanceof TimeoutError) {
            scheduleBackgroundSpeakingEval(
              transcripts,
              fullConversation,
              formatLocalDate(),
              lessonTypeLabel(lessonType),
            );
            showPhaseSummaryAndFinish(pendingSpeaking, SPEAKING_TIMEOUT_NOTICE);
          } else {
            showPhaseSummaryAndFinish(pendingSpeaking, FINISH_FALLBACK_NOTICE);
          }
          return;
        }

        const combinedScore = computeSpeakingCombinedScore({
          fluencyScore: evalJson.fluencyScore,
          confidenceScore: evalJson.confidenceScore,
          vocabularyRangeScore: evalJson.vocabularyRangeScore,
          naturalFlowScore: evalJson.naturalFlowScore,
        });
        showPhaseSummaryAndFinish({
          fluencyScore: evalJson.fluencyScore,
          confidenceScore: evalJson.confidenceScore,
          vocabularyRangeScore: evalJson.vocabularyRangeScore,
          naturalFlowScore: evalJson.naturalFlowScore,
          combinedScore,
          score: combinedScore,
          javiFeedback: evalJson.feedback,
          feedback: evalJson.feedback,
          pronunciationNotes: evalJson.pronunciationNotes,
          exchangeCount: nextTurn,
        });
      } else {
        setVoiceStateSafe('idle');
      }
    } catch (err) {
      console.error('[Habla] processSpeakingTurn failed:', err);
      if (nextTurn >= SPEAKING_USER_TURNS) {
        showPhaseSummaryAndFinish(
          buildPendingSpeakingEvaluation(nextTurn),
          FINISH_FALLBACK_NOTICE,
        );
        return;
      }
      setVoiceError('Connection issue — check your internet');
      setVoiceStateSafe('idle');
    }
  };

  const navigateToSummary = useCallback(
    async (params: {
      speakingEvaluation: SpeakingEvaluation;
      analysis: ReturnType<typeof buildOfflineLessonAnalysis>;
      notice?: string;
    }) => {
      const warmUpTurns = toTurns(warmUpMessages);
      const speakingTurns = toTurns(speakingMessages);

      setLessonSession({
        lessonType,
        lessonFocus: lessonFocus!,
        warmUpConversation: warmUpTurns,
        speakingConversation: speakingTurns,
        conversation: [...warmUpTurns, ...speakingTurns],
        writingTask: { prompt: writingPrompt! },
        writingEvaluation: writingResult!,
        speakingEvaluation: params.speakingEvaluation,
        analysis: params.analysis,
        summaryNotice: params.notice,
        demoSession: demoModeRef.current || getLessonSession().demoSession,
      });

      const isDemoSession = demoModeRef.current || getLessonSession().demoSession;

      if (!isDemoSession) {
        try {
          const payload = buildSafeSummaryPayload(getLessonSession());
          await saveLastSummary(payload);
        } catch (saveSummaryErr) {
          console.error('[Habla] Pre-render lastSummary save failed:', saveSummaryErr);
        }

        try {
          await upsertLessonHistoryEntry(
            buildHistoryEntryFromAnalysis({
              date: formatLocalDate(),
              lessonType: lessonTypeLabel(lessonType),
              analysis: params.analysis,
              speaking: params.speakingEvaluation,
              writingPending: writingResult!.pendingEvaluation,
            }),
          );
          await clearLessonCheckpoint();
        } catch (saveErr) {
          console.error('[Habla] Summary save failed, persisting progress:', saveErr);
          await persistLessonProgress({
            date: formatLocalDate(),
            lessonType: lessonTypeLabel(lessonType),
            focusLabel: lessonFocusLabel(lessonFocus!),
            writing: writingResult!,
            writingPrompt: writingPrompt!,
            speaking: params.speakingEvaluation,
          }).catch(() => {});
        }
      }

      router.push('/summary');
    },
    [
      lessonFocus,
      lessonType,
      router,
      speakingMessages,
      warmUpMessages,
      writingPrompt,
      writingResult,
    ],
  );

  const finishLesson = useCallback(
    async (speakingOverride?: SpeakingEvaluation, notice?: string) => {
      if (finishing || !lessonFocus || !writingResult || !writingPrompt) return;
      setFinishing(true);
      stopJaviSpeech();

      const warmUpTurns = toTurns(warmUpMessages);
      const speakingTurns = toTurns(speakingMessages);
      const transitionNotice = notice ?? phaseTransitionNotice ?? undefined;
      const writingScores = {
        grammarScore: writingResult.grammarScore,
        vocabularyScore: writingResult.vocabularyScore,
        fluencyScore: writingResult.fluencyScore,
        structureScore: writingResult.structureScore,
      };

      try {
        if (demoModeRef.current) {
          await navigateToSummary({
            speakingEvaluation: speakingOverride ?? demoSpeakingEvaluation(),
            analysis: demoLessonAnalysis(),
            notice: DEMO_SESSION_NOTICE,
          });
          return;
        }

        if (speakingOverride?.pendingEvaluation || writingResult.pendingEvaluation) {
          const speakingEvaluation: SpeakingEvaluation = {
            fluencyScore: speakingOverride?.fluencyScore ?? null,
            confidenceScore: speakingOverride?.confidenceScore ?? null,
            vocabularyRangeScore: speakingOverride?.vocabularyRangeScore ?? null,
            naturalFlowScore: speakingOverride?.naturalFlowScore ?? null,
            combinedScore: speakingOverride?.combinedScore ?? null,
            score: speakingOverride?.score ?? null,
            javiFeedback: speakingOverride?.javiFeedback ?? 'Pending evaluation when back online.',
            feedback: speakingOverride?.feedback ?? 'Pending evaluation when back online.',
            exchangeCount: speakingOverride?.exchangeCount ?? speakingUserTurns,
            pendingEvaluation: speakingOverride?.pendingEvaluation ?? true,
            audioPaths: speakingOverride?.audioPaths,
            pendingTaskId: speakingOverride?.pendingTaskId,
          };
          const analysis = buildOfflineLessonAnalysis(
            lessonType,
            lessonFocus,
            writingResult,
            writingPrompt,
            !!speakingOverride?.pendingEvaluation,
          );

          await addPendingLessonSummary({
            id: `summary-pending-${Date.now()}`,
            lessonDate: formatLocalDate(),
            lessonType,
            lessonTypeEnum: lessonType,
            lessonFocusLabel: lessonFocusLabel(lessonFocus),
            warmUpConversation: warmUpTurns,
            speakingConversation: speakingTurns,
            writingPrompt,
            writingEvaluation: writingResult,
            speakingEvaluation,
            createdAt: Date.now(),
            processed: false,
          });

          await navigateToSummary({
            speakingEvaluation,
            analysis,
            notice: transitionNotice,
          });
          return;
        }

        const fluencyScore =
          speakingOverride?.fluencyScore != null
            ? Math.round(speakingOverride.fluencyScore)
            : null;
        const confidenceScore =
          speakingOverride?.confidenceScore != null
            ? Math.round(speakingOverride.confidenceScore)
            : null;
        const vocabularyRangeScore =
          speakingOverride?.vocabularyRangeScore != null
            ? Math.round(speakingOverride.vocabularyRangeScore)
            : null;
        const naturalFlowScore =
          speakingOverride?.naturalFlowScore != null
            ? Math.round(speakingOverride.naturalFlowScore)
            : null;

        const hasSpeakingScores =
          fluencyScore != null &&
          confidenceScore != null &&
          vocabularyRangeScore != null &&
          naturalFlowScore != null;

        let speakingEvaluation: SpeakingEvaluation;

        if (!hasSpeakingScores) {
          speakingEvaluation = buildPendingSpeakingEvaluation(
            speakingOverride?.exchangeCount ?? speakingUserTurns,
          );
          const analysis = buildFallbackLessonAnalysis({
            lessonType,
            lessonFocus,
            writing: writingResult,
            writingPrompt,
            speaking: speakingEvaluation,
          });
          await navigateToSummary({
            speakingEvaluation,
            analysis,
            notice: transitionNotice ?? FINISH_FALLBACK_NOTICE,
          });
          return;
        }

        const combinedScore =
          speakingOverride?.combinedScore ??
          computeSpeakingCombinedScore({
            fluencyScore: fluencyScore!,
            confidenceScore: confidenceScore!,
            vocabularyRangeScore: vocabularyRangeScore!,
            naturalFlowScore: naturalFlowScore!,
          });
        const javiFeedback = speakingOverride?.javiFeedback ?? '';

        speakingEvaluation = {
          fluencyScore: fluencyScore!,
          confidenceScore: confidenceScore!,
          vocabularyRangeScore: vocabularyRangeScore!,
          naturalFlowScore: naturalFlowScore!,
          combinedScore,
          score: combinedScore,
          javiFeedback,
          feedback: javiFeedback,
          pronunciationNotes: speakingOverride?.pronunciationNotes ?? [],
          exchangeCount: speakingOverride?.exchangeCount ?? speakingUserTurns,
        };

        const speakingEvalJson = {
          score: combinedScore,
          fluencyScore: fluencyScore!,
          confidenceScore: confidenceScore!,
          vocabularyRangeScore: vocabularyRangeScore!,
          naturalFlowScore: naturalFlowScore!,
          pronunciationNotes: speakingOverride?.pronunciationNotes ?? [],
          feedback: javiFeedback,
        };

        let analysisJson;
        try {
          analysisJson = await withTimeout(
            analyzeLessonPhases(
              lessonType,
              conversationToJaviMessages(warmUpTurns),
              conversationToJaviMessages(speakingTurns),
              writingScores,
              speakingEvalJson,
              lessonFocusLabel(lessonFocus),
            ),
            LESSON_ANALYSIS_TIMEOUT_MS,
            'lesson-phase-analysis',
          );
        } catch (analysisErr) {
          console.error('[Habla] analyzeLessonPhases failed:', analysisErr);
          analysisJson = null;
        }

        const analysis = analysisJson
          ? (() => {
              const w = Math.round(
                (writingScores.grammarScore +
                  writingScores.vocabularyScore +
                  writingScores.fluencyScore) /
                  3,
              );
              const baseBreakdown = analysisJson.breakdown ?? {
                grammar: {
                  score: writingScores.grammarScore,
                  topic: lessonFocusLabel(lessonFocus),
                  details: [],
                  mistakes: [],
                },
                vocabulary: {
                  score: writingScores.vocabularyScore,
                  topic: 'Vocabulary',
                  details: [],
                },
                fluency: { score: speakingEvaluation.score ?? 0, details: [] },
                writing: { score: w, details: [] },
              };
              return {
                strongAreas: analysisJson.strongAreas ?? [],
                weakAreas: analysisJson.weakAreas ?? [],
                focusAreas: analysisJson.focusAreas ?? [],
                correctnessScore: analysisJson.correctnessScore ?? 0,
                overallScore: analysisJson.overallScore ?? 0,
                encouragingMessage: analysisJson.encouragingMessage ?? '',
                breakdown: mergeWritingIntoBreakdown(
                  baseBreakdown,
                  writingResult,
                  writingPrompt,
                ),
              };
            })()
          : buildFallbackLessonAnalysis({
              lessonType,
              lessonFocus,
              writing: writingResult,
              writingPrompt,
              speaking: speakingEvaluation,
            });

        if (analysisJson?.errorDNA?.length) {
          await mergeErrorDnaFromLesson(analysisJson.errorDNA).catch((dnaErr) => {
            console.warn('[Habla] errorDNA merge failed:', dnaErr);
          });
        }

        await navigateToSummary({
          speakingEvaluation,
          analysis,
          notice: transitionNotice,
        });
      } catch (err) {
        console.error('[Habla] finishLesson failed:', err);
        const speakingEvaluation =
          speakingOverride ??
          buildPendingSpeakingEvaluation(speakingUserTurns);
        const analysis = buildFallbackLessonAnalysis({
          lessonType,
          lessonFocus,
          writing: writingResult,
          writingPrompt,
          speaking: speakingEvaluation,
        });
        await navigateToSummary({
          speakingEvaluation,
          analysis,
          notice: transitionNotice ?? FINISH_FALLBACK_NOTICE,
        });
      } finally {
        setFinishing(false);
      }
    },
    [
      finishing,
      lessonFocus,
      lessonType,
      navigateToSummary,
      phaseTransitionNotice,
      speakingMessages,
      speakingUserTurns,
      warmUpMessages,
      writingPrompt,
      writingResult,
    ],
  );

  finishLessonRef.current = finishLesson;

  const handlePressIn = async () => {
    if (
      phase !== 'speaking' ||
      speakingStep !== 'conversation' ||
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

    if (demoModeRef.current) {
      setVoiceStateSafe('idle');
      showHeardTranscript('Demo mode: Speaking registered.');
      showPhaseSummaryAndFinish(
        demoSpeakingEvaluation(),
        'Demo mode: Speaking registered. Fluency: 80% · Confidence: 75%',
      );
      return;
    }

    setVoiceStateSafe('processing');

    try {
      const { uri, durationMs } = await stopVoiceRecording();
      if (!uri || durationMs < MIN_RECORDING_MS) {
        setVoiceStateSafe('idle');
        setVoiceError('Hold the button while you speak');
        return;
      }

      const online = await checkIsOnline();
      const useOfflineSpeaking = offlineSpeakingMode || !online;

      if (useOfflineSpeaking) {
        if (!offlineSpeakingMode) {
          setOfflineSpeakingMode(true);
        }
        const nextTurn = speakingUserTurns + 1;
        setSpeakingUserTurns(nextTurn);
        showHeardTranscript('Saved offline 🎤');
        if (speakingStepRef.current === 'conversation') {
          await processOfflineSpeakingTurn(uri, nextTurn);
        } else {
          setVoiceStateSafe('idle');
        }
        return;
      }

      const result = await transcribeSpanishAudio(uri);
      if (!result.ok) {
        setVoiceStateSafe('idle');
        if (result.reason === 'offline' || result.reason === 'api') {
          const nextTurn = speakingUserTurns + 1;
          setSpeakingUserTurns(nextTurn);
          setOfflineSpeakingMode(true);
          showHeardTranscript('Saved offline 🎤');
          if (speakingStepRef.current === 'conversation') {
            await processOfflineSpeakingTurn(uri, nextTurn);
          }
          return;
        }
        setVoiceError("Javi didn't catch that — try again 🎤");
        return;
      }

      showHeardTranscript(result.text);
      if (speakingStepRef.current === 'conversation') {
        await processSpeakingTurn(result.text);
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
    speakingStep !== 'conversation' ||
    finishing ||
    !lessonFocus ||
    !micGranted ||
    voiceState === 'processing' ||
    voiceState === 'javi-speaking';

  const voiceHint = (() => {
    if (!speakingIntroDone || speakingStep === 'intro') return 'Javi is speaking…';
    if (finishing) return 'Wrapping up…';
    if (voiceState === 'recording') return 'Release when finished';
    if (voiceState === 'processing') return 'Processing…';
    if (voiceState === 'javi-speaking') return 'Listen to Javi…';
    return `Speak naturally — ${speakingUserTurns}/${SPEAKING_USER_TURNS} 🎤`;
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={styles.headerBlock}>
          <View style={styles.lessonHeaderRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Text style={styles.backLink}>←</Text>
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.lessonPillScroller}
              contentContainerStyle={styles.lessonPillScroll}>
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
                    style={({ pressed }) => [
                      styles.lessonPill,
                      selected && styles.lessonPillSelected,
                      pressed && !selected && styles.lessonPillPressed,
                    ]}>
                    <Text style={[styles.lessonPillText, selected && styles.lessonPillTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.phaseTimerRow}>
            <View style={styles.phaseIndicatorWrap}>
              <LessonPhaseIndicator activeStep={indicatorStep} />
            </View>
            <LessonTimer resetKey={lessonKind} paused={finishing} />
          </View>
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

          {phase === 'warmup' && offlineIntroNote ? (
            <Text style={styles.offlineNote}>📡 Offline — using a saved introduction</Text>
          ) : null}

          {phase === 'warmup' || phase === 'feynman' || phase === 'writing' ? (
            <>
              {phase === 'warmup' && lessonFocus?.kind === 'grammar' ? (
                <Phase1VerbGuide focus={lessonFocus} />
              ) : null}
              {warmUpMessages.map((m) => (
                <TextMessageBubble
                  key={m.id}
                  role={m.role}
                  spanish={m.spanish}
                  translation={m.translation}
                  messageKey={m.id}
                  animateTyping={
                    (phase === 'warmup' || phase === 'feynman') &&
                    m.role === 'assistant' &&
                    m.id === latestWarmUpJaviId
                  }
                />
              ))}
              {phase === 'warmup' && warmUpReadyForWriting ? (
                <Pressable
                  onPress={() => proceedAfterWarmup()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                  <Text style={styles.primaryButtonText}>
                    {feynmanNeeded ? 'Explain it back to Javi 🧠' : 'Ready to write ✍️'}
                  </Text>
                </Pressable>
              ) : null}
              {phase === 'feynman' ? (
                <Text style={styles.feynmanHint}>
                  Explain the concept in your own words — Javi will check your understanding before writing.
                </Text>
              ) : null}
              {phase === 'warmup' && showWarmUpSkip ? (
                <Pressable
                  onPress={confirmSkipIntroduction}
                  style={styles.skipIntroBtn}
                  accessibilityRole="button">
                  <Text style={styles.skipIntroText}>Skip introduction →</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {phase === 'writing' && writingResult ? (
            <View style={styles.writingBlock}>
              {writingResult.pendingEvaluation ? (
                <>
                  <Text style={styles.phaseTitle}>✍️ Writing submitted — evaluation pending ⏳</Text>
                  <Text style={styles.feedbackBody}>{writingResult.feedback}</Text>
                  <Pressable
                    onPress={() => void startSpeakingPhase()}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                    <Text style={styles.primaryButtonText}>Let&apos;s talk 🎤</Text>
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
                <InteractiveSpanishText
                  text={writingResult.correctedText}
                  source="conversation"
                  style={styles.feedbackText}
                  contextSentence={writingResult.correctedText}
                />
              </View>
              <Text style={styles.feedbackBody}>{writingResult.feedback}</Text>
              {writingResult.corrections.length ? (
                <View style={styles.correctionsCard}>
                  {writingResult.corrections.map((c, i) => (
                    <View key={i} style={styles.correctionRow}>
                      <InteractiveSpanishText
                        text={c.mistake}
                        source="conversation"
                        style={styles.correctionWrong}
                        textColor={palette.error}
                        contextSentence={writingResult.correctedText}
                      />
                      <InteractiveSpanishText
                        text={c.correction}
                        source="conversation"
                        style={styles.correctionRight}
                        textColor={palette.green}
                        contextSentence={writingResult.correctedText}
                      />
                      <Text style={styles.correctionNote}>{c.explanation}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable
                onPress={() => void startSpeakingPhase()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                <Text style={styles.primaryButtonText}>Let&apos;s talk 🎤</Text>
              </Pressable>
                </>
              )}
            </View>
          ) : null}

          {phase === 'speaking' ? <View style={styles.speakingSpacer} /> : null}
        </ScrollView>

        {phase === 'warmup' || phase === 'feynman' ? (
          <View style={[styles.inputDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.composeRow}>
              <AppTextInput
                style={styles.textInput}
                value={warmUpInput}
                onChangeText={setWarmUpInput}
                placeholder="Type your reply..."
                placeholderTextColor={palette.muted}
                multiline
                scrollEnabled
                editable={!warmUpSending}
                textAlignVertical="top"
                onFocus={() => scrollToEnd()}
              />
              <Pressable
                onPress={() => void sendWarmUpMessage()}
                disabled={warmUpSending || !warmUpInput.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!warmUpInput.trim() || warmUpSending) && styles.sendButtonDisabled,
                  pressed && warmUpInput.trim() && !warmUpSending && styles.sendButtonPressed,
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

        {phase === 'writing' && !writingResult ? (
          <ConversationInputDock
            prompt={writingPrompt}
            promptLoading={loadingWritingTask}
            inputValue={writingText}
            onChangeText={setWritingText}
            inputPlaceholder="Write your response in Spanish..."
            inputEditable={!writingSubmitting}
            bottomInset={Math.max(insets.bottom, 12)}
            onInputFocus={() => scrollToEnd()}
            trailingAction={
              <Pressable
                onPress={() => void submitWriting()}
                disabled={writingSubmitting || !writingText.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (writingSubmitting || !writingText.trim()) && styles.sendButtonDisabled,
                  pressed && !writingSubmitting && writingText.trim() && styles.sendButtonPressed,
                ]}>
                {writingSubmitting ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Submit</Text>
                )}
              </Pressable>
            }
          />
        ) : null}

        {phase === 'speaking' ? (
          <View style={[styles.voiceDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <PushToTalkButton
              state={voiceState}
              disabled={micDisabled}
              onPressIn={() => void handlePressIn()}
              onPressOut={() => void handlePressOut()}
            />
            <Text style={styles.voiceHint}>{voiceHint}</Text>
            {allowJaviReveal && latestJaviSpeaking && speakingStep === 'conversation' ? (
              <>
                <Pressable
                  onPress={() => setShowJaviRevealPanel((v) => !v)}
                  style={({ pressed }) => [styles.javiRevealLink, pressed && styles.javiRevealPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="See what Javi said">
                  <Text style={styles.javiRevealLinkText}>👁️ See what Javi said</Text>
                </Pressable>
                {showJaviRevealPanel ? (
                  <View style={styles.javiRevealCard}>
                    <Text style={styles.javiRevealSpanish}>
                      {safeSpanish(latestJaviSpeaking.spanish)}
                    </Text>
                    {latestJaviSpeaking.translation ? (
                      <Text style={styles.javiRevealEnglish}>{latestJaviSpeaking.translation}</Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
            {showSkipToSummary && speakingStep === 'conversation' && !finishing ? (
              <Pressable
                onPress={skipToSummary}
                style={({ pressed }) => [styles.skipToSummaryLink, pressed && styles.skipToSummaryPressed]}
                accessibilityRole="button"
                accessibilityLabel="Skip to summary">
                <Text style={styles.skipToSummaryText}>Skip to summary →</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  headerBlock: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  lessonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  backBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLink: { fontSize: 22, fontWeight: '600', color: palette.accent, lineHeight: 24 },
  lessonPillScroller: { flex: 1 },
  lessonPillScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  lessonPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  lessonPillPressed: { opacity: 0.88 },
  lessonPillSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accent,
  },
  lessonPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  lessonPillTextSelected: {
    color: palette.accent,
  },
  phaseTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phaseIndicatorWrap: {
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 },
  offlineNote: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 10,
  },
  feynmanHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 4,
    lineHeight: 18,
  },
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
    backgroundColor: palette.background,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  sendButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonPressed: { backgroundColor: palette.accentPressed },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { fontSize: 15, fontWeight: '800', color: '#0B0F14' },
  skipIntroBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipIntroText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
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
  speakingSpacer: { minHeight: 8 },
  javiRevealLink: { marginTop: 4, paddingVertical: 6 },
  javiRevealPressed: { opacity: 0.85 },
  javiRevealLinkText: { fontSize: 13, fontWeight: '700', color: palette.muted, textAlign: 'center' },
  javiRevealCard: {
    marginTop: 8,
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    gap: 6,
    width: '100%',
  },
  javiRevealSpanish: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 21 },
  javiRevealEnglish: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 19 },
  skipToSummaryLink: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 8 },
  skipToSummaryPressed: { opacity: 0.7 },
  skipToSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
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
  phaseSummaryButton: {
    marginTop: 6,
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseSummaryButtonPressed: { backgroundColor: palette.accentPressed },
  phaseSummaryButtonDisabled: { opacity: 0.55 },
  phaseSummaryButtonText: { fontSize: 14, fontWeight: '800', color: '#0B0F14' },
  phaseSummaryHint: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
