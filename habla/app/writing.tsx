import { analyzeConversation, evaluateWriting, generateWritingTask } from '@/lib/claude';
import {
  conversationToJaviMessages,
  getLessonSession,
  setLessonSession,
  type WritingEvaluation,
} from '@/lib/lesson-session';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  TouchableOpacity,
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
  greenBg: 'rgba(52, 211, 153, 0.12)',
  amber: '#FBBF24',
  amberBg: 'rgba(251, 191, 36, 0.12)',
  blue: '#60A5FA',
};

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

export default function WritingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const writingInputRef = useRef<TextInput>(null);
  const session = useMemo(() => getLessonSession(), []);
  const lessonType = session.lessonType;
  const conversation = session.conversation;

  const [taskPrompt, setTaskPrompt] = useState(session.writingTask?.prompt ?? '');
  const [loadingTask, setLoadingTask] = useState(false);
  const [text, setText] = useState(session.writingEvaluation?.originalText ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WritingEvaluation | null>(
    session.writingEvaluation ?? null,
  );

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    if (!lessonType || !conversation.length) {
      Alert.alert('No lesson found', 'Go back and complete a lesson first.');
      return;
    }

    if (taskPrompt) return;

    setLoadingTask(true);
    generateWritingTask(lessonType, conversationToJaviMessages(conversation))
      .then((t) => {
        setTaskPrompt(t.prompt);
        setLessonSession({ writingTask: { prompt: t.prompt } });
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Something went wrong.';
        Alert.alert('Could not load writing task', message);
      })
      .finally(() => setLoadingTask(false));
  }, [conversation, lessonType, taskPrompt]);

  const submit = async () => {
    if (!lessonType) return;
    const trimmed = text.trim();
    if (!trimmed || submitting || !taskPrompt) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setSubmitting(true);
    try {
      const evalJson = await evaluateWriting(
        lessonType,
        taskPrompt,
        conversationToJaviMessages(conversation),
        trimmed,
      );

      const evaluation: WritingEvaluation = {
        originalText: trimmed,
        correctedText: evalJson.correctedText,
        grammarScore: evalJson.grammarScore,
        vocabularyScore: evalJson.vocabularyScore,
        fluencyScore: evalJson.fluencyScore,
        feedback: evalJson.feedback,
        corrections: Array.isArray(evalJson.corrections) ? evalJson.corrections : [],
      };

      setResult(evaluation);
      setLessonSession({ writingEvaluation: evaluation });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not evaluate writing', message);
    } finally {
      setSubmitting(false);
    }
  };

  const continueToSummary = async () => {
    if (!lessonType || !conversation.length || !result) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const normalizedWritingScores = {
        grammarScore: Math.max(0, Math.min(100, Math.round(result.grammarScore))),
        vocabularyScore: Math.max(0, Math.min(100, Math.round(result.vocabularyScore))),
        fluencyScore: Math.max(0, Math.min(100, Math.round(result.fluencyScore))),
      };

      const analysis = await analyzeConversation(
        lessonType,
        conversationToJaviMessages(conversation),
        normalizedWritingScores,
      );
      setLessonSession({ analysis });
      router.push('/summary');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not build summary', message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.backLink}>← Lesson</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Writing Task</Text>
        <Text style={styles.subtitle}>Show what you learned (Spanish only).</Text>

        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>Javi’s prompt</Text>
          {loadingTask ? (
            <ActivityIndicator color={palette.muted} />
          ) : (
            <Text style={styles.taskText}>{taskPrompt || '—'}</Text>
          )}
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Your writing</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spanishRow}>
            {['á','é','í','ó','ú','ü','ñ','¿','¡','Á','É','Í','Ó','Ú','Ñ'].map((char) => (
              <TouchableOpacity key={char} onPress={() => setText((prev) => prev + char)} style={styles.spanishButton}>
                <Text style={styles.spanishButtonText}>{char}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            ref={writingInputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write your response in Spanish..."
            placeholderTextColor={palette.muted}
            multiline
            editable={!submitting}
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 60);
            }}
          />
          <Pressable
            onPress={submit}
            disabled={submitting || !text.trim() || !taskPrompt}
            style={({ pressed }) => [
              styles.submitButton,
              (submitting || !text.trim() || !taskPrompt) && styles.submitButtonDisabled,
              pressed && !submitting && text.trim() && taskPrompt && styles.submitButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Submit writing">
            {submitting ? (
              <ActivityIndicator color="#0B0F14" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>
        </View>

        {result ? (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Results</Text>
            </View>

            <View style={styles.scoreCard}>
              <ProgressBar label="Grammar" value={result.grammarScore} />
              <ProgressBar label="Vocabulary" value={result.vocabularyScore} />
              <ProgressBar label="Fluency" value={result.fluencyScore} />
            </View>

            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Javi’s feedback</Text>
              <Text style={styles.feedbackText}>{result.feedback}</Text>
            </View>

            <View style={styles.compareWrap}>
              <View style={[styles.compareCard, styles.compareOriginal]}>
                <Text style={styles.compareTitle}>Original</Text>
                <Text style={styles.compareText}>{result.originalText}</Text>
              </View>
              <View style={[styles.compareCard, styles.compareCorrected]}>
                <Text style={styles.compareTitle}>Corrected</Text>
                <Text style={styles.compareText}>{result.correctedText}</Text>
              </View>
            </View>

            <View style={styles.correctionsSection}>
              <Text style={styles.correctionsTitle}>Corrections</Text>
              {result.corrections.length ? (
                result.corrections.map((c, idx) => (
                  <View key={`c-${idx}`} style={styles.correctionRow}>
                    <View style={[styles.correctionChip, styles.correctionMistake]}>
                      <Text style={styles.correctionChipLabel}>Mistake</Text>
                      <Text style={styles.correctionChipText}>{c.mistake}</Text>
                    </View>
                    <View style={[styles.correctionChip, styles.correctionFix]}>
                      <Text style={styles.correctionChipLabel}>Correction</Text>
                      <Text style={styles.correctionChipText}>{c.correction}</Text>
                    </View>
                    <Text style={styles.correctionExplanation}>{c.explanation}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noCorrections}>No major issues found. Nice work!</Text>
              )}
            </View>

            <Pressable
              onPress={continueToSummary}
              style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue to summary">
              <Text style={styles.continueButtonText}>Continue to Summary</Text>
            </Pressable>
          </>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  topRow: { marginBottom: 12 },
  backLink: { fontSize: 16, fontWeight: '700', color: palette.blue },
  title: { fontSize: 28, fontWeight: '900', color: palette.text, letterSpacing: -0.5 },
  subtitle: { marginTop: 6, fontSize: 14, fontWeight: '600', color: palette.muted, marginBottom: 18 },
  taskCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  taskTitle: { fontSize: 13, fontWeight: '800', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  taskText: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 20 },
  inputCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  inputLabel: { fontSize: 14, fontWeight: '800', color: palette.text },
  spanishRow: {
    gap: 8,
    paddingVertical: 6,
  },
  spanishButton: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#323C4D',
    backgroundColor: '#0F141C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spanishButtonText: {
    color: '#F4F6F8',
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    minHeight: 120,
    maxHeight: 260,
    backgroundColor: palette.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  submitButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: { backgroundColor: palette.accentPressed },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  resultsHeader: { marginTop: 12, marginBottom: 8 },
  resultsTitle: { fontSize: 18, fontWeight: '900', color: palette.text },
  scoreCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  barRow: { gap: 8 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontSize: 13, fontWeight: '800', color: palette.muted },
  barValue: { fontSize: 13, fontWeight: '900', color: palette.text },
  barTrack: { height: 10, borderRadius: 999, backgroundColor: palette.surfaceBorder, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
  feedbackCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  feedbackTitle: { fontSize: 13, fontWeight: '800', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  feedbackText: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 20 },
  compareWrap: { gap: 10, marginBottom: 12 },
  compareCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  compareOriginal: { backgroundColor: palette.amberBg, borderColor: 'rgba(251, 191, 36, 0.35)' },
  compareCorrected: { backgroundColor: palette.greenBg, borderColor: 'rgba(52, 211, 153, 0.35)' },
  compareTitle: { fontSize: 13, fontWeight: '900', color: palette.text, marginBottom: 8 },
  compareText: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 20 },
  correctionsSection: { marginBottom: 18 },
  correctionsTitle: { fontSize: 16, fontWeight: '900', color: palette.text, marginBottom: 10 },
  correctionRow: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  correctionChip: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  correctionMistake: { backgroundColor: palette.amberBg, borderColor: 'rgba(251, 191, 36, 0.35)' },
  correctionFix: { backgroundColor: palette.greenBg, borderColor: 'rgba(52, 211, 153, 0.35)' },
  correctionChipLabel: { fontSize: 11, fontWeight: '900', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  correctionChipText: { fontSize: 14, fontWeight: '800', color: palette.text, lineHeight: 18 },
  correctionExplanation: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18 },
  noCorrections: { fontSize: 14, fontWeight: '700', color: palette.muted },
  continueButton: {
    backgroundColor: palette.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  continueButtonPressed: { opacity: 0.92 },
  continueButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
});

