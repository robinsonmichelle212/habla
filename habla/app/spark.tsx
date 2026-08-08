import { AppTextInput } from '@/components/app-text-input';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { TextMessageBubble } from '@/components/text-message-bubble';
import { parseJaviResponse, safeSpanish } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { ensureMicPermission, MIC_DENIED_MESSAGE } from '@/lib/mic-permission';
import {
  completeSparkSession,
  getSparkClosingReply,
  sparkOpeningSpanish,
} from '@/lib/spark';
import {
  MIN_RECORDING_MS,
  ensureRecordingStopped,
  startVoiceRecording,
  stopVoiceRecording,
} from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
  accentPressed: '#E86242',
  accentMuted: 'rgba(255, 122, 89, 0.18)',
};

type InputMode = 'voice' | 'text';
type Phase = 'chat' | 'done';

export default function SparkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const voiceStateRef = useRef<VoiceButtonState>('idle');

  const [opening] = useState(() => sparkOpeningSpanish());
  const [phase, setPhase] = useState<Phase>('chat');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [userSpanish, setUserSpanish] = useState<string | null>(null);
  const [javiClosing, setJaviClosing] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'web');
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ensureMicPermission().then((r) => {
      setMicGranted(r.granted);
      if (!r.granted && r.status === 'denied') setVoiceError(MIC_DENIED_MESSAGE);
    });
    return () => {
      stopJaviSpeech();
      void ensureRecordingStopped();
    };
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [userSpanish, javiClosing, phase]);

  const finishWithReply = useCallback(async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setUserSpanish(trimmed);
    setTextInput('');
    try {
      const closing = await getSparkClosingReply(trimmed, opening);
      const spanish = safeSpanish(parseJaviResponse(closing).spanish);
      setJaviClosing(spanish);
      if (Platform.OS !== 'web') {
        void speakJavi(spanish);
      }
      const { streak } = await completeSparkSession();
      setStreakDays(streak.currentStreak);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTimeout(() => setPhase('done'), 1400);
    } finally {
      setSending(false);
      setVoiceState('idle');
    }
  }, [opening, sending]);

  const handlePressIn = async () => {
    if (sending || voiceStateRef.current === 'recording') return;
    setVoiceError(null);
    const perm = await ensureMicPermission();
    setMicGranted(perm.granted);
    if (!perm.granted) {
      setVoiceError(MIC_DENIED_MESSAGE);
      return;
    }
    try {
      await startVoiceRecording();
      setVoiceState('recording');
    } catch {
      setVoiceError('Could not start recording.');
      setVoiceState('idle');
    }
  };

  const handlePressOut = async () => {
    if (voiceStateRef.current !== 'recording') return;
    setVoiceState('processing');
    try {
      const result = await stopVoiceRecording();
      if (!result.uri || result.durationMs < MIN_RECORDING_MS) {
        setVoiceError('Hold a little longer, then speak.');
        setVoiceState('idle');
        return;
      }
      const transcription = await transcribeSpanishAudio(result.uri);
      if (!transcription.ok) {
        setVoiceError(
          transcription.reason === 'offline'
            ? 'Needs internet for voice — try typing instead.'
            : 'No speech detected — try again.',
        );
        setVoiceState('idle');
        return;
      }
      await finishWithReply(transcription.text);
    } catch {
      setVoiceError('Could not process audio.');
      setVoiceState('idle');
    }
  };

  if (phase === 'done') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={[styles.doneWrap, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.doneTitle}>
            ⚡ Streak saved. 🔥 {streakDays} day{streakDays === 1 ? '' : 's'}.
          </Text>
          <Text style={styles.doneSub}>Mañana, más. / Tomorrow, more.</Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}>
            <Text style={styles.doneButtonText}>Listo →</Text>
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
        style={styles.flex}
        keyboardVerticalOffset={80}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>⚡ Streak</Text>
            <Text style={styles.subtitle}>Una frase. Eso es todo.</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextMessageBubble role="assistant" spanish={opening} />
          {userSpanish ? <TextMessageBubble role="user" spanish={userSpanish} /> : null}
          {javiClosing ? <TextMessageBubble role="assistant" spanish={javiClosing} /> : null}
          {sending ? <ActivityIndicator color={palette.muted} style={{ marginTop: 12 }} /> : null}
        </ScrollView>

        {!userSpanish ? (
          <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => setInputMode('voice')}
                style={[styles.modeChip, inputMode === 'voice' && styles.modeChipActive]}>
                <Text style={[styles.modeChipText, inputMode === 'voice' && styles.modeChipTextActive]}>
                  🎤
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setInputMode('text')}
                style={[styles.modeChip, inputMode === 'text' && styles.modeChipActive]}>
                <Text style={[styles.modeChipText, inputMode === 'text' && styles.modeChipTextActive]}>
                  ✍️
                </Text>
              </Pressable>
            </View>

            {inputMode === 'text' ? (
              <View style={styles.composeRow}>
                <AppTextInput
                  style={styles.input}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Escribe una frase…"
                  placeholderTextColor={palette.muted}
                  multiline
                  scrollEnabled
                  blurOnSubmit={false}
                  editable={!sending}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => void finishWithReply(textInput)}
                  disabled={sending || !textInput.trim()}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (!textInput.trim() || sending) && styles.sendButtonDisabled,
                    pressed && textInput.trim() && !sending && styles.sendButtonPressed,
                  ]}>
                  {sending ? (
                    <ActivityIndicator color="#0B0F14" size="small" />
                  ) : (
                    <Text style={styles.sendButtonText}>Send</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.voiceBlock}>
                {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
                <PushToTalkButton
                  state={voiceState}
                  disabled={sending || !micGranted || Platform.OS === 'web'}
                  onPressIn={() => void handlePressIn()}
                  onPressOut={() => void handlePressOut()}
                />
                <Text style={styles.voiceHint}>
                  {Platform.OS === 'web'
                    ? 'Use text mode on web'
                    : voiceState === 'recording'
                      ? 'Release when finished'
                      : 'Hold to speak one sentence'}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  back: { fontSize: 24, fontWeight: '600', color: palette.accent, marginTop: 2 },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '900', color: palette.text },
  subtitle: { fontSize: 15, fontWeight: '600', color: palette.muted },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  dock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    gap: 10,
  },
  modeToggle: { flexDirection: 'row', gap: 8 },
  modeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  modeChipActive: { borderColor: palette.accent, backgroundColor: palette.accentMuted },
  modeChipText: { fontSize: 16, color: palette.muted },
  modeChipTextActive: { color: palette.accent },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
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
    minHeight: 44,
    justifyContent: 'center',
  },
  sendButtonPressed: { backgroundColor: palette.accentPressed },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { fontSize: 15, fontWeight: '800', color: '#0B0F14' },
  voiceBlock: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  voiceHint: { fontSize: 13, fontWeight: '600', color: palette.muted },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center' },
  doneWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 30,
  },
  doneSub: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonPressed: { backgroundColor: palette.accentPressed },
  doneButtonText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
});
