import { AppTextInput } from '@/components/app-text-input';
import { TextMessageBubble } from '@/components/text-message-bubble';
import type { LessonType } from '@/lib/claude';
import {
  buildFeynmanQuestion,
  evaluateFeynmanAttempt,
  MAX_FEYNMAN_ATTEMPTS,
  type FeynmanCheckResult,
} from '@/lib/feynman';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { checkIsOnline } from '@/lib/network-status';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  ink: '#0B0F14',
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

type Props = {
  focus: LessonFocusContext;
  lessonType: LessonType;
  topic?: string;
  dialect?: string;
  demoMode?: boolean;
  showSkip?: boolean;
  skipOnFailure?: boolean;
  offlineAsSkip?: boolean;
  onComplete: (result: FeynmanCheckResult) => void;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toResultMessages(messages: ChatMessage[]): FeynmanCheckResult['messages'] {
  return messages.map((m) => ({
    role: m.role,
    spanish: m.spanish,
    translation: m.translation,
  }));
}

export function FeynmanCheck({
  focus,
  lessonType,
  topic,
  demoMode = false,
  showSkip = false,
  skipOnFailure = false,
  offlineAsSkip = false,
  onComplete,
}: Props) {
  const question = useMemo(() => buildFeynmanQuestion(focus), [focus]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: newId(),
      role: 'assistant',
      spanish: question.spanish,
      translation: question.translation,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const lastExplanationRef = useRef('');
  const completedRef = useRef(false);

  const finish = useCallback(
    (result: FeynmanCheckResult) => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(result);
    },
    [onComplete],
  );

  const skip = useCallback(
    (messagesSnapshot: ChatMessage[], attemptCount: number, explanation = '') => {
      finish({
        explanation,
        feedback: '',
        attempts: attemptCount,
        skipped: true,
        messages: toResultMessages(messagesSnapshot),
      });
    },
    [finish],
  );

  useEffect(() => {
    if (!offlineAsSkip) return;
    let cancelled = false;
    void (async () => {
      const online = await checkIsOnline();
      if (cancelled || online || completedRef.current) return;
      skip(messages, 0);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount for offline skip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeSuccess = (
    messagesSnapshot: ChatMessage[],
    attemptCount: number,
    feedback: string,
  ) => {
    finish({
      explanation: lastExplanationRef.current,
      feedback,
      attempts: attemptCount,
      skipped: false,
      messages: toResultMessages(messagesSnapshot),
    });
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || completedRef.current) return;
    lastExplanationRef.current = trimmed;
    const attempt = attempts + 1;
    setAttempts(attempt);
    setInput('');
    setSending(true);
    const withUser: ChatMessage[] = [
      ...messages,
      { id: newId(), role: 'user', spanish: trimmed },
    ];
    setMessages(withUser);

    const passReply: ChatMessage = {
      id: newId(),
      role: 'assistant',
      spanish: 'Perfecto. Lo entiendes bien. Ahora vamos a practicarlo.',
      translation: 'Perfect. You understand it well. Now let\'s practise it.',
    };

    try {
      if (demoMode) {
        const next = [...withUser, passReply];
        setMessages(next);
        setTimeout(() => completeSuccess(next, attempt, passReply.spanish), 800);
        return;
      }

      const online = await checkIsOnline();
      if (!online) {
        if (offlineAsSkip) {
          skip(withUser, attempt, trimmed);
          return;
        }
        const next = [...withUser, passReply];
        setMessages(next);
        setTimeout(() => completeSuccess(next, attempt, passReply.spanish), 800);
        return;
      }

      const evaluation = await evaluateFeynmanAttempt(
        lessonType,
        focus,
        question.conceptLabel,
        trimmed,
        attempt,
      );
      const javiMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        spanish: evaluation.javiSpanish,
        translation: evaluation.javiTranslation,
      };
      const next = [...withUser, javiMsg];
      setMessages(next);
      if (evaluation.moveToWriting || attempt >= MAX_FEYNMAN_ATTEMPTS) {
        setTimeout(() => completeSuccess(next, attempt, evaluation.javiSpanish), 800);
      }
    } catch {
      if (skipOnFailure) {
        skip(withUser, attempt, trimmed);
        return;
      }
      Alert.alert('Connection issue', 'Check your internet and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Explain {topic ?? 'the concept'} in your own words — Javi will check your understanding.
      </Text>
      {messages.map((m) => (
        <TextMessageBubble
          key={m.id}
          role={m.role}
          spanish={m.spanish}
          translation={m.translation}
          messageKey={m.id}
          animateTyping={m.role === 'assistant' && m.id === messages[messages.length - 1]?.id}
        />
      ))}
      <View style={styles.composeRow}>
        <AppTextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your reply..."
          placeholderTextColor={palette.muted}
          multiline
          editable={!sending}
          textAlignVertical="top"
        />
        <Pressable
          onPress={() => void send()}
          disabled={sending || !input.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (!input.trim() || sending) && styles.sendDisabled,
            pressed && input.trim() && !sending && styles.sendPressed,
          ]}>
          {sending ? (
            <ActivityIndicator color={palette.ink} size="small" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
      {showSkip ? (
        <Pressable
          onPress={() => skip(messages, attempts, lastExplanationRef.current)}
          style={styles.skipBtn}
          accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: 4,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
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
  },
  sendPressed: { backgroundColor: palette.accentPressed },
  sendDisabled: { opacity: 0.45 },
  sendText: { fontSize: 15, fontWeight: '800', color: palette.ink },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  skipText: { fontSize: 13, fontWeight: '600', color: palette.muted },
});
