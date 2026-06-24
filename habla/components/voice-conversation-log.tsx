import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  text: '#F4F6F8',
  muted: '#8B95A5',
  surfaceBorder: '#252D3A',
};

export type VoiceLogMessage = {
  id: string;
  role: 'user' | 'assistant';
  spanish: string;
  translation?: string;
};

function previewJaviText(spanish: string): string {
  const safe = spanish
    .split(/\r?\n\s*(Translate|Translation)\s*:/i)[0]
    .trim();
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length <= 6) return words.join(' ');
  return `${words.slice(0, 6).join(' ')}...`;
}

function safeSpanish(spanish: string): string {
  return spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();
}

type Props = {
  messages: VoiceLogMessage[];
  latestJaviId: string | null;
  revealedJaviId: string | null;
  onRevealLatestJavi: () => void;
};

export function VoiceConversationLog({
  messages,
  latestJaviId,
  revealedJaviId,
  onRevealLatestJavi,
}: Props) {
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const latestJavi = latestJaviId ? messages.find((m) => m.id === latestJaviId) : null;
  const latestRevealed = latestJaviId != null && revealedJaviId === latestJaviId;

  useEffect(() => {
    setTranslationRevealed(false);
  }, [latestJaviId]);

  return (
    <View style={styles.log}>
      {messages.map((message) => {
        if (message.role === 'user') {
          return (
            <View key={message.id} style={styles.entry}>
              <Text style={styles.label}>You said:</Text>
              <Text style={styles.userText}>{message.spanish}</Text>
            </View>
          );
        }

        const showFull = message.id === latestJaviId && latestRevealed;

        return (
          <View key={message.id} style={styles.entry}>
            <Text style={styles.label}>Javi:</Text>
            <Text style={styles.javiPreview}>
              {showFull ? safeSpanish(message.spanish) : previewJaviText(message.spanish)}
            </Text>
          </View>
        );
      })}

      {latestJavi && !latestRevealed ? (
        <Pressable onPress={onRevealLatestJavi} accessibilityRole="button" style={styles.revealRow}>
          <Text style={styles.revealLink}>👁️ See what Javi said</Text>
        </Pressable>
      ) : null}

      {latestJavi && latestRevealed && latestJavi.translation ? (
        <View style={styles.translationBlock}>
          {translationRevealed ? (
            <>
              <Pressable onPress={() => setTranslationRevealed(false)} accessibilityRole="button">
                <Text style={styles.revealLink}>Hide</Text>
              </Pressable>
              <Text style={styles.translationText}>{latestJavi.translation}</Text>
            </>
          ) : (
            <Pressable onPress={() => setTranslationRevealed(true)} accessibilityRole="button">
              <Text style={styles.revealLink}>👁️ Reveal</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  log: {
    gap: 14,
    paddingBottom: 8,
  },
  entry: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  userText: {
    fontSize: 15,
    lineHeight: 21,
    color: palette.muted,
  },
  javiPreview: {
    fontSize: 15,
    lineHeight: 21,
    color: palette.text,
    fontWeight: '600',
  },
  revealRow: {
    marginTop: 2,
  },
  revealLink: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  translationBlock: {
    marginTop: 2,
    gap: 4,
  },
  translationText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
  },
});
