import { AppTextInput } from '@/components/app-text-input';
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  promptBg: '#1A2029',
};

/** Keep input clear of the keyboard (user request: ≥20px). */
export const KEYBOARD_INPUT_GAP = 20;
const INPUT_MAX_HEIGHT = 120;

export function useKeyboardScrollToEnd(
  scrollRef: RefObject<ScrollView | null>,
  deps: unknown[] = [],
) {
  const scrollToEnd = useCallback(() => {
    // Wait for keyboard + layout so the focused input stays above the keyboard.
    const run = () => scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(run, 50);
    setTimeout(run, 280);
  }, [scrollRef]);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, scrollToEnd);
    return () => sub.remove();
  }, [scrollToEnd]);

  useEffect(() => {
    scrollToEnd();
  }, [scrollToEnd, ...deps]);

  return scrollToEnd;
}

export function WritingPromptCard({
  prompt,
  loading = false,
}: {
  prompt?: string | null;
  loading?: boolean;
}) {
  return (
    <View style={styles.promptPin}>
      {loading ? (
        <ActivityIndicator color={palette.muted} size="small" />
      ) : (
        <Text style={styles.promptText}>{prompt?.trim() || '—'}</Text>
      )}
    </View>
  );
}

type DockProps = {
  prompt?: string | null;
  promptLoading?: boolean;
  responseLabel?: string;
  inputValue: string;
  onChangeText: (text: string) => void;
  inputPlaceholder?: string;
  inputEditable?: boolean;
  inputRef?: RefObject<import('react-native').TextInput | null>;
  onInputFocus?: () => void;
  footer?: ReactNode;
  trailingAction?: ReactNode;
  bottomInset?: number;
  /** When true, prompt renders in the dock (prefer putting prompt in ScrollView instead). */
  showPrompt?: boolean;
  showResponseLabel?: boolean;
};

export function ConversationInputDock({
  prompt,
  promptLoading = false,
  responseLabel = 'Your response:',
  inputValue,
  onChangeText,
  inputPlaceholder = 'Type your reply…',
  inputEditable = true,
  inputRef,
  onInputFocus,
  footer,
  trailingAction,
  bottomInset = KEYBOARD_INPUT_GAP,
  showPrompt = false,
  showResponseLabel,
}: DockProps) {
  const localInputRef = useRef<import('react-native').TextInput>(null);
  const resolvedInputRef = inputRef ?? localInputRef;
  const shouldShowResponseLabel = showResponseLabel ?? true;

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, KEYBOARD_INPUT_GAP) }]}>
      {showPrompt ? <WritingPromptCard prompt={prompt} loading={promptLoading} /> : null}
      {shouldShowResponseLabel ? <Text style={styles.responseLabel}>{responseLabel}</Text> : null}
      <View style={styles.inputRow}>
        <AppTextInput
          ref={resolvedInputRef}
          style={[styles.input, trailingAction ? styles.inputWithAction : null]}
          value={inputValue}
          onChangeText={onChangeText}
          placeholder={inputPlaceholder}
          placeholderTextColor={palette.muted}
          multiline
          scrollEnabled
          blurOnSubmit={false}
          editable={inputEditable}
          textAlignVertical="top"
          onFocus={() => onInputFocus?.()}
        />
        {trailingAction ? <View style={styles.trailingAction}>{trailingAction}</View> : null}
      </View>
      {!trailingAction ? footer : null}
    </View>
  );
}

type LayoutProps = DockProps & {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollToEndDeps?: unknown[];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardVerticalOffset?: number;
  showInput?: boolean;
};

/**
 * Long prompts/explanations scroll with content; the text input stays docked
 * above the keyboard via KeyboardAvoidingView.
 */
export function ConversationInputLayout({
  children,
  scrollRef: externalScrollRef,
  scrollToEndDeps = [],
  contentContainerStyle,
  keyboardVerticalOffset = 80,
  showInput = true,
  bottomInset,
  prompt,
  promptLoading,
  showPrompt = true,
  ...dockProps
}: LayoutProps) {
  const internalScrollRef = useRef<ScrollView>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const scrollToEnd = useKeyboardScrollToEnd(scrollRef, scrollToEndDeps);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={keyboardVerticalOffset}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContentGrow, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        {children}
        {showPrompt ? (
          <View style={styles.promptInScroll}>
            <WritingPromptCard prompt={prompt} loading={promptLoading} />
          </View>
        ) : null}
        {/* Spacer so scrollToEnd leaves the input clear of the keyboard edge */}
        <View style={{ height: KEYBOARD_INPUT_GAP }} />
      </ScrollView>
      {showInput ? (
        <ConversationInputDock
          {...dockProps}
          showPrompt={false}
          bottomInset={bottomInset}
          onInputFocus={() => scrollToEnd()}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContentGrow: { flexGrow: 1 },
  promptInScroll: { marginTop: 8, marginBottom: 4 },
  dock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    backgroundColor: palette.background,
    gap: 8,
  },
  promptPin: {
    backgroundColor: palette.promptBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 21,
  },
  responseLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 80,
    maxHeight: INPUT_MAX_HEIGHT,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  inputWithAction: {
    minHeight: 44,
  },
  trailingAction: {
    flexShrink: 0,
    paddingBottom: 2,
  },
});
