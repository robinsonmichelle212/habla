import { askJavi, lessonKindToLessonType, type JaviMessage } from '@/lib/claude';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
import {
  buildLessonOpening,
  prepareLessonFocus,
  type LessonFocusContext,
} from '@/lib/lesson-focus';
import {
  setLessonSession,
  type LessonConversationTurn,
} from '@/lib/lesson-session';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
  bubbleAi: '#1E2633',
  bubbleUser: '#2A1F2E',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  accentMuted: 'rgba(255, 122, 89, 0.18)',
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

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseJaviResponse(fullText: string): { spanish: string; translation?: string } {
  const raw = fullText.trim();
  if (!raw) return { spanish: '(Sin respuesta)' };

  // Extract at the first "Translate:" line so English never leaks into the Spanish part.
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

function MessageBubble({
  role,
  spanish,
  translation,
}: {
  role: ChatMessage['role'];
  spanish: string;
  translation?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const isAssistant = role === 'assistant';
  const canReveal = isAssistant && !!translation;
  // Safety: show only the Spanish part before any Translate label, even if formatting varies.
  const safeSpanish = spanish
    .split(/\r?\n\s*(Translate|Translation)\s*:/i)[0]
    .trim();

  return (
    <View
      style={[
        styles.bubbleOuter,
        isAssistant ? styles.bubbleOuterAi : styles.bubbleOuterUser,
      ]}>
      <View
        style={[
          styles.bubble,
          isAssistant ? styles.bubbleAi : styles.bubbleUser,
        ]}>
        <Text style={styles.bubbleText}>{safeSpanish}</Text>
      </View>

      {canReveal ? (
        <View style={styles.translationBlock}>
          {revealed ? (
            <>
              <Pressable
                onPress={() => setRevealed(false)}
                accessibilityRole="button"
                accessibilityLabel="Hide translation"
                style={({ pressed }) => [
                  styles.revealTranslationButton,
                  pressed && styles.revealTranslationButtonPressed,
                ]}>
                <Text style={styles.revealTranslationText}>Hide</Text>
              </Pressable>
              <Text style={styles.translationText}>{translation}</Text>
            </>
          ) : (
            <Pressable
              onPress={() => setRevealed(true)}
              accessibilityRole="button"
              accessibilityLabel="Reveal translation"
              style={({ pressed }) => [
                styles.revealTranslationButton,
                pressed && styles.revealTranslationButtonPressed,
              ]}>
              <Text style={styles.revealTranslationText}>👁️ Reveal</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);
  const replyInputRef = useRef<TextInput>(null);
  const [lessonKind, setLessonKind] = useState<LessonKind>('grammar');
  const [lessonFocus, setLessonFocus] = useState<LessonFocusContext | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [endingLesson, setEndingLesson] = useState(false);
  const [saveWord, setSaveWord] = useState('');
  const [savingWord, setSavingWord] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingFocus(true);

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
        setReply('');
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
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [messages])

  useEffect(() => {
    const keyboardListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
    })
    return () => keyboardListener.remove()
  }, [])

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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const lessonType = lessonKindToLessonType(lessonKind);
    const conversation: LessonConversationTurn[] = messages.map((m) => ({
      role: m.role,
      spanish: m.spanish,
      translation: m.translation,
    }));

    // Persist lesson context for the writing screen.
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

  const sendMessage = async () => {
    const trimmed = reply.trim();
    if (!trimmed || sending || !lessonFocus || loadingFocus) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const priorForApi: JaviMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.spanish,
    }));

    const lessonType = lessonKindToLessonType(lessonKind);
    setReply('');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', spanish: trimmed },
    ]);

    try {
      const javiText = await askJavi(lessonType, trimmed, priorForApi, lessonFocus);
      const parsed = parseJaviResponse(javiText);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          spanish: parsed.spanish,
          translation: parsed.translation,
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not reach Javi', message);
      setReply(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
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
          <Text style={styles.screenSubtitle}>AI Conversation Practice</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              spanish={m.spanish}
              translation={m.translation}
            />
          ))}
          <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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

            <View style={styles.composeRow}>
              <TextInput
                ref={replyInputRef}
                style={styles.input}
                value={reply}
                onChangeText={setReply}
                placeholder="Type your reply..."
                placeholderTextColor={palette.muted}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                editable={!sending && !loadingFocus}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 60);
                }}
              />
              <Pressable
                onPress={sendMessage}
                disabled={sending || loadingFocus || !reply.trim() || !lessonFocus}
                style={({ pressed }) => [
                  styles.sendButton,
                  (sending || !reply.trim()) && styles.sendButtonDisabled,
                  pressed && !sending && reply.trim() && styles.sendButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message">
                {sending ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 16,
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
    gap: 10,
  },
  bubbleOuter: {
    width: '100%',
  },
  bubbleOuterAi: {
    alignItems: 'flex-start',
  },
  bubbleOuterUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: palette.bubbleAi,
    borderColor: palette.surfaceBorder,
    borderBottomLeftRadius: 6,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: palette.bubbleUser,
    borderColor: 'rgba(255, 122, 89, 0.35)',
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: palette.text,
  },
  translationBlock: {
    alignSelf: 'flex-start',
    marginTop: 6,
    maxWidth: '88%',
  },
  revealTranslationButton: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  revealTranslationButtonPressed: {
    backgroundColor: 'rgba(139, 149, 165, 0.12)',
  },
  revealTranslationText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.2,
  },
  translationText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
  },
  inputWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    backgroundColor: palette.background,
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
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  sendButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    backgroundColor: palette.accentPressed,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B0F14',
  },
});
