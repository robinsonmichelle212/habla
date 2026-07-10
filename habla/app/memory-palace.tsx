import { AppTextInput } from '@/components/app-text-input';
import { getUserName } from '@/lib/onboarding-storage';
import {
  buildVerbSetsForUser,
  checkPalaceAnswer,
  findVerbSet,
  freeRecallConfirm,
  freeRecallIntro,
  freeRecallPrompt,
  getMemoryPalaceHistory,
  getUnlockedPalaceGroups,
  markMemoryPalaceVisited,
  quizRetryMessage,
  quizSuccessMessage,
  type MemoryPalaceVerbSet,
  type PalaceSlot,
  walkthroughRetryMessage,
  walkthroughSuccessMessage,
} from '@/lib/memory-palace';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
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
  green: '#34D399',
  amber: '#F59E0B',
  amberBg: 'rgba(245, 158, 11, 0.12)',
  greenBg: 'rgba(52, 211, 153, 0.12)',
};

const WALKTHROUGH_MS_PER_WORD = 130;
const PROMPT_MS_PER_WORD = 70;

type SessionPhase = 'walkthrough' | 'quiz' | 'free-recall' | 'complete';
type StepMode = 'prompt' | 'feedback';

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function TypingText({
  text,
  animate,
  msPerWord,
  onComplete,
  style,
}: {
  text: string;
  animate: boolean;
  msPerWord: number;
  onComplete?: () => void;
  style?: TextStyle;
}) {
  const words = useMemo(() => splitWords(text), [text]);
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : words.length);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    if (!words.length) {
      setVisibleCount(0);
      onComplete?.();
      return;
    }

    if (!animate) {
      setVisibleCount(words.length);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    setVisibleCount(0);
    let index = 0;
    const id = setInterval(() => {
      index += 1;
      if (index >= words.length) {
        setVisibleCount(words.length);
        clearInterval(id);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      } else {
        setVisibleCount(index);
      }
    }, msPerWord);

    return () => clearInterval(id);
  }, [animate, msPerWord, onComplete, words]);

  const display = words.slice(0, visibleCount).join(' ');
  const stillTyping = animate && visibleCount < words.length;

  return (
    <Text style={style}>
      {display}
      {stillTyping ? <Text style={styles.typingCursor}> ▍</Text> : null}
    </Text>
  );
}

export default function MemoryPalaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { set: setParam } = useLocalSearchParams<{ set?: string }>();
  const verbSetId = typeof setParam === 'string' ? setParam : null;

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('friend');
  const [groups, setGroups] = useState<ReturnType<typeof buildVerbSetsForUser>>([]);
  const [visited, setVisited] = useState<string[]>([]);

  const [verbSet, setVerbSet] = useState<MemoryPalaceVerbSet | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('walkthrough');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepMode, setStepMode] = useState<StepMode>('prompt');
  const [feedback, setFeedback] = useState('');
  const [answer, setAnswer] = useState('');
  const [javiLine, setJaviLine] = useState('');
  const [promptReady, setPromptReady] = useState(false);
  const [promptKey, setPromptKey] = useState(0);

  const leavePalace = useCallback(() => {
    if (verbSetId) {
      router.replace('/memory-palace' as Href);
    } else {
      router.back();
    }
  }, [router, verbSetId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const name = (await getUserName()) ?? 'friend';
      setUserName(name);
      const { groups: unlocked } = await getUnlockedPalaceGroups(name);
      setGroups(unlocked);
      setVisited(await getMemoryPalaceHistory());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!verbSetId || loading) return;
    const all = buildVerbSetsForUser(userName);
    const found = findVerbSet(all, verbSetId);
    setVerbSet(found);
    setPhase('walkthrough');
    setStepIndex(0);
    setStepMode('prompt');
    setAnswer('');
    setFeedback('');
    setPromptReady(false);
    setPromptKey((k) => k + 1);
  }, [verbSetId, loading, userName]);

  const currentSlot: PalaceSlot | null = verbSet?.slots[stepIndex] ?? null;

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case 'walkthrough':
        return 'Walkthrough';
      case 'quiz':
        return 'Recall by item';
      case 'free-recall':
        return 'Walk it yourself';
      case 'complete':
        return 'Palace visit complete';
    }
  }, [phase]);

  const msPerWord = phase === 'walkthrough' ? WALKTHROUGH_MS_PER_WORD : PROMPT_MS_PER_WORD;

  useEffect(() => {
    if (!verbSet || stepMode !== 'prompt') return;

    let line = '';
    if (phase === 'complete') {
      line = `Beautiful work, ${userName}. This palace is yours now. Come back whenever a verb won't stay.`;
    } else if (!currentSlot) {
      return;
    } else if (phase === 'walkthrough') {
      line = currentSlot.walkthroughScene;
    } else if (phase === 'quiz') {
      line = currentSlot.quizPrompt;
    } else if (phase === 'free-recall') {
      line = stepIndex === 0 ? freeRecallIntro(userName) : freeRecallPrompt(currentSlot, stepIndex);
    }

    setJaviLine(line);
    setPromptReady(false);
    setPromptKey((k) => k + 1);
  }, [verbSet, currentSlot, phase, stepIndex, stepMode, userName]);

  const handlePromptComplete = useCallback(() => {
    setPromptReady(true);
  }, []);

  const advanceStep = () => {
    setAnswer('');
    setFeedback('');
    setStepMode('prompt');
    setPromptReady(false);

    if (!verbSet) return;
    if (stepIndex < verbSet.slots.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    setStepIndex(0);
    if (phase === 'walkthrough') {
      setPhase('quiz');
      return;
    }
    if (phase === 'quiz') {
      setPhase('free-recall');
      return;
    }
    if (phase === 'free-recall') {
      void markMemoryPalaceVisited(verbSet.id).then(() => {
        setVisited((prev) => (prev.includes(verbSet.id) ? prev : [...prev, verbSet.id]));
      });
      setPhase('complete');
    }
  };

  const submitAnswer = () => {
    if (!currentSlot || stepMode === 'feedback' || !promptReady) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    const correct = checkPalaceAnswer(currentSlot, trimmed);
    if (phase === 'walkthrough') {
      setFeedback(correct ? walkthroughSuccessMessage(currentSlot) : walkthroughRetryMessage(currentSlot));
    } else if (phase === 'quiz') {
      setFeedback(correct ? quizSuccessMessage() : quizRetryMessage(currentSlot));
    } else {
      setFeedback(correct ? freeRecallConfirm(currentSlot) : walkthroughRetryMessage(currentSlot));
    }
    setStepMode('feedback');

    if (correct) {
      setTimeout(() => advanceStep(), phase === 'walkthrough' ? 1800 : 1400);
    }
  };

  const startVerbSet = (id: string) => {
    router.push(`/memory-palace?set=${encodeURIComponent(id)}` as Href);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!verbSetId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>←</Text>
            </Pressable>
            <Pressable onPress={leavePalace} style={styles.leaveBtn}>
              <Text style={styles.leaveBtnText}>Leave palace 🚪</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Memory Palace 🏛️</Text>
          <Text style={styles.subtitle}>Walk through your kitchen and meet your verbs.</Text>
          <Text style={styles.explainer}>
            Each item in your kitchen holds a conjugation. Visit each one. Let the scene stick. Come back
            whenever a verb won&apos;t stay in your head. Read quietly — type your answers. No rush.
          </Text>

          {groups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Reach Week 3 in your grammar curriculum to unlock your first palace scenes.
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.id} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{group.weekLabel}</Text>
                {group.verbSets.map((vs) => {
                  const done = visited.includes(vs.id);
                  return (
                    <Pressable
                      key={vs.id}
                      onPress={() => startVerbSet(vs.id)}
                      style={({ pressed }) => [styles.verbRow, pressed && styles.verbRowPressed]}>
                      <View style={styles.verbRowText}>
                        <Text style={styles.verbLabel}>
                          {done ? '✅ ' : ''}
                          {vs.verbLabel} ({vs.previewForms})
                        </Text>
                        <Text style={styles.verbMeaning}>{vs.englishMeaning}</Text>
                      </View>
                      <Text style={styles.chevron}>→</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!verbSet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>This verb set isn&apos;t available yet.</Text>
          <Pressable onPress={leavePalace} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showInput =
    phase !== 'complete' && currentSlot && stepMode === 'prompt' && promptReady;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={[styles.sessionWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.headerRow}>
          <Text style={styles.sessionMeta}>
            {verbSet.verbLabel} · {phaseLabel} · {phase === 'complete' ? '—' : `${stepIndex + 1}/6`}
          </Text>
          <Pressable onPress={leavePalace} style={styles.leaveBtn}>
            <Text style={styles.leaveBtnText}>Leave palace 🚪</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sessionScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.javiCard}>
            <Text style={styles.javiLabel}>Javi · calm guide</Text>
            <TypingText
              key={promptKey}
              text={javiLine}
              animate
              msPerWord={msPerWord}
              onComplete={handlePromptComplete}
              style={styles.javiText}
            />
            {phase !== 'complete' && !promptReady ? (
              <Text style={styles.javiHint}>Read slowly. Let the image form.</Text>
            ) : phase !== 'complete' ? (
              <Text style={styles.javiHint}>Take your time. Type the conjugation when you&apos;re ready.</Text>
            ) : null}
          </View>

          {!promptReady && phase !== 'complete' && stepMode === 'prompt' ? (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingText}>Reading the scene…</Text>
            </View>
          ) : null}

          {showInput ? (
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>
                {phase === 'free-recall'
                  ? `${currentSlot.itemEmoji} ${currentSlot.itemName}`
                  : 'Your answer'}
              </Text>
              <AppTextInput
                style={styles.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type the conjugation…"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submitAnswer}
              />
              <Pressable
                onPress={submitAnswer}
                disabled={!answer.trim()}
                style={[styles.primaryBtn, !answer.trim() && styles.primaryBtnDisabled]}>
                <Text style={styles.primaryBtnText}>Check</Text>
              </Pressable>
            </View>
          ) : null}

          {stepMode === 'feedback' && feedback ? (
            <View
              style={[
                styles.feedbackCard,
                feedback.startsWith('✅') ? styles.feedbackGood : styles.feedbackWarm,
              ]}>
              <Text style={styles.feedbackText}>{feedback}</Text>
              {!feedback.startsWith('✅') ? (
                <Pressable
                  onPress={() => {
                    setStepMode('prompt');
                    setPromptReady(false);
                    setPromptKey((k) => k + 1);
                  }}
                  style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {phase === 'complete' && promptReady ? (
            <Pressable onPress={leavePalace} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Return to palace hall</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  back: { fontSize: 24, fontWeight: '600', color: palette.accent },
  leaveBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  leaveBtnText: { fontSize: 13, fontWeight: '700', color: palette.muted },
  title: { fontSize: 26, fontWeight: '900', color: palette.text },
  subtitle: { fontSize: 16, fontWeight: '700', color: palette.muted, lineHeight: 22 },
  explainer: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 21 },
  groupBlock: { gap: 8, marginTop: 8 },
  groupTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  verbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 10,
  },
  verbRowPressed: { opacity: 0.9 },
  verbRowText: { flex: 1, gap: 4 },
  verbLabel: { fontSize: 15, fontWeight: '800', color: palette.text },
  verbMeaning: { fontSize: 13, fontWeight: '600', color: palette.muted },
  chevron: { fontSize: 18, fontWeight: '800', color: palette.accent },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 21, textAlign: 'center' },
  sessionWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  sessionScroll: { gap: 16, paddingBottom: 24 },
  sessionMeta: { flex: 1, fontSize: 12, fontWeight: '800', color: palette.muted },
  javiCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: palette.accent,
    gap: 10,
  },
  javiLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  javiText: { fontSize: 16, fontWeight: '600', color: palette.text, lineHeight: 24 },
  javiHint: { fontSize: 13, fontWeight: '600', color: palette.muted, fontStyle: 'italic' },
  typingCursor: { color: palette.accent, fontWeight: '400' },
  waitingCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    alignItems: 'center',
  },
  waitingText: { fontSize: 13, fontWeight: '600', color: palette.muted, fontStyle: 'italic' },
  inputCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 12,
  },
  inputLabel: { fontSize: 13, fontWeight: '800', color: palette.muted },
  input: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#0B0F14' },
  feedbackCard: { borderRadius: 12, padding: 14, gap: 10 },
  feedbackGood: { backgroundColor: palette.greenBg, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.35)' },
  feedbackWarm: { backgroundColor: palette.amberBg, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)' },
  feedbackText: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 22 },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  retryBtnText: { fontSize: 14, fontWeight: '800', color: palette.accent },
});
