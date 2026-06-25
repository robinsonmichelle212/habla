import { StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  green: '#34D399',
  error: '#F87171',
  accent: '#FF7A59',
};

type Props = {
  correct: string[];
  incorrect: string[];
  improvementTip: string;
};

export function SpeakingFeedbackCard({ correct, incorrect, improvementTip }: Props) {
  return (
    <View style={styles.card}>
      {correct.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What was correct ✅</Text>
          {correct.map((item, i) => (
            <Text key={`c-${i}`} style={styles.correctLine}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}
      {incorrect.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What was wrong ❌</Text>
          {incorrect.map((item, i) => (
            <Text key={`w-${i}`} style={styles.incorrectLine}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>For your next attempt</Text>
        <Text style={styles.tip}>{improvementTip}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 12,
    marginTop: 8,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  correctLine: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.green,
    fontWeight: '600',
  },
  incorrectLine: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.error,
    fontWeight: '600',
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.text,
    fontWeight: '600',
  },
});
