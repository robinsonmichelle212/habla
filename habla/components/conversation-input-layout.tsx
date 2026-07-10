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

export function useKeyboardScrollToEnd(
  scrollRef: RefObject<ScrollView | null>,
  deps: unknown[] = [],
) {
  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
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
  bottomInset = 12,
  showPrompt = true,
  showResponseLabel,
}: DockProps) {
  const localInputRef = useRef<import('react-native').TextInput>(null);
  const resolvedInputRef = inputRef ?? localInputRef;
  const shouldShowResponseLabel = showResponseLabel ?? Boolean(showPrompt && prompt);

  return (
    <View style={[styles.dock, { paddingBottom: bottomInset }]}>
      {showPrompt ? (
        <View style={styles.promptPin}>
          {promptLoading ? (
            <ActivityIndicator color={palette.muted} size="small" />
          ) : (
            <Text style={styles.promptText}>{prompt?.trim() || '—'}</Text>
          )}
        </View>
      ) : null}
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

export function ConversationInputLayout({
  children,
  scrollRef: externalScrollRef,
  scrollToEndDeps = [],
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  showInput = true,
  bottomInset,
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
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {showInput ? (
        <ConversationInputDock
          {...dockProps}
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
    maxHeight: 150,
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
