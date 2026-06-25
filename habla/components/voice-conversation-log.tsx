import { JaviSpanishMessage } from '@/components/javi-spanish-message';
import { StyleSheet, Text, View } from 'react-native';

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

function safeSpanish(spanish: string): string {
  return spanish.split(/\r?\n\s*(Translate|Translation)\s*:/i)[0].trim();
}

type Props = {
  messages: VoiceLogMessage[];
  latestJaviId: string | null;
  voiceSyncLatest?: boolean;
  source?: 'conversation' | 'reading';
};

export function VoiceConversationLog({
  messages,
  latestJaviId,
  voiceSyncLatest = false,
  source = 'conversation',
}: Props) {
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

        const isLatest = message.id === latestJaviId;
        const spanish = safeSpanish(message.spanish);

        return (
          <View key={message.id} style={styles.entry}>
            <Text style={styles.label}>Javi:</Text>
            <JaviSpanishMessage
              spanish={spanish}
              source={source}
              animate={isLatest}
              voiceSync={isLatest && voiceSyncLatest}
              resetKey={message.id}
              style={styles.javiText}
            />
          </View>
        );
      })}
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
  javiText: {
    fontSize: 15,
    lineHeight: 21,
    color: palette.text,
    fontWeight: '600',
  },
});
