import { useJaviTypingAnimation } from '@/hooks/use-javi-typing-animation';
import { JaviTypingIndicator } from '@/components/javi-typing-indicator';
import { StyleSheet, Text, type TextStyle } from 'react-native';

type Props = {
  text: string;
  animate: boolean;
  voiceSync?: boolean;
  resetKey?: string;
  style?: TextStyle;
  onComplete?: () => void;
};

export function JaviTypingText({
  text,
  animate,
  voiceSync = false,
  resetKey,
  style,
  onComplete,
}: Props) {
  const { displayedText, showTypingIndicator } = useJaviTypingAnimation(text, {
    enabled: animate,
    voiceSync,
    resetKey,
    onComplete,
  });

  if (showTypingIndicator) {
    return <JaviTypingIndicator />;
  }

  return (
    <Text style={[styles.text, style]}>
      {displayedText}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
});
