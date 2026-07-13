import { ConversationInputLayout } from '@/components/conversation-input-layout';
import { TextMessageBubble } from '@/components/text-message-bubble';
import { analyzeConversation, evaluateWriting, generateWritingTask } from '@/lib/claude';
import { mergeErrorDnaFromLesson } from '@/lib/error-dna';
import { addGems, OFFLINE_WRITING_GEMS } from '@/lib/gems';
import { buildOfflineLessonAnalysis, buildPendingWritingEvaluation } from '@/lib/offline-lesson';
import { focusCacheKey, getOfflineWritingPrompt } from '@/lib/offline-lesson-content';
import { mergeWritingIntoBreakdown } from '@/lib/merge-writing-breakdown';
import { materializeBreakdownSkillTabs } from '@/lib/skill-tab-insights';
import { lessonFocusLabel } from '@/lib/lesson-focus';
import {
  conversationToJaviMessages,
  getLessonSession,
  setLessonSession,
  type WritingEvaluation,
} from '@/lib/lesson-session';
import { checkIsOnline } from '@/lib/network-status';
import { addPendingWritingTask } from '@/lib/pending-writing-storage';
import { cacheWritingTask, getCachedWritingTask } from '@/lib/writing-task-cache';
import { buildInterleavingContext } from '@/lib/interleaving';
import { formatLocalDate } from '@/lib/streak';

const WRITING_PRACTICE_KEY = 'writingPracticePrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  const { practice } = useLocalSearchParams<{ practice?: string }>();
  const isPracticeReplay = practice === '1';
  const insets = useSafeAreaInsets();
  const resultsScrollRef = useRef<ScrollView>(null);
  const session = useMemo(() => getLessonSession(), []);
  const lessonType = session.lessonType;
  const lessonFocus = session.lessonFocus;
  const conversation =
    session.conversation.length > 0
      ? session.conversation
      : session.warmUpConversation ?? [];
  const focusLabel = lessonFocus ? lessonFocusLabel(lessonFocus) : undefined;

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

    if (!lessonType || !lessonFocus || !conversation.length) {
      if (isPracticeReplay) {
        void AsyncStorage.getItem(WRITING_PRACTICE_KEY).then((stored) => {
          if (stored) {
            setTaskPrompt(stored);
            setLessonSession({ writingTask: { prompt: stored } });
          } else {
            Alert.alert('No writing task', 'Complete a lesson first to unlock writing practice.');
          }
        });
        return;
      }
      Alert.alert('No lesson found', 'Go back and complete a lesson first.');
      return;
    }

    if (taskPrompt) return;

    setLoadingTask(true);
    void (async () => {
      try {
        const online = await checkIsOnline();
        if (!online && lessonFocus) {
          const focusKey = focusCacheKey(lessonFocus);
          const cached = await getCachedWritingTask(lessonType, focusKey);
          const prompt = cached ?? getOfflineWritingPrompt(lessonFocus);
          setTaskPrompt(prompt);
          setLessonSession({ writingTask: { prompt } });
          return;
        }

        const t = await generateWritingTask(
          lessonType,
          conversationToJaviMessages(conversation),
          lessonFocus!,
          await buildInterleavingContext(),
        );
        setTaskPrompt(t.prompt);
        setLessonSession({ writingTask: { prompt: t.prompt } });
        if (lessonFocus) {
          await cacheWritingTask(lessonType, focusCacheKey(lessonFocus), t.prompt);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong.';
        Alert.alert('Could not load writing task', message);
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [conversation, isPracticeReplay, lessonFocus, lessonType, taskPrompt]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting || !taskPrompt) return;
    const activeLessonType = lessonType ?? 'Grammar';

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setSubmitting(true);
    try {
      const online = await checkIsOnline();

      if (!online && lessonFocus) {
        const taskId = `writing-pending-${Date.now()}`;
        const lessonDate = formatLocalDate();

        await addPendingWritingTask({
          id: taskId,
          writtenResponse: trimmed,
          lessonDate,
          lessonType: activeLessonType,
          grammarTopic:
            lessonFocus.kind === 'grammar' ? lessonFocus.topic : lessonFocusLabel(lessonFocus),
          writingPrompt: taskPrompt,
          submittedAt: Date.now(),
          evaluated: false,
          warmUpConversation: conversation,
          lessonFocusLabel: lessonFocusLabel(lessonFocus),
          lessonTypeEnum: activeLessonType,
        });

        const evaluation = buildPendingWritingEvaluation(trimmed);
        evaluation.pendingTaskId = taskId;
        setResult(evaluation);
        setLessonSession({ writingEvaluation: evaluation });
        await addGems(OFFLINE_WRITING_GEMS);
        return;
      }

      const evalJson = await evaluateWriting(
        activeLessonType,
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
        accentIssues: Array.isArray(evalJson.accentIssues) ? evalJson.accentIssues : [],
        structuralFeedback: Array.isArray(evalJson.structuralFeedback)
          ? evalJson.structuralFeedback
          : [],
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
      const online = await checkIsOnline();

      if (!online && lessonFocus) {
        const analysis = buildOfflineLessonAnalysis(
          lessonType,
          lessonFocus,
          result,
          taskPrompt,
          false,
        );
        setLessonSession({ analysis });
        router.replace('/summary');
        return;
      }

      const normalizedWritingScores = {
        grammarScore: Math.max(0, Math.min(100, Math.round(result.grammarScore))),
        vocabularyScore: Math.max(0, Math.min(100, Math.round(result.vocabularyScore))),
        fluencyScore: Math.max(0, Math.min(100, Math.round(result.fluencyScore))),
      };

      const analysisJson = await analyzeConversation(
        lessonType,
        conversationToJaviMessages(conversation),
        normalizedWritingScores,
        focusLabel,
      );
      const g = normalizedWritingScores.grammarScore;
      const v = normalizedWritingScores.vocabularyScore;
      const f = normalizedWritingScores.fluencyScore;
      const w = Math.round((g + v + f) / 3);
      const baseBreakdown = analysisJson.breakdown ?? {
        grammar: { score: g, topic: focusLabel ?? 'Grammar', details: [], lessonDescription: '', mistakes: [] },
        vocabulary: { score: v, topic: 'Vocabulary', details: [], wordsCorrect: [], wordsToRevisit: [] },
        fluency: {
          score: f,
          details: [],
          description: '',
          positivePatterns: [],
          negativePatterns: [],
          sentenceNotes: [],
          weeklyTips: [],
        },
        writing: { score: w, details: [] },
      };
      const analysis = {
        strongAreas: analysisJson.strongAreas ?? [],
        weakAreas: analysisJson.weakAreas ?? [],
        focusAreas: analysisJson.focusAreas ?? [],
        correctnessScore: analysisJson.correctnessScore ?? 0,
        overallScore: analysisJson.overallScore ?? analysisJson.correctnessScore ?? 0,
        encouragingMessage: analysisJson.encouragingMessage ?? '',
        breakdown: materializeBreakdownSkillTabs(
          mergeWritingIntoBreakdown(baseBreakdown, result, taskPrompt),
          {
            strongAreas: analysisJson.strongAreas,
            weakAreas: analysisJson.weakAreas,
            focusAreas: analysisJson.focusAreas,
          },
        ),
      };
      if (analysisJson.errorDNA?.length) {
        await mergeErrorDnaFromLesson(analysisJson.errorDNA);
      }
      setLessonSession({ analysis });
      router.replace('/summary');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not build summary', message);
    }
  };

  const conversationContent = (
    <>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.backLink}>← Lesson</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Writing Task</Text>
      <Text style={styles.subtitle}>Show what you learned (Spanish only).</Text>

      {conversation.length ? (
        <View style={styles.conversationSection}>
          <Text style={styles.conversationTitle}>Your conversation</Text>
          {conversation.map((m, i) => (
            <TextMessageBubble
              key={`${i}-${m.spanish}`}
              role={m.role}
              spanish={m.spanish}
              translation={m.translation}
            />
          ))}
        </View>
      ) : null}
    </>
  );

  const submitFooter = (
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
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      {result ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}>
          <ScrollView
            ref={resultsScrollRef}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {conversationContent}

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {result.pendingEvaluation ? '✍️ Writing submitted — evaluation pending ⏳' : 'Results'}
              </Text>
            </View>

            {result.pendingEvaluation ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackText}>{result.feedback}</Text>
              </View>
            ) : (
              <>
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
              </>
            )}

            <Pressable
              onPress={continueToSummary}
              style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue to summary">
              <Text style={styles.continueButtonText}>Continue to Summary</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ConversationInputLayout
          prompt={taskPrompt}
          promptLoading={loadingTask}
          inputValue={text}
          onChangeText={setText}
          inputPlaceholder="Write your response in Spanish..."
          inputEditable={!submitting}
          footer={submitFooter}
          bottomInset={Math.max(insets.bottom, 12)}
          scrollToEndDeps={[conversation.length, taskPrompt, loadingTask]}
          contentContainerStyle={styles.scrollContent}>
          {conversationContent}
        </ConversationInputLayout>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  topRow: { marginBottom: 12 },
  backLink: { fontSize: 16, fontWeight: '700', color: palette.blue },
  title: { fontSize: 28, fontWeight: '900', color: palette.text, letterSpacing: -0.5 },
  subtitle: { marginTop: 6, fontSize: 14, fontWeight: '600', color: palette.muted, marginBottom: 18 },
  conversationSection: { marginBottom: 8 },
  conversationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
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
