import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
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
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentMuted: 'rgba(255, 122, 89, 0.18)',
};

type LessonKind = 'grammar' | 'vocabulary' | 'your-day';

const LESSON_OPTIONS: { id: LessonKind; label: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'your-day', label: 'Your day' },
];

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lessonKind, setLessonKind] = useState<LessonKind>('grammar');
  const [reply, setReply] = useState('');

  const goToSummary = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/summary');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
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
          style={styles.chatScroll}
          contentContainerStyle={styles.chatScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.aiBubble}>
            <Text style={styles.aiBubbleText}>¡Hola! ¿Cómo estás?</Text>
          </View>
        </ScrollView>

        <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={goToSummary}
            style={({ pressed }) => [
              styles.summaryButton,
              pressed && styles.summaryButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="View lesson summary">
            <Text style={styles.summaryButtonText}>Finish lesson</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={reply}
            onChangeText={setReply}
            placeholder="Type your reply..."
            placeholderTextColor={palette.muted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
        </View>
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
  },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: palette.bubbleAi,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  aiBubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: palette.text,
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
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryButtonPressed: {
    backgroundColor: palette.accentPressed,
    opacity: 0.95,
  },
  summaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
  input: {
    minHeight: 44,
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
});
