import { CulturalNotesSection } from '@/components/cultural-notes-section';
import { ReadTextView } from '@/components/read-text-view';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { VoiceConversationLog } from '@/components/voice-conversation-log';
import {
  analyzeReadLesson,
  askJaviReadDiscussion,
  evaluateReadComprehension,
  generateReadDiscussionOpening,
  generateReadingSession,
} from '@/lib/claude';
import { addCulturalNote } from '@/lib/cultural-notes';
import { parseJaviResponse, safeSpanish } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { getTopErrorsForLesson } from '@/lib/error-dna';
import { getLevelBarometer } from '@/lib/level-progress';
import { lessonFocusLabel, prepareLessonFocus } from '@/lib/lesson-focus';
import {
  conversationToJaviMessages,
  setLessonSession,
  type LessonConversationTurn,
} from '@/lib/lesson-session';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import { getLessonHistory } from '@/lib/practice-storage';
import {
  difficultySpecForBand,
  getRecentReadTopics,
  READ_TEXT_TYPE_LABELS,
  recordReadTopic,
  type ReadingSessionContent,
} from '@/lib/read-with-javi';
import { saveReadingVocabularyWords } from '@/lib/saved-vocabulary';
import { MIN_RECORDING_MS, startVoiceRecording, stopVoiceRecording } from '@/lib/voice-recording';
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
  green: '#34D399',
  blue: '#60A5FA',
};

type ReadPhase = 'loading' | 'read' | 'comprehension' | 'discussion' | 'finishing';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

const SPEAKING_END_TURNS = 3;
const HEARD_TRANSCRIPT_MS = 5000;

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

function phaseLabel(phase: ReadPhase): string {
  switch (phase) {
    case 'read':
      return 'Read';
    case 'comprehension':
      return 'Check';
    case 'discussion':
      return 'Discuss';
    default:
      return '';
  }
}

export default function ReadLessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const heardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef<VoiceButtonState>('idle');

  const [phase, setPhase] = useState<ReadPhase>('loading');
  const [session, setSession] = useState<ReadingSessionContent | null>(null);
  const [lessonFocus, setLessonFocus] = useState<Awaited<ReturnType<typeof prepareLessonFocus>> | null>(null);
  const [topErrors, setTopErrors] = useState<Awaited<ReturnType<typeof getTopErrorsForLesson>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comprehensionSubmitting, setComprehensionSubmitting] = useState(false);
  const [comprehensionScore, setComprehensionScore] = useState<number | null>(null);
  const [comprehensionFeedback, setComprehensionFeedback] = useState('');

  const [discussionMessages, setDiscussionMessages] = useState<ChatMessage[]>([]);
  const [discussionTurns, setDiscussionTurns] = useState(0);
  const [discussionIntroDone, setDiscussionIntroDone] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [heardTranscript, setHeardTranscript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'web');
  const [finishing, setFinishing] = useState(false);

  const latestJaviId = useMemo(() => {
    for (let i = discussionMessages.length - 1; i >= 0; i -= 1) {
      if (discussionMessages[i]?.role === 'assistant') return discussionMessages[i].id;
    }
    return null;
  }, [discussionMessages]);

  voiceStateRef.current = voiceState;

  const phaseStep = useMemo(() => {
    if (phase === 'read') return 0;
    if (phase === 'comprehension') return 1;
    if (phase === 'discussion') return 2;
    return 0;
  }, [phase]);

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const history = await getLessonHistory();
        const barometer = getLevelBarometer(history);
        const bandId = barometer?.band.id ?? 'b1-beginner';
        const bandLabel = barometer?.band.label ?? 'B1 Beginner';

        let focus = await prepareLessonFocus('read');
        if (focus.kind === 'read') {
          focus = { ...focus, levelBandLabel: bandLabel };
        }

        const recentTopics = await getRecentReadTopics();
        const difficulty = difficultySpecForBand(bandId);
        const readingSession = await generateReadingSession(
          focus.kind === 'read' ? focus.textType : 'news',
          difficulty,
          recentTopics,
          bandLabel,
        );

        if (cancelled) return;

        await recordReadTopic(readingSession.topic);
        const topErrorsList = await getTopErrorsForLesson('read', 3);

        setSession(readingSession);
        setLessonFocus(focus);
        setTopErrors(topErrorsList);
        setLessonSession({
          lessonType: 'Read',
          lessonFocus: focus,
          warmUpConversation: [],
          speakingConversation: [],
          conversation: [],
          readingSession,
        });

        const initialAnswers: Record<string, string> = {};
        for (const q of readingSession.comprehensionQuestions) {
          initialAnswers[q.id] = '';
        }
        setAnswers(initialAnswers);
        setPhase('read');
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Could not load reading session');
      }
    })();

    return () => {
      cancelled = true;
      stopJaviSpeech();
      if (heardTimerRef.current) clearTimeout(heardTimerRef.current);
    };
  }, []);

  const startDiscussion = useCallback(async () => {
    if (!session || !lessonFocus) return;
    setPhase('discussion');

    try {
      const openingText = await generateReadDiscussionOpening(session, lessonFocus, topErrors);
      const parsed = parseJaviResponse(openingText);
      const msg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: parsed.spanish,
        translation: parsed.translation,
      };
      setDiscussionMessages([msg]);
      setDiscussionIntroDone(true);
      await speakJaviMessage(parsed.spanish);
    } catch {
      setDiscussionMessages([
        {
          id: newId(),
          role: 'assistant',
          spanish: '¿Qué te ha parecido el texto?',
          translation: 'What did you think of the text?',
        },
      ]);
      setDiscussionIntroDone(true);
    }
  }, [session, lessonFocus, topErrors, speakJaviMessage]);

  const submitComprehension = async () => {
    if (!session || comprehensionSubmitting) return;

    const unanswered = session.comprehensionQuestions.some((q) => !answers[q.id]?.trim());
    if (unanswered) {
      Alert.alert('Answer all questions', 'Responde las preguntas antes de continuar.');
      return;
    }

    setComprehensionSubmitting(true);
    try {
      const responses = session.comprehensionQuestions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id].trim(),
      }));
      const evaluation = await evaluateReadComprehension(session, responses);
      setComprehensionScore(evaluation.score);
      setComprehensionFeedback(evaluation.feedback);
      setLessonSession({ comprehensionEvaluation: evaluation });
      await startDiscussion();
    } catch {
      Alert.alert('Could not check answers', 'Try again in a moment.');
    } finally {
      setComprehensionSubmitting(false);
    }
  };

  const sendDiscussionTranscription = async (text: string) => {
    if (!session || !lessonFocus) return;

    const userMsg: ChatMessage = { id: newId(), role: 'user', spanish: text };
    const nextMessages = [...discussionMessages, userMsg];
    setDiscussionMessages(nextMessages);
    setDiscussionTurns((t) => t + 1);

    const replyText = await askJaviReadDiscussion(
      session,
      lessonFocus,
      conversationToJaviMessages(toTurns(nextMessages)),
      topErrors,
    );
    const parsed = parseJaviResponse(replyText);
    const assistantMsg: ChatMessage = {
      id: newId(),
      role: 'assistant',
      spanish: parsed.spanish,
      translation: parsed.translation,
    };
    const withReply = [...nextMessages, assistantMsg];
    setDiscussionMessages(withReply);
    setLessonSession({ speakingConversation: toTurns(withReply) });
    await speakJaviMessage(parsed.spanish);

    if (discussionTurns + 1 >= SPEAKING_END_TURNS) {
      void finishLesson(withReply);
    }
  };

  const finishLesson = async (messages: ChatMessage[]) => {
    if (!session || finishing) return;
    setFinishing(true);
    setPhase('finishing');

    try {
      const vocabWords = session.vocabularyHighlights.map((v) => ({
        spanish: v.spanish,
        english: v.english,
      }));
      const savedWords = await saveReadingVocabularyWords(vocabWords);

      let culturalNoteSaved: string | undefined;
      if (session.culturalNote) {
        await addCulturalNote(session.culturalNote, session.topic, READ_TEXT_TYPE_LABELS[session.textType]);
        culturalNoteSaved = session.culturalNote;
      }

      const speakingScore = Math.min(100, 60 + discussionTurns * 10);
      const compScore = comprehensionScore ?? 70;

      const analysis = await analyzeReadLesson(
        session,
        compScore,
        comprehensionFeedback,
        conversationToJaviMessages(toTurns(messages)),
        speakingScore,
        savedWords.map((w) => ({ spanish: w.spanish, english: w.english })),
      );

      setLessonSession({
        analysis,
        readingSession: session,
        wordsSavedFromReading: savedWords.map((w) => ({ spanish: w.spanish, english: w.english })),
        culturalNoteSaved,
        speakingEvaluation: {
          score: speakingScore,
          accuracyVsWritten: compScore,
          correctionsApplied: true,
          pronunciationNotes: [],
          feedback: 'Good discussion about the reading.',
          exchangeCount: discussionTurns,
        },
        writingEvaluation: {
          originalText: Object.values(answers).join('\n'),
          correctedText: '',
          grammarScore: compScore,
          vocabularyScore: analysis.breakdown.vocabulary?.score ?? compScore,
          fluencyScore: speakingScore,
          feedback: comprehensionFeedback,
          corrections: [],
          accentIssues: [],
          structuralFeedback: session.grammarPatterns,
        },
      });

      router.push('/summary');
    } catch {
      Alert.alert('Could not finish', 'Check your internet and try again.');
      setFinishing(false);
      setPhase('discussion');
    }
  };

  const handlePressIn = async () => {
    if (phase !== 'discussion' || voiceStateRef.current !== 'idle' || finishing) return;
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
        setVoiceError("Javi didn't catch that — try again 🎤");
        return;
      }
      showHeardTranscript(result.text);
      await sendDiscussionTranscription(result.text);
      setVoiceStateSafe('idle');
    } catch {
      setVoiceStateSafe('idle');
      setVoiceError('Connection issue — check your internet');
    }
  };

  const micDisabled =
    phase !== 'discussion' ||
    !discussionIntroDone ||
    finishing ||
    !micGranted ||
    voiceState === 'processing' ||
    voiceState === 'javi-speaking';

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.loadingText}>Preparing your reading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Could not load reading</Text>
          <Text style={styles.errorText}>{loadError ?? 'Unknown error'}</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Read 📖</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.phaseRow}>
          {(['read', 'comprehension', 'discussion'] as const).map((p, i) => (
            <View key={p} style={styles.phaseItem}>
              <View style={[styles.phaseDot, phaseStep >= i && styles.phaseDotActive]} />
              <Text style={[styles.phaseText, phaseStep >= i && styles.phaseTextActive]}>
                {phaseLabel(p)}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
          keyboardShouldPersistTaps="handled">
          {phase === 'read' ? (
            <>
              <ReadTextView
                text={session.spanishText}
                title={session.title}
                textTypeLabel={READ_TEXT_TYPE_LABELS[session.textType]}
              />
              <Pressable
                onPress={() => setPhase('comprehension')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                <Text style={styles.primaryButtonText}>Ready to discuss ✅</Text>
              </Pressable>
            </>
          ) : null}

          {phase === 'comprehension' || (phase === 'discussion' && comprehensionScore != null) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comprehension check</Text>
              {session.comprehensionQuestions.map((q) => (
                <View key={q.id} style={styles.questionCard}>
                  <Text style={styles.questionPrompt}>{q.promptSpanish}</Text>
                  {q.promptEnglish ? (
                    <Text style={styles.questionHint}>{q.promptEnglish}</Text>
                  ) : null}
                  {phase === 'comprehension' ? (
                    <TextInput
                      style={styles.input}
                      value={answers[q.id] ?? ''}
                      onChangeText={(t) => setAnswers((prev) => ({ ...prev, [q.id]: t }))}
                      placeholder="Escribe tu respuesta…"
                      placeholderTextColor={palette.muted}
                      multiline
                    />
                  ) : (
                    <Text style={styles.answerPreview}>{answers[q.id]}</Text>
                  )}
                </View>
              ))}
              {phase === 'comprehension' ? (
                <Pressable
                  onPress={() => void submitComprehension()}
                  disabled={comprehensionSubmitting}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    comprehensionSubmitting && styles.buttonDisabled,
                  ]}>
                  {comprehensionSubmitting ? (
                    <ActivityIndicator color="#0B0F14" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit answers</Text>
                  )}
                </Pressable>
              ) : comprehensionFeedback ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackScore}>Score: {comprehensionScore}%</Text>
                  <Text style={styles.feedbackText}>{comprehensionFeedback}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {phase === 'discussion' || phase === 'finishing' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Discuss with Javi 🗣️</Text>
              <VoiceConversationLog
                messages={discussionMessages}
                latestJaviId={latestJaviId}
                voiceSyncLatest={voiceState === 'javi-speaking'}
              />
              {heardTranscript ? (
                <Text style={styles.heardText}>Heard: {heardTranscript}</Text>
              ) : null}
              {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
              {session.grammarPatterns.length ? (
                <View style={styles.patternsCard}>
                  <Text style={styles.patternsTitle}>Grammar in this text</Text>
                  {session.grammarPatterns.map((p) => (
                    <Text key={p} style={styles.patternLine}>
                      · {p}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {phase === 'discussion' && !finishing ? (
          <View style={[styles.voiceBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <PushToTalkButton
              state={voiceState}
              disabled={micDisabled}
              onPressIn={() => void handlePressIn()}
              onPressOut={() => void handlePressOut()}
            />
            {discussionTurns >= SPEAKING_END_TURNS ? (
              <Pressable
                onPress={() => void finishLesson(discussionMessages)}
                style={styles.endButton}>
                <Text style={styles.endButtonText}>End lesson</Text>
              </Pressable>
            ) : (
              <Text style={styles.turnHint}>
                {discussionTurns}/{SPEAKING_END_TURNS} exchanges
              </Text>
            )}
          </View>
        ) : null}

        {phase === 'finishing' ? (
          <View style={styles.finishingBar}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.finishingText}>Saving your progress…</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLink: { fontSize: 16, fontWeight: '700', color: palette.accent, minWidth: 72 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: palette.text },
  headerSpacer: { minWidth: 72 },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  phaseItem: { alignItems: 'center', gap: 6 },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.surfaceBorder,
  },
  phaseDotActive: { backgroundColor: palette.accent },
  phaseText: { fontSize: 11, fontWeight: '700', color: palette.muted },
  phaseTextActive: { color: palette.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: palette.text },
  questionCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 8,
  },
  questionPrompt: { fontSize: 16, fontWeight: '800', color: palette.text, lineHeight: 22 },
  questionHint: { fontSize: 13, fontWeight: '600', color: palette.muted },
  input: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  answerPreview: { fontSize: 15, fontWeight: '600', color: palette.muted },
  feedbackCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 6,
  },
  feedbackScore: { fontSize: 15, fontWeight: '900', color: palette.green },
  feedbackText: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
  patternsCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 6,
  },
  patternsTitle: { fontSize: 13, fontWeight: '800', color: palette.muted, textTransform: 'uppercase' },
  patternLine: { fontSize: 14, fontWeight: '600', color: palette.text },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonPressed: { backgroundColor: palette.accentPressed },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  loadingText: { fontSize: 15, fontWeight: '700', color: palette.muted },
  errorTitle: { fontSize: 20, fontWeight: '900', color: palette.text },
  errorText: { fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  voiceBar: {
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  turnHint: { fontSize: 13, fontWeight: '700', color: palette.muted },
  endButton: { paddingVertical: 8 },
  endButtonText: { fontSize: 14, fontWeight: '800', color: palette.accent },
  heardText: { fontSize: 13, fontWeight: '700', color: palette.blue, textAlign: 'center' },
  voiceError: { fontSize: 13, fontWeight: '700', color: palette.accent, textAlign: 'center' },
  finishingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
  },
  finishingText: { fontSize: 14, fontWeight: '700', color: palette.muted },
});
