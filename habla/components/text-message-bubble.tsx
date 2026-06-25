import { JaviSpanishMessage } from '@/components/javi-spanish-message';
import { StyleSheet, Text, View } from 'react-native';

const palette = {
  bubbleAi: '#1E2633',
  bubbleUser: '#2A1F2E',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
};

type Props = {
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
  animateTyping?: boolean;
  messageKey?: string;
};

export function TextMessageBubble({
  role,
  spanish,
  animateTyping = false,
  messageKey,
}: Props) {
  const isAssistant = role === 'assistant';
  const safeSpanish = spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();

  return (
    <View style={[styles.outer, isAssistant ? styles.outerAi : styles.outerUser]}>
      <View style={[styles.bubble, isAssistant ? styles.bubbleAi : styles.bubbleUser]}>
        {isAssistant ? (
          <JaviSpanishMessage
            spanish={safeSpanish}
            source="conversation"
            animate={animateTyping}
            resetKey={messageKey}
            style={styles.bubbleText}
          />
        ) : (
          <Text style={styles.bubbleText}>{safeSpanish}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', marginBottom: 10 },
  outerAi: { alignItems: 'flex-start' },
  outerUser: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  bubbleAi: {
    backgroundColor: palette.bubbleAi,
    borderColor: palette.surfaceBorder,
    borderBottomLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: palette.bubbleUser,
    borderColor: 'rgba(255, 122, 89, 0.35)',
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: palette.text,
  },
});
