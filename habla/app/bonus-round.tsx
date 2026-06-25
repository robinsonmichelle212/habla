import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import { GemEarnedToast } from '@/components/gem-earned-toast';
import { JaviSpanishMessage } from '@/components/javi-spanish-message';
import {
  askCultureJavi,
  askFilmJavi,
  askImmersionJavi,
  askMusicJavi,
  askRoleplayJavi,
  askSlangJavi,
  compareShadowing,
  evaluateImmersion,
  evaluateRoleplay,
  generateCultureRound,
  generateFilmRound,
  generateImmersionOpening,
  generateMusicRound,
  generateQuizRound,
  generateRoleplayRound,
  generateShadowingRound,
  generateSlangRound,
  immersionRoundGems,
  quizRoundGems,
  type QuizQuestion,
  type RoleplayRoundContent,
  type ShadowingSentence,
  type SlangRoundContent,
} from '@/lib/bonus-round-generators';
import { buildRoundCalibration, type RoundCalibration } from '@/lib/bonus-round-calibration';
import { addCulturalNote } from '@/lib/cultural-notes';
import {
  eliteBadgeId,
  eliteBadgeLabel,
  getRoundDef,
  isRoundLevelPlayable,
  parseRoundLevel,
  recordLevelCompleted,
  recordRoundPlayed,
  type BonusRoundId,
} from '@/lib/gem-shop';
import { addGems } from '@/lib/gems';
import { parseJaviResponse } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { ensureMicPermission } from '@/lib/mic-permission';
import { awardBadge } from '@/lib/profile-badges';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
import { MIN_RECORDING_MS, startVoiceRecording, stopVoiceRecording } from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  green: '#34D399',
  red: '#F87171',
};

const QUIZ_TIMER_SEC_DEFAULT = 15;

type Stage = 'gate' | 'loading' | 'play' | 'result';

function safeSpanish(text: string): string {
  return text.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();
}

function parseRoundId(value: string | undefined): BonusRoundId | null {
  const ids: BonusRoundId[] = ['quiz', 'slang', 'roleplay', 'shadowing', 'culture', 'immersion', 'music', 'film'];
  return ids.includes(value as BonusRoundId) ? (value as BonusRoundId) : null;
}

export default function BonusRoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { round: roundParam, level: levelParam } = useLocalSearchParams<{
    round?: string;
    level?: string;
  }>();
  const roundId = parseRoundId(typeof roundParam === 'string' ? roundParam : undefined);
  const roundLevel = parseRoundLevel(typeof levelParam === 'string' ? levelParam : undefined) ?? 1;

  const [stage, setStage] = useState<Stage>('gate');
  const [calibration, setCalibration] = useState<RoundCalibration | null>(null);
  const [maxChatTurns, setMaxChatTurns] = useState(4);
  const [quizTimerSec, setQuizTimerSec] = useState(QUIZ_TIMER_SEC_DEFAULT);
  const [gemsEarned, setGemsEarned] = useState(0);
  const [showGemToast, setShowGemToast] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultDetail, setResultDetail] = useState('');

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTimer, setQuizTimer] = useState(QUIZ_TIMER_SEC_DEFAULT);
  const [quizLocked, setQuizLocked] = useState(false);

  // Generic chat
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatTurns, setChatTurns] = useState(0);

  // Slang
  const [slangContent, setSlangContent] = useState<SlangRoundContent | null>(null);
  const [slangPhase, setSlangPhase] = useState<'intro' | 'drill' | 'chat'>('intro');

  // Roleplay / voice
  const [roleplayContent, setRoleplayContent] = useState<RoleplayRoundContent | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceTurns, setVoiceTurns] = useState(0);

  // Shadowing
  const [shadowSentences, setShadowSentences] = useState<ShadowingSentence[]>([]);
  const [shadowIdx, setShadowIdx] = useState(0);
  const [shadowScores, setShadowScores] = useState<number[]>([]);
  const [shadowFeedback, setShadowFeedback] = useState<string | null>(null);

  // Culture / music / film presentation
  const [presentation, setPresentation] = useState('');
  const [roundMeta, setRoundMeta] = useState<Record<string, unknown>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestAssistantChatIndex = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i]?.role === 'assistant') return i;
    }
    return -1;
  }, [chatMessages]);

  const finishRound = useCallback(
    async (title: string, detail: string, gems: number) => {
      if (roundId) {
        await recordRoundPlayed(roundId, roundLevel);
        await recordLevelCompleted(roundId, roundLevel);
        if (roundLevel === 5) {
          await awardBadge(eliteBadgeId(roundId), eliteBadgeLabel(roundId), '🏆');
        }
      }
      if (gems > 0) {
        await addGems(gems);
        setGemsEarned(gems);
        setShowGemToast(true);
      }
      setResultTitle(title);
      setResultDetail(detail);
      setStage('result');
    },
    [roundId, roundLevel],
  );

  const submitQuizAnswer = useCallback(
    async (selectedIndex: number) => {
      if (quizLocked) return;
      setQuizLocked(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const q = quizQuestions[quizIdx];
      if (!q) return;
      const correct = selectedIndex === q.correctIndex;
      const nextScore = quizScore + (correct ? 1 : 0);
      setQuizScore(nextScore);
      setTimeout(() => {
        if (quizIdx >= quizQuestions.length - 1) {
          const total = quizQuestions.length;
          const gems = quizRoundGems(nextScore, total);
          void finishRound(
            `Quiz complete: ${nextScore}/${total}`,
            correct ? '✅ Correct!' : `Answer: ${q.options[q.correctIndex]}`,
            gems,
          );
        } else {
          setQuizIdx((i) => i + 1);
          setQuizLocked(false);
        }
      }, 800);
    },
    [quizLocked, quizQuestions, quizIdx, quizScore, finishRound],
  );

  const sendChat = useCallback(
    async (
      askFn: (msgs: { role: 'user' | 'assistant'; content: string }[]) => Promise<string>,
      onComplete?: (messages: { role: 'user' | 'assistant'; text: string }[]) => Promise<void>,
    ) => {
      if (!chatInput.trim() || chatSending) return;
      const userText = chatInput.trim();
      const next = [...chatMessages, { role: 'user' as const, text: userText }];
      setChatMessages(next);
      setChatInput('');
      setChatSending(true);
      const nextTurns = chatTurns + 1;
      setChatTurns(nextTurns);
      try {
        const reply = await askFn(next.map((m) => ({ role: m.role, content: m.text })));
        const parsed =
          roundId === 'immersion'
            ? { spanish: reply, translation: undefined }
            : parseJaviResponse(reply);
        const assistantText = parsed.spanish;
        const withReply = [...next, { role: 'assistant' as const, text: assistantText }];
        setChatMessages(withReply);
        if (nextTurns >= maxChatTurns) {
          await onComplete?.(withReply);
        }
      } finally {
        setChatSending(false);
      }
    },
    [chatInput, chatSending, chatMessages, chatTurns, roundId, maxChatTurns],
  );

  useEffect(() => {
    if (!roundId) {
      router.replace('/gem-shop');
      return;
    }
    void (async () => {
      const playable = await isRoundLevelPlayable(roundId, roundLevel);
      if (!playable) {
        Alert.alert('Unlock first', `Purchase Level ${roundLevel} in the Gem Shop — you have 24 hours to complete it.`, [
          { text: 'OK', onPress: () => router.replace('/gem-shop') },
        ]);
        return;
      }
      setStage('loading');
      try {
        const cal = await buildRoundCalibration(roundId, roundLevel);
        setCalibration(cal);
        setMaxChatTurns(cal.chatTurns);
        setQuizTimerSec(cal.quizTimerSec);
        setQuizTimer(cal.quizTimerSec);

        switch (roundId) {
          case 'quiz': {
            const qs = await generateQuizRound(cal);
            setQuizQuestions(qs);
            setQuizIdx(0);
            setQuizScore(0);
            break;
          }
          case 'slang': {
            const c = await generateSlangRound(cal);
            setSlangContent(c);
            setSlangPhase('intro');
            break;
          }
          case 'roleplay': {
            const c = await generateRoleplayRound(cal);
            setRoleplayContent(c);
            setChatMessages([{ role: 'assistant', text: c.openingLine }]);
            break;
          }
          case 'shadowing': {
            const s = await generateShadowingRound(cal);
            setShadowSentences(s);
            setShadowIdx(0);
            setShadowScores([]);
            break;
          }
          case 'culture': {
            const c = await generateCultureRound(cal);
            setPresentation(c.presentation);
            setRoundMeta({ culture: c });
            setChatMessages([
              { role: 'assistant', text: `${c.presentation}\n\n${c.discussionPrompts[0] ?? '¿Qué opinas?'}` },
            ]);
            break;
          }
          case 'immersion': {
            const open = await generateImmersionOpening(cal);
            setChatMessages([{ role: 'assistant', text: open }]);
            break;
          }
          case 'music': {
            const m = await generateMusicRound(cal);
            setPresentation(`${m.context}\n\n${m.verses}`);
            setRoundMeta({ music: m });
            setChatMessages([
              {
                role: 'assistant',
                text: `${m.context}\n\n${m.verses}\n\n¿Qué te transmite esta canción?`,
              },
            ]);
            break;
          }
          case 'film': {
            const f = await generateFilmRound(cal);
            setPresentation(`${f.sceneDescription}\n\n${f.dialogue}`);
            setRoundMeta({ film: f });
            setChatMessages([
              {
                role: 'assistant',
                text: `${f.sceneDescription}\n\n${f.discussionQuestions[0] ?? '¿Qué opinas?'}`,
              },
            ]);
            break;
          }
        }
        setStage('play');
      } catch {
        Alert.alert('Could not load round', 'Check your connection and try again.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    })();
    return () => {
      stopJaviSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roundId, roundLevel, router]);

  // Quiz timer
  useEffect(() => {
    if (roundId !== 'quiz' || stage !== 'play' || quizLocked || !quizQuestions.length) return;
    setQuizTimer(quizTimerSec);
    timerRef.current = setInterval(() => {
      setQuizTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          void submitQuizAnswer(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roundId, stage, quizIdx, quizLocked, quizQuestions.length, quizTimerSec, submitQuizAnswer]);

  const handleShadowingNext = async (spoken: string) => {
    const sentence = shadowSentences[shadowIdx];
    const result = await compareShadowing(sentence.spanish, spoken);
    const scores = [...shadowScores, result.accuracy];
    setShadowScores(scores);
    setShadowFeedback(result.feedback);
    setTimeout(() => {
      setShadowFeedback(null);
      if (shadowIdx >= shadowSentences.length - 1) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        void finishRound(`Shadowing: ${avg}%`, 'Great rhythm practice!', avg >= 70 ? 3 : 1);
      } else {
        setShadowIdx((i) => i + 1);
      }
    }, 2000);
  };

  const def = roundId ? getRoundDef(roundId) : null;

  if (!roundId || !def) return null;

  if (stage === 'loading' || stage === 'gate') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={palette.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (stage === 'result') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {showGemToast ? <GemEarnedToast amount={gemsEarned} onDone={() => setShowGemToast(false)} /> : null}
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>{def.emoji}</Text>
          <Text style={styles.resultTitle}>{resultTitle}</Text>
          <Text style={styles.resultDetail}>{resultDetail}</Text>
          {roundLevel === 5 ? (
            <Text style={styles.eliteNote}>🏆 Elite {def.name} badge earned!</Text>
          ) : null}
          {gemsEarned > 0 ? <Text style={styles.gemsEarned}>+{gemsEarned} 💎</Text> : null}
          <Pressable onPress={() => router.replace('/gem-shop')} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back to Gem Shop</Text>
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
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Exit</Text>
          </Pressable>
          <Text style={styles.roundTitle}>
            {def.emoji} {def.name} · L{roundLevel}
          </Text>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          {roundId === 'quiz' && quizQuestions[quizIdx] ? (
            <View style={styles.quizWrap}>
              <Text style={styles.quizMeta}>
                Q{quizIdx + 1}/{quizQuestions.length} · {quizTimer}s
              </Text>
              <Text style={styles.quizPrompt}>{quizQuestions[quizIdx].prompt}</Text>
              {quizQuestions[quizIdx].options.map((opt, i) => (
                <Pressable
                  key={opt}
                  disabled={quizLocked}
                  onPress={() => void submitQuizAnswer(i)}
                  style={({ pressed }) => [styles.optionBtn, pressed && styles.optionPressed]}>
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {roundId === 'slang' && slangContent ? (
            <View style={styles.block}>
              {slangPhase === 'intro' ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {slangContent.expressions.length} slang expressions
                  </Text>
                  {slangContent.expressions.map((e) => (
                    <View key={e.spain} style={styles.slangRow}>
                      <Text style={styles.slangSpain}>🇪🇸 {e.spain}</Text>
                      <Text style={styles.slangArg}>🇦🇷 {e.argentina}</Text>
                      <Text style={styles.slangMean}>{e.meaning}</Text>
                      <Text style={styles.slangEx}>{e.example}</Text>
                    </View>
                  ))}
                  <Pressable onPress={() => setSlangPhase('drill')} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Quick drill →</Text>
                  </Pressable>
                </>
              ) : slangPhase === 'drill' ? (
                <>
                  <Text style={styles.sectionTitle}>Pick the right slang</Text>
                  <Text style={styles.body}>{slangContent.drill.situation}</Text>
                  {slangContent.drill.options.map((opt, i) => (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        const ok = i === slangContent.drill.correctIndex;
                        if (ok) {
                          setSlangPhase('chat');
                          setChatMessages([
                            {
                              role: 'assistant',
                              text: '¡Perfecto! Ahora charlemos usando estas expresiones. Cuéntame algo de tu día e intenta usar al menos dos.',
                            },
                          ]);
                          setChatTurns(0);
                        } else Alert.alert('Not quite', 'Try again!');
                      }}
                      style={styles.optionBtn}>
                      <Text style={styles.optionText}>{opt}</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  {chatMessages.map((m, i) => (
                    <View key={i} style={m.role === 'user' ? styles.userBubble : styles.javiBubble}>
                      {m.role === 'assistant' ? (
                        <JaviSpanishMessage
                          spanish={safeSpanish(m.text)}
                          source="conversation"
                          animate={i === latestAssistantChatIndex}
                          resetKey={`${i}-${m.text}`}
                          style={styles.bubbleText}
                        />
                      ) : (
                        <Text style={styles.bubbleText}>{m.text}</Text>
                      )}
                    </View>
                  ))}
                  <TextInput
                    style={styles.input}
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Chat with Javi…"
                    placeholderTextColor={palette.muted}
                  />
                  <Pressable
                    onPress={() =>
                      void sendChat(
                        (msgs) => askSlangJavi(slangContent.expressions, msgs),
                        async (messages) => {
                          await saveVocabularyWord(slangContent.slangCard.spanish, {
                            source: 'slang',
                            english: slangContent.slangCard.english,
                            exampleSpanish: slangContent.slangCard.exampleSpanish,
                          });
                          void finishRound('Slang round complete!', 'Slang card saved to vocabulary 📚', 2);
                        },
                      )
                    }
                    style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Send</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          {roundId === 'shadowing' && shadowSentences[shadowIdx] ? (
            <View style={styles.block}>
              <Text style={styles.sectionTitle}>
                Sentence {shadowIdx + 1}/{shadowSentences.length}
              </Text>
              <Text style={styles.shadowSpanish}>{shadowSentences[shadowIdx].spanish}</Text>
              <Text style={styles.shadowEnglish}>{shadowSentences[shadowIdx].english}</Text>
              <Pressable
                onPress={() => void speakJavi(shadowSentences[shadowIdx].spanish)}
                style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>🔊 Hear Javi</Text>
              </Pressable>
              {shadowFeedback ? <Text style={styles.feedback}>{shadowFeedback}</Text> : null}
              <ShadowingMic onTranscript={(t) => void handleShadowingNext(t)} />
            </View>
          ) : null}

          {(roundId === 'roleplay' ||
            roundId === 'culture' ||
            roundId === 'immersion' ||
            roundId === 'music' ||
            roundId === 'film') ? (
            <View style={styles.block}>
              {presentation ? <Text style={styles.presentation}>{presentation}</Text> : null}
              {chatMessages.map((m, i) => (
                <View key={i} style={m.role === 'user' ? styles.userBubble : styles.javiBubble}>
                  {m.role === 'assistant' ? (
                    <JaviSpanishMessage
                      spanish={safeSpanish(m.text)}
                      source="conversation"
                      animate={i === latestAssistantChatIndex}
                      resetKey={`${i}-${m.text}`}
                      style={styles.bubbleText}
                    />
                  ) : (
                    <Text style={styles.bubbleText}>{m.text}</Text>
                  )}
                </View>
              ))}
              {roundId === 'roleplay' ? (
                <RoleplayMic
                  onTranscript={async (text) => {
                    const next = [...chatMessages, { role: 'user' as const, text }];
                    setChatMessages(next);
                    const nextVoiceTurns = voiceTurns + 1;
                    setVoiceTurns(nextVoiceTurns);
                    if (!roleplayContent || !calibration) return;
                    const reply = await askRoleplayJavi(
                      roleplayContent,
                      next.map((m) => ({ role: m.role, content: m.text })),
                      calibration,
                    );
                    const withReply = [...next, { role: 'assistant' as const, text: reply }];
                    setChatMessages(withReply);
                    if (nextVoiceTurns >= maxChatTurns) {
                      const ev = await evaluateRoleplay(
                        roleplayContent.scenario,
                        withReply.map((m) => ({ role: m.role, content: m.text })),
                      );
                      void finishRound(`Score: ${ev.score}%`, ev.feedback, ev.score >= 70 ? 3 : 1);
                    }
                  }}
                />
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder={roundId === 'immersion' ? 'Escribe en español…' : 'Your response…'}
                    placeholderTextColor={palette.muted}
                    multiline
                  />
                  <Pressable
                    onPress={() => {
                      const culture = roundMeta.culture as { topic: string; culturalNote: string } | undefined;
                      const music = roundMeta.music as {
                        vocabDrill: { spanish: string; english: string }[];
                      } | undefined;
                      const film = roundMeta.film as { title: string } | undefined;
                      void sendChat(
                        async (msgs) => {
                          if (roundId === 'immersion' && calibration) return askImmersionJavi(msgs, calibration);
                          if (roundId === 'culture' && culture)
                            return askCultureJavi(culture.topic, msgs);
                          if (roundId === 'music' && roundMeta.music)
                            return askMusicJavi(roundMeta.music as Parameters<typeof askMusicJavi>[0], msgs);
                          if (roundId === 'film' && roundMeta.film)
                            return askFilmJavi(roundMeta.film as Parameters<typeof askFilmJavi>[0], msgs);
                          return askCultureJavi('cultura', msgs);
                        },
                        async (messages) => {
                          if (roundId === 'culture' && culture) {
                            await addCulturalNote(culture.culturalNote, culture.topic, 'Culture Round');
                          }
                          if (roundId === 'music' && music) {
                            for (const v of music.vocabDrill.slice(0, 5)) {
                              await saveVocabularyWord(v.spanish, {
                                source: 'music',
                                english: v.english,
                              });
                            }
                          }
                          if (roundId === 'immersion') {
                            const ev = await evaluateImmersion(
                              messages.map((m) => ({ role: m.role, content: m.text })),
                            );
                            await awardBadge('immersion', 'Inmersión', '🔇');
                            const gems = immersionRoundGems(ev.score);
                            void finishRound(`Inmersión: ${ev.score}%`, ev.feedback, gems);
                          } else {
                            void finishRound(`${def.name} complete!`, 'Great discussion 🎉', 2);
                          }
                        },
                      );
                    }}
                    style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Send</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ShadowingMic({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [state, setState] = useState<VoiceButtonState>('idle');
  return (
    <PushToTalkButton
      state={state}
      disabled={state === 'processing'}
      onPressIn={async () => {
        const p = await ensureMicPermission();
        if (!p.granted) return;
        await startVoiceRecording();
        setState('recording');
      }}
      onPressOut={async () => {
        setState('processing');
        const { uri, durationMs } = await stopVoiceRecording();
        if (!uri || durationMs < MIN_RECORDING_MS) {
          setState('idle');
          return;
        }
        const result = await transcribeSpanishAudio(uri);
        setState('idle');
        if (result.ok) onTranscript(result.text);
      }}
    />
  );
}

function RoleplayMic({ onTranscript }: { onTranscript: (text: string) => void }) {
  return <ShadowingMic onTranscript={onTranscript} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  back: { fontSize: 16, fontWeight: '700', color: palette.accent },
  roundTitle: { fontSize: 16, fontWeight: '900', color: palette.text, flex: 1 },
  scroll: { padding: 20 },
  block: { gap: 12 },
  quizWrap: { gap: 12 },
  quizMeta: { fontSize: 13, fontWeight: '800', color: palette.muted },
  quizPrompt: { fontSize: 20, fontWeight: '800', color: palette.text, lineHeight: 28 },
  optionBtn: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  optionPressed: { borderColor: palette.accent },
  optionText: { fontSize: 16, fontWeight: '700', color: palette.text },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: palette.muted, textTransform: 'uppercase' },
  body: { fontSize: 16, fontWeight: '600', color: palette.text, lineHeight: 24 },
  slangRow: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 8,
  },
  slangSpain: { fontSize: 16, fontWeight: '900', color: palette.text },
  slangArg: { fontSize: 14, fontWeight: '700', color: palette.muted },
  slangMean: { fontSize: 14, fontWeight: '600', color: palette.text },
  slangEx: { fontSize: 13, fontWeight: '600', color: palette.muted, fontStyle: 'italic' },
  presentation: { fontSize: 16, fontWeight: '600', color: palette.text, lineHeight: 24, marginBottom: 12 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 122, 89, 0.2)',
    borderRadius: 14,
    padding: 12,
    maxWidth: '85%',
  },
  javiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 12,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  bubbleText: { fontSize: 15, fontWeight: '600', color: palette.text, lineHeight: 22 },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    fontSize: 16,
    color: palette.text,
    minHeight: 48,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '800', color: palette.text },
  shadowSpanish: { fontSize: 22, fontWeight: '900', color: palette.text, textAlign: 'center' },
  shadowEnglish: { fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  feedback: { fontSize: 14, fontWeight: '700', color: palette.accent, textAlign: 'center' },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  resultEmoji: { fontSize: 56 },
  resultTitle: { fontSize: 26, fontWeight: '900', color: palette.text, textAlign: 'center' },
  resultDetail: { fontSize: 16, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  gemsEarned: { fontSize: 22, fontWeight: '900', color: palette.green },
  eliteNote: { fontSize: 16, fontWeight: '800', color: palette.accent, textAlign: 'center' },
});
