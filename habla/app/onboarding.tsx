import { TextMessageBubble } from '@/components/text-message-bubble';
import { PushToTalkButton, type VoiceButtonState } from '@/components/push-to-talk-button';
import {
  askJaviAssessmentFollowUp,
  finalizePlacementAssessment,
  generateAssessmentOpening,
  type JaviMessage,
  type PlacementAssessmentResult,
} from '@/lib/claude';
import { parseJaviResponse } from '@/lib/javi-response';
import { speakJavi, stopJaviSpeech } from '@/lib/javi-speech';
import { ensureMicPermission } from '@/lib/mic-permission';
import {
  buildSkippedAssessmentProfile,
  completeOnboarding,
  DIALECT_OPTIONS,
  dialectLabel,
  getOnboardingProfile,
  shouldShowOnboarding,
  SELF_ASSESSMENT_OPTIONS,
  type ConfirmedLevel,
  type DialectPreference,
  type OnboardingProfile,
  type SelfAssessedLevel,
} from '@/lib/onboarding-storage';
import { formatLocalDate } from '@/lib/streak';
import {
  MIN_RECORDING_MS,
  startVoiceRecording,
  stopVoiceRecording,
} from '@/lib/voice-recording';
import { transcribeSpanishAudio } from '@/lib/whisper';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  accentMuted: 'rgba(255, 122, 89, 0.18)',
  green: '#34D399',
  amber: '#FBBF24',
  track: '#1A2029',
};

type OnboardingStep =
  | 'welcome'
  | 'name'
  | 'dialect'
  | 'self-assessment'
  | 'meet-javi'
  | 'assessment'
  | 'results';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

type InputMode = 'voice' | 'text';

const ASSESSMENT_QUESTIONS = 4;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toJaviMessages(messages: ChatMessage[]): JaviMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.role === 'assistant' ? `${m.spanish}\nTranslate: ${m.translation ?? ''}` : m.spanish,
  }));
}

function assessmentProfileFromResult(
  userName: string,
  dialectPreference: DialectPreference,
  selfAssessedLevel: SelfAssessedLevel,
  result: PlacementAssessmentResult,
): OnboardingProfile {
  return {
    userName,
    dialectPreference,
    selfAssessedLevel,
    confirmedLevel: result.confirmedLevel as ConfirmedLevel,
    assessmentDate: formatLocalDate(),
    keyStrengths: result.keyStrengths,
    keyWeaknesses: result.keyWeaknesses,
    grammarCurriculumStartWeek: result.grammarStartingWeek,
    assessmentSkipped: false,
  };
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ retake?: string }>();
  const isRetake = params.retake === '1';

  const [step, setStep] = useState<OnboardingStep>(isRetake ? 'meet-javi' : 'welcome');
  const [userName, setUserName] = useState('');
  const [dialectPreference, setDialectPreference] = useState<DialectPreference | null>(null);
  const [selfAssessedLevel, setSelfAssessedLevel] = useState<SelfAssessedLevel | null>(null);
  const [selectedSelfLevel, setSelectedSelfLevel] = useState<SelfAssessedLevel | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userTurns, setUserTurns] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [textInput, setTextInput] = useState('');
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentStarting, setAssessmentStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(Platform.OS === 'web');
  const [result, setResult] = useState<PlacementAssessmentResult | null>(null);
  const [skippedResult, setSkippedResult] = useState<OnboardingProfile | null>(null);
  const [completing, setCompleting] = useState(false);

  const nameInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  const dialectLabelText = dialectPreference ? dialectLabel(dialectPreference) : '';
  const selfLevelLabel = selfAssessedLevel ?? '';

  useEffect(() => {
    if (isRetake) return;
    void shouldShowOnboarding().then((show) => {
      if (!show) {
        router.replace('/(tabs)' as Href);
      }
    });
  }, [isRetake, router]);

  useEffect(() => {
    if (step === 'welcome') {
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start();
    }
  }, [step, welcomeOpacity]);

  useEffect(() => {
    if (step !== 'name') return;
    const timer = setTimeout(() => nameInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (!isRetake) return;
    void getOnboardingProfile().then((profile) => {
      if (!profile) return;
      setUserName(profile.userName);
      setDialectPreference(profile.dialectPreference);
      setSelfAssessedLevel(profile.selfAssessedLevel);
      setSelectedSelfLevel(profile.selfAssessedLevel);
    });
  }, [isRetake]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  const speakJaviMessage = async (spanish: string) => {
    if (Platform.OS === 'web') return;
    setVoiceState('javi-speaking');
    try {
      await speakJavi(spanish);
    } finally {
      setVoiceState('idle');
    }
  };

  const appendAssistantMessage = async (raw: string) => {
    const parsed = parseJaviResponse(raw);
    const msg: ChatMessage = {
      id: newId(),
      role: 'assistant',
      spanish: parsed.spanish,
      translation: parsed.translation,
    };
    setMessages((prev) => [...prev, msg]);
    if (Platform.OS !== 'web') {
      await speakJaviMessage(parsed.spanish);
    }
    return msg;
  };

  const startAssessment = async () => {
    if (!userName.trim() || !dialectPreference || !selfAssessedLevel) return;
    setAssessmentStarting(true);
    setVoiceError(null);
    setMessages([]);
    setUserTurns(0);
    setStep('assessment');

    try {
      const opening = await generateAssessmentOpening(
        userName.trim(),
        selfAssessedLevel,
        dialectLabelText,
      );
      await appendAssistantMessage(opening);
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
      setStep('meet-javi');
    } finally {
      setAssessmentStarting(false);
    }
  };

  const finishAssessment = async (conversation: ChatMessage[]) => {
    if (!userName.trim() || !dialectPreference || !selfAssessedLevel) return;
    setFinalizing(true);
    try {
      const placement = await finalizePlacementAssessment(
        userName.trim(),
        selfAssessedLevel,
        dialectLabelText,
        toJaviMessages(conversation),
      );
      setResult(placement);
      setStep('results');
    } catch {
      Alert.alert('Could not finish assessment', 'Please try again.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleUserResponse = async (userText: string) => {
    if (!userName.trim() || !dialectPreference || !selfAssessedLevel || assessmentLoading) return;
    const trimmed = userText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: newId(), role: 'user', spanish: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setTextInput('');
    const nextTurn = userTurns + 1;
    setUserTurns(nextTurn);

    if (nextTurn >= ASSESSMENT_QUESTIONS) {
      await finishAssessment(updated);
      return;
    }

    setAssessmentLoading(true);
    try {
      const questionNumber = (nextTurn + 1) as 2 | 3 | 4;
      const reply = await askJaviAssessmentFollowUp(
        userName.trim(),
        selfAssessedLevel,
        dialectLabelText,
        questionNumber,
        toJaviMessages(updated),
      );
      await appendAssistantMessage(reply);
    } catch {
      Alert.alert('Connection issue', 'Check your internet and try again.');
      setUserTurns(nextTurn - 1);
      setMessages(messages);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const handlePressIn = async () => {
    if (Platform.OS === 'web') return;
    setVoiceError(null);
    const permission = await ensureMicPermission();
    setMicGranted(permission.granted);
    if (!permission.granted) {
      setVoiceError('Microphone permission is required for voice responses.');
      return;
    }
    stopJaviSpeech();
    try {
      await startVoiceRecording();
      setVoiceState('recording');
    } catch {
      setVoiceError('Could not start recording.');
    }
  };

  const handlePressOut = async () => {
    if (Platform.OS === 'web' || voiceState !== 'recording') return;
    setVoiceState('processing');

    try {
      const { uri, durationMs } = await stopVoiceRecording();
      if (!uri || durationMs < MIN_RECORDING_MS) {
        setVoiceError('Hold a little longer to record your answer.');
        setVoiceState('idle');
        return;
      }
      const result = await transcribeSpanishAudio(uri);
      if (!result.ok) {
        setVoiceError("Javi didn't catch that — try again 🎤");
        setVoiceState('idle');
        return;
      }
      if (!result.text.trim()) {
        setVoiceError('No speech detected — try again.');
        setVoiceState('idle');
        return;
      }
      setVoiceState('idle');
      await handleUserResponse(result.text);
    } catch {
      setVoiceError('Could not process your recording.');
      setVoiceState('idle');
    }
  };

  const handleSkipAssessment = async () => {
    if (!userName.trim() || !dialectPreference || !selfAssessedLevel) return;
    const profile = await buildSkippedAssessmentProfile(
      userName.trim(),
      dialectPreference,
      selfAssessedLevel,
    );
    setSkippedResult(profile);
    setStep('results');
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      let profile: OnboardingProfile;
      if (skippedResult) {
        profile = skippedResult;
      } else if (result && dialectPreference && selfAssessedLevel) {
        profile = assessmentProfileFromResult(
          userName.trim(),
          dialectPreference,
          selfAssessedLevel,
          result,
        );
      } else {
        return;
      }
      await completeOnboarding(profile, { retake: isRetake, skipAssessment: profile.assessmentSkipped });
      router.replace('/(tabs)' as Href);
    } finally {
      setCompleting(false);
    }
  };

  const assessmentProgress = useMemo(() => {
    if (step !== 'assessment') return 0;
    return Math.min(userTurns / ASSESSMENT_QUESTIONS, 1);
  }, [step, userTurns]);

  const displayResult = skippedResult
    ? {
        confirmedLevel: skippedResult.confirmedLevel,
        adjustedFromSelfAssessment: false,
        adjustmentDirection: 'same' as const,
        keyStrengths: skippedResult.keyStrengths,
        keyWeaknesses: skippedResult.keyWeaknesses,
        grammarStartingWeek: skippedResult.grammarCurriculumStartWeek,
        personalNote: `¡Hola ${skippedResult.userName}! Estoy listo para empezar contigo cuando quieras.`,
      }
    : result;

  const micDisabled =
    assessmentLoading ||
    finalizing ||
    assessmentStarting ||
    voiceState === 'processing' ||
    voiceState === 'javi-speaking' ||
    userTurns >= ASSESSMENT_QUESTIONS;

  const renderProgressBar = () => (
    <View style={styles.assessmentTrack}>
      <View style={[styles.assessmentFill, { width: `${assessmentProgress * 100}%` }]} />
    </View>
  );

  const renderWelcome = () => (
    <Animated.View style={[styles.centered, { opacity: welcomeOpacity }]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="contain" />
      <Text style={styles.brandTitle}>Habla</Text>
      <Text style={styles.tagline}>Your personal Spanish tutor. Powered by AI.</Text>
      <Text style={styles.subtext}>Let&apos;s get you set up in 4 minutes.</Text>
      <Pressable
        onPress={() => setStep('name')}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
        <Text style={styles.primaryButtonText}>Let&apos;s go →</Text>
      </Pressable>
    </Animated.View>
  );

  const renderName = () => (
    <View style={styles.formBlock}>
      <Text style={styles.screenTitle}>First, what&apos;s your name?</Text>
      <Text style={styles.screenHint}>Javi will use this name throughout all lessons.</Text>
      <TextInput
        ref={nameInputRef}
        style={styles.nameInput}
        value={userName}
        onChangeText={setUserName}
        placeholder="First name"
        placeholderTextColor={palette.muted}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (userName.trim()) setStep('dialect');
        }}
      />
      <Pressable
        onPress={() => userName.trim() && setStep('dialect')}
        disabled={!userName.trim()}
        style={({ pressed }) => [
          styles.primaryButton,
          !userName.trim() && styles.primaryButtonDisabled,
          pressed && userName.trim() && styles.primaryButtonPressed,
        ]}>
        <Text style={styles.primaryButtonText}>Continue →</Text>
      </Pressable>
    </View>
  );

  const renderDialect = () => (
    <ScrollView contentContainerStyle={styles.scrollForm} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Which Spanish do you want to focus on?</Text>
      {DIALECT_OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setDialectPreference(opt.id);
            setStep('self-assessment');
          }}
          style={({ pressed }) => [
            opt.compact ? styles.optionCardCompact : styles.optionCard,
            pressed && styles.optionCardPressed,
          ]}>
          <Text style={styles.optionTitle}>
            {opt.emoji ? `${opt.emoji} ` : ''}
            {opt.title}
          </Text>
          <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderSelfAssessment = () => (
    <ScrollView contentContainerStyle={styles.scrollForm} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>How would you describe your Spanish?</Text>
      {SELF_ASSESSMENT_OPTIONS.map((opt) => {
        const selected = selectedSelfLevel === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => setSelectedSelfLevel(opt.id)}
            style={({ pressed }) => [
              styles.optionCard,
              selected && styles.optionCardSelected,
              pressed && styles.optionCardPressed,
            ]}>
            <Text style={styles.optionTitle}>
              {opt.emoji} {opt.title}
            </Text>
            <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
          </Pressable>
        );
      })}
      {selectedSelfLevel ? (
        <Pressable
          onPress={() => {
            setSelfAssessedLevel(selectedSelfLevel);
            setStep('meet-javi');
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
          <Text style={styles.primaryButtonText}>Continue →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  const renderMeetJavi = () => (
    <View style={styles.formBlock}>
      <Text style={styles.screenTitle}>Meet Javi — your Spanish tutor</Text>
      <View style={styles.javiAvatar}>
        <Text style={styles.javiEmoji}>👨‍🏫</Text>
      </View>
      <Text style={styles.bodyText}>
        Javi will have a short conversation with you to find your exact level. Just speak naturally —
        there are no wrong answers.
      </Text>
      <Text style={styles.bodyMuted}>This takes about 3 minutes.</Text>
      <Pressable
        onPress={() => void startAssessment()}
        disabled={assessmentStarting}
        style={({ pressed }) => [
          styles.primaryButton,
          assessmentStarting && styles.primaryButtonDisabled,
          pressed && !assessmentStarting && styles.primaryButtonPressed,
        ]}>
        {assessmentStarting ? (
          <ActivityIndicator color="#0B0F14" />
        ) : (
          <Text style={styles.primaryButtonText}>Start assessment 🎤</Text>
        )}
      </Pressable>
      {!isRetake ? (
        <Pressable onPress={() => void handleSkipAssessment()} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>Skip assessment →</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderAssessment = () => (
    <>
      {renderProgressBar()}
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
        {assessmentLoading || finalizing ? (
          <ActivityIndicator color={palette.muted} style={{ marginTop: 12 }} />
        ) : null}
      </ScrollView>

      <View style={[styles.assessmentDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setInputMode('voice')}
            style={[styles.modeChip, inputMode === 'voice' && styles.modeChipActive]}>
            <Text style={[styles.modeChipText, inputMode === 'voice' && styles.modeChipTextActive]}>
              🎤 Voice
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setInputMode('text')}
            style={[styles.modeChip, inputMode === 'text' && styles.modeChipActive]}>
            <Text style={[styles.modeChipText, inputMode === 'text' && styles.modeChipTextActive]}>
              ⌨️ Text
            </Text>
          </Pressable>
        </View>

        {inputMode === 'text' ? (
          <View style={styles.composeRow}>
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type your answer in Spanish..."
              placeholderTextColor={palette.muted}
              multiline
              editable={!assessmentLoading && !finalizing}
            />
            <Pressable
              onPress={() => void handleUserResponse(textInput)}
              disabled={assessmentLoading || finalizing || !textInput.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                (!textInput.trim() || assessmentLoading || finalizing) && styles.sendButtonDisabled,
                pressed && textInput.trim() && styles.sendButtonPressed,
              ]}>
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.voiceBlock}>
            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
            <PushToTalkButton
              state={voiceState}
              disabled={micDisabled || Platform.OS === 'web'}
              onPressIn={() => void handlePressIn()}
              onPressOut={() => void handlePressOut()}
            />
            <Text style={styles.voiceHint}>
              {Platform.OS === 'web'
                ? 'Switch to text mode on web'
                : voiceState === 'recording'
                  ? 'Release when finished'
                  : `Question ${Math.min(userTurns + 1, ASSESSMENT_QUESTIONS)} of ${ASSESSMENT_QUESTIONS}`}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  const renderResults = () => {
    if (!displayResult) return null;
    const showAdjustment =
      !skippedResult &&
      result?.adjustedFromSelfAssessment &&
      result.confirmedLevel !== selfAssessedLevel;

    return (
      <ScrollView contentContainerStyle={styles.scrollForm} showsVerticalScrollIndicator={false}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>{displayResult.confirmedLevel}</Text>
        </View>

        {showAdjustment ? (
          <Text style={styles.adjustmentText}>
            You placed yourself at {selfAssessedLevel}. Based on our conversation Javi thinks
            you&apos;re at {displayResult.confirmedLevel}.
          </Text>
        ) : null}

        {skippedResult ? (
          <Text style={styles.adjustmentText}>
            Level self-assessed at {displayResult.confirmedLevel}. You can retake the assessment
            anytime from Settings.
          </Text>
        ) : null}

        {displayResult.keyStrengths.map((s) => (
          <Text key={s} style={styles.strengthLine}>
            ✅ {s}
          </Text>
        ))}
        {displayResult.keyWeaknesses.map((w) => (
          <Text key={w} style={styles.weaknessLine}>
            ⚠️ {w}
          </Text>
        ))}

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>&ldquo;{displayResult.personalNote}&rdquo;</Text>
        </View>

        <Text style={styles.curriculumLine}>
          Your grammar curriculum starts at Week {displayResult.grammarStartingWeek}
        </Text>

        <Pressable
          onPress={() => void handleComplete()}
          disabled={completing}
          style={({ pressed }) => [
            styles.primaryButton,
            completing && styles.primaryButtonDisabled,
            pressed && !completing && styles.primaryButtonPressed,
          ]}>
          {completing ? (
            <ActivityIndicator color="#0B0F14" />
          ) : (
            <Text style={styles.primaryButtonText}>Start learning with Javi →</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        {step === 'welcome' ? renderWelcome() : null}
        {step === 'name' ? renderName() : null}
        {step === 'dialect' ? renderDialect() : null}
        {step === 'self-assessment' ? renderSelfAssessment() : null}
        {step === 'meet-javi' ? renderMeetJavi() : null}
        {step === 'assessment' ? renderAssessment() : null}
        {step === 'results' ? renderResults() : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  logo: { width: 88, height: 88, borderRadius: 20, marginBottom: 8 },
  brandTitle: { fontSize: 42, fontWeight: '900', color: palette.text, letterSpacing: -0.5 },
  tagline: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtext: { fontSize: 15, color: palette.muted, textAlign: 'center', marginBottom: 20 },
  formBlock: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  scrollForm: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 14 },
  screenTitle: { fontSize: 26, fontWeight: '900', color: palette.text, lineHeight: 32 },
  screenHint: { fontSize: 15, color: palette.muted, lineHeight: 21 },
  nameInput: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: palette.text,
    marginTop: 8,
  },
  optionCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 18,
    gap: 6,
  },
  optionCardCompact: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 4,
    marginTop: 4,
  },
  optionCardSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
  optionCardPressed: { opacity: 0.9 },
  optionTitle: { fontSize: 17, fontWeight: '800', color: palette.text, lineHeight: 22 },
  optionSubtitle: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  javiAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  javiEmoji: { fontSize: 40 },
  bodyText: { fontSize: 16, color: palette.text, lineHeight: 24 },
  bodyMuted: { fontSize: 15, color: palette.muted },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonPressed: { backgroundColor: palette.accentPressed },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#0B0F14' },
  skipLink: { alignSelf: 'center', paddingVertical: 12 },
  skipLinkText: { fontSize: 14, fontWeight: '600', color: palette.muted },
  assessmentTrack: {
    height: 3,
    backgroundColor: palette.track,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  assessmentFill: { height: 3, backgroundColor: palette.accent, borderRadius: 2 },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 },
  assessmentDock: {
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
  modeChipText: { fontSize: 13, fontWeight: '700', color: palette.muted },
  modeChipTextActive: { color: palette.accent },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
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
    minHeight: 44,
    justifyContent: 'center',
  },
  sendButtonPressed: { backgroundColor: palette.accentPressed },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { fontSize: 15, fontWeight: '800', color: '#0B0F14' },
  voiceBlock: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  voiceHint: { fontSize: 13, fontWeight: '600', color: palette.muted },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center' },
  levelBadge: {
    alignSelf: 'center',
    backgroundColor: palette.accentMuted,
    borderWidth: 2,
    borderColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    marginBottom: 8,
  },
  levelBadgeText: { fontSize: 28, fontWeight: '900', color: palette.accent, textAlign: 'center' },
  adjustmentText: { fontSize: 15, color: palette.muted, lineHeight: 22, textAlign: 'center' },
  strengthLine: { fontSize: 15, color: palette.green, lineHeight: 22 },
  weaknessLine: { fontSize: 15, color: palette.amber, lineHeight: 22 },
  quoteCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginTop: 4,
  },
  quoteText: { fontSize: 16, fontStyle: 'italic', color: palette.text, lineHeight: 24 },
  curriculumLine: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    marginTop: 4,
  },
});
