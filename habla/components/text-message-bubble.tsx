import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JaviTypingText } from '@/components/javi-typing-text';

const palette = {
  bubbleAi: '#1E2633',
  bubbleUser: '#2A1F2E',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
};

type Props = {
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
  /** Animate word-by-word for the latest Javi message. */
  animateTyping?: boolean;
  messageKey?: string;
};

export function TextMessageBubble({
  role,
  spanish,
  translation,
  animateTyping = false,
  messageKey,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [typingComplete, setTypingComplete] = useState(!animateTyping);
  const isAssistant = role === 'assistant';
  const safeSpanish = spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();

  return (
    <View style={[styles.outer, isAssistant ? styles.outerAi : styles.outerUser]}>
      <View style={[styles.bubble, isAssistant ? styles.bubbleAi : styles.bubbleUser]}>
        {isAssistant && animateTyping ? (
          <JaviTypingText
            text={safeSpanish}
            animate
            resetKey={messageKey}
            style={styles.bubbleText}
            onComplete={() => setTypingComplete(true)}
          />
        ) : (
          <Text style={styles.bubbleText}>{safeSpanish}</Text>
        )}
      </View>
      {isAssistant && translation && typingComplete ? (
        <View style={styles.translationBlock}>
          {revealed ? (
            <>
              <Pressable onPress={() => setRevealed(false)} accessibilityRole="button">
                <Text style={styles.revealText}>Hide</Text>
              </Pressable>
              <Text style={styles.translationText}>{translation}</Text>
            </>
          ) : (
            <Pressable onPress={() => setRevealed(true)} accessibilityRole="button">
              <Text style={styles.revealText}>👁️ Reveal</Text>
            </Pressable>
          )}
        </View>
      ) : null}
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
  translationBlock: { marginTop: 6, maxWidth: '88%' },
  revealText: { fontSize: 12, fontWeight: '700', color: palette.muted },
  translationText: { marginTop: 6, fontSize: 13, lineHeight: 18, color: palette.muted },
});
