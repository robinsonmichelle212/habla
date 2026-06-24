import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { VoiceConversationLog } from '@/components/voice-conversation-log';
import { askJavi, lessonKindToLessonType, type JaviMessage } from '@/lib/claude';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import {
  buildLessonOpening,
  prepareLessonFocus,
  type LessonFocusContext,
} from '@/lib/lesson-focus';
import {
  setLessonSession,
  type LessonConversationTurn,
} from '@/lib/lesson-session';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
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
};

type LessonKind = 'grammar' | 'vocabulary' | 'your-day';

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
];

const HEARD_TRANSCRIPT_MS = 5000;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseJaviResponse(fullText: string): { spanish: string; translation?: string } {
  const raw = fullText.trim();
  if (!raw) return { spanish: '(Sin respuesta)' };

  const lines = raw.split(/\r?\n/);
  const translateIdx = lines.findIndex((l) => /^\s*(Translate|Translation)\s*:\s*/i.test(l));

  if (translateIdx === -1) {
    return { spanish: raw };
  }

  const spanish = lines.slice(0, translateIdx).join('\n').trim();
  const firstLine = lines[translateIdx] ?? '';
  const firstPart = firstLine.replace(/^\s*(Translate|Translation)\s*:\s*/i, '').trim();
  const rest = lines.slice(translateIdx + 1).join('\n').trim();
  const translation = [firstPart, rest].filter(Boolean).join('\n').trim();

  return {
    spanish: spanish || '(Sin respuesta)',
    translation: translation || undefined,
  };
}

function safeSpanish(spanish: string): string {
  return spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();
}

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const heardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenOpeningForKind = useRef<LessonKind | null>(null);
  const voiceStateRef = useRef<VoiceButtonState>('idle');

  const [lessonKind, setLessonKind] = useState<LessonKind>('grammar');
  const [lessonFocus, setLessonFocus] = useState<LessonFocusContext | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [endingLesson, setEndingLesson] = useState(false);
  const [saveWord, setSaveWord] = useState('');
  const [savingWord, setSavingWord] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [heardTranscript, setHeardTranscript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'web');
  const [revealedJaviId, setRevealedJaviId] = useState<string | null>(null);

  voiceStateRef.current = voiceState;

  const latestJaviId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

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
    setLoadingFocus(true);
    spokenOpeningForKind.current = null;
    setRevealedJaviId(null);
    setHeardTranscript(null);
    setVoiceError(null);
    stopJaviSpeech();

    prepareLessonFocus(lessonKind)
      .then((focus) => {
        if (cancelled) return;
        const opening = buildLessonOpening(focus);
        const lessonType = lessonKindToLessonType(lessonKind);
        setLessonFocus(focus);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            spanish: opening.spanish,
            translation: opening.translation,
          },
        ]);
        setLessonSession({
          lessonType,
          lessonFocus: focus,
          conversation: [],
          analysis: undefined,
          drills: undefined,
          writingTask: undefined,
          writingEvaluation: undefined,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLessonFocus(null);
        setMessages([
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
  }, [lessonKind]);

  useEffect(() => {
    if (loadingFocus || Platform.OS === 'web') return;
    const opening = messages.find((m) => m.role === 'assistant');
    if (!opening) return;
    if (spokenOpeningForKind.current === lessonKind) return;
    spokenOpeningForKind.current = lessonKind;
    void speakJaviMessage(opening.spanish);
  }, [lessonKind, loadingFocus, messages, speakJaviMessage]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, heardTranscript, voiceError, revealedJaviId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ensureMicPermission().then((result) => {
      setMicGranted(result.granted);
      if (!result.granted && result.status === 'denied') {
        setVoiceError(MIC_DENIED_MESSAGE);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (heardTimerRef.current) clearTimeout(heardTimerRef.current);
      stopJaviSpeech();
      void stopVoiceRecording();
    };
  }, []);

  const saveWordToList = async () => {
    const trimmed = saveWord.trim();
    if (!trimmed || savingWord) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSavingWord(true);
    try {
      const result = await saveVocabularyWord(trimmed);
      setSaveWord('');
      setSaveConfirmation(
        result.alreadyExists
          ? '💾 Already in your list'
          : '💾 Saved — Javi will drill you on this',
      );
      setTimeout(() => setSaveConfirmation(null), 2800);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save word.';
      Alert.alert('Save failed', message);
    } finally {
      setSavingWord(false);
    }
  };

  const endLesson = async () => {
    if (endingLesson) return;
    stopJaviSpeech();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const lessonType = lessonKindToLessonType(lessonKind);
    const conversation: LessonConversationTurn[] = messages.map((m) => ({
      role: m.role,
      spanish: m.spanish,
      translation: m.translation,
    }));

    setEndingLesson(true);
    try {
      setLessonSession({
        lessonType,
        lessonFocus: lessonFocus ?? undefined,
        conversation,
        analysis: undefined,
        drills: undefined,
        writingTask: undefined,
        writingEvaluation: undefined,
      });
      router.push('/writing');
    } finally {
      setEndingLesson(false);
    }
  };

  const sendTranscription = async (trimmed: string) => {
    if (!trimmed || !lessonFocus || loadingFocus) return;

    const priorForApi: JaviMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.spanish,
    }));

    const lessonType = lessonKindToLessonType(lessonKind);
    setMessages((prev) => [...prev, { id: newId(), role: 'user', spanish: trimmed }]);
    setRevealedJaviId(null);

    try {
      const javiText = await askJavi(lessonType, trimmed, priorForApi, lessonFocus);
      const parsed = parseJaviResponse(javiText);
      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          spanish: parsed.spanish,
          translation: parsed.translation,
        },
      ]);
      await speakJaviMessage(parsed.spanish);
    } catch {
      setVoiceError('Connection issue — check your internet');
      setVoiceStateSafe('idle');
    }
  };

  const handlePressIn = async () => {
    if (voiceStateRef.current !== 'idle' || !lessonFocus || loadingFocus || endingLesson) return;

    if (Platform.OS === 'web') {
      setVoiceError('Voice mode works on iOS and Android. Use the mobile app to speak with Javi.');
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
        if (result.reason === 'api') {
          setVoiceError('Connection issue — check your internet');
        } else {
          setVoiceError("Javi didn't catch that — try again 🎤");
        }
        return;
      }

      showHeardTranscript(result.text);
      await sendTranscription(result.text);
    } catch {
      setVoiceStateSafe('idle');
      setVoiceError('Connection issue — check your internet');
    }
  };

  const micDisabled =
    loadingFocus ||
    endingLesson ||
    !lessonFocus ||
    !micGranted ||
    voiceState === 'processing' ||
    voiceState === 'javi-speaking';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back to home">
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
                  onPress={() => setLessonKind(opt.id)}
                  style={[styles.lessonChip, selected && styles.lessonChipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.label}>
                  <Text style={[styles.lessonChipText, selected && styles.lessonChipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.screenTitle}>{"Today's Lesson"}</Text>
          <Text style={styles.screenSubtitle}>Speak with Javi</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          {loadingFocus ? (
            <ActivityIndicator color={palette.muted} style={{ marginTop: 24 }} />
          ) : (
            <VoiceConversationLog
              messages={messages}
              latestJaviId={latestJaviId}
              revealedJaviId={revealedJaviId}
              onRevealLatestJavi={() => {
                if (latestJaviId) setRevealedJaviId(latestJaviId);
              }}
            />
          )}

          <View style={styles.toolsBlock}>
            <Pressable
              onPress={endLesson}
              disabled={endingLesson}
              style={({ pressed }) => [
                styles.summaryButton,
                endingLesson && styles.summaryButtonDisabled,
                pressed && styles.summaryButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="End lesson and continue to writing">
              {endingLesson ? (
                <ActivityIndicator color="#0B0F14" size="small" />
              ) : (
                <Text style={styles.summaryButtonText}>End Lesson</Text>
              )}
            </Pressable>

            <View style={styles.saveWordRow}>
              <Text style={styles.saveWordLabel}>Save a word 📝</Text>
              <TextInput
                style={styles.saveWordInput}
                value={saveWord}
                onChangeText={setSaveWord}
                placeholder="Spanish word…"
                placeholderTextColor={palette.muted}
                editable={!savingWord}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void saveWordToList()}
              />
              <Pressable
                onPress={() => void saveWordToList()}
                disabled={savingWord || !saveWord.trim()}
                style={({ pressed }) => [
                  styles.saveWordButton,
                  (savingWord || !saveWord.trim()) && styles.saveWordButtonDisabled,
                  pressed && saveWord.trim() && !savingWord && styles.saveWordButtonPressed,
                ]}>
                {savingWord ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.saveWordButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
            {saveConfirmation ? (
              <Text style={styles.saveConfirmation}>{saveConfirmation}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.voiceDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
          <Text style={styles.voiceHint}>
            {voiceState === 'javi-speaking'
              ? 'Javi is speaking…'
              : voiceState === 'processing'
                ? 'Processing…'
                : voiceState === 'recording'
                  ? 'Release when finished'
                  : 'Hold to speak'}
          </Text>
        </View>
      </View>
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
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.accent,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  lessonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  lessonChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  lessonChipSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accent,
  },
  lessonChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  lessonChipTextSelected: {
    color: palette.text,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text,
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.muted,
  },
  chatScroll: {
    flex: 1,
    minHeight: 120,
  },
  chatScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  toolsBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    gap: 12,
  },
  summaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryButtonPressed: {
    opacity: 0.88,
  },
  summaryButtonDisabled: {
    opacity: 0.5,
  },
  summaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.1,
  },
  saveWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveWordLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    flexShrink: 0,
  },
  saveWordInput: {
    flex: 1,
    minHeight: 36,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: palette.text,
  },
  saveWordButton: {
    backgroundColor: palette.surfaceBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 56,
    alignItems: 'center',
  },
  saveWordButtonPressed: {
    opacity: 0.9,
  },
  saveWordButtonDisabled: {
    opacity: 0.45,
  },
  saveWordButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
  },
  saveConfirmation: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.accent,
    marginTop: -4,
  },
  voiceDock: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    backgroundColor: palette.background,
    gap: 8,
  },
  heardText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
    textAlign: 'center',
    maxWidth: '100%',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.error,
    textAlign: 'center',
    maxWidth: '100%',
  },
  voiceHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 2,
  },
});
