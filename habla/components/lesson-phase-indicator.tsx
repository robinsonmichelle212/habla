import { StyleSheet, Text, View } from 'react-native';

const palette = {
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  surfaceBorder: '#252D3A',
};

export const LESSON_PHASE_STEPS = [
  { id: 'write', emoji: '✍️', label: 'Write' },
  { id: 'speak', emoji: '🎤', label: 'Speak' },
  { id: 'converse', emoji: '💬', label: 'Converse' },
  { id: 'summary', emoji: '📊', label: 'Summary' },
] as const;

type Props = {
  /** 0 = Write, 1 = Speak, 2 = Converse, 3 = Summary */
  activeStep: number;
};

export function LessonPhaseIndicator({ activeStep }: Props) {
  return (
    <View style={styles.row}>
      {LESSON_PHASE_STEPS.map((step, index) => {
        const completed = index < activeStep;
        const active = index === activeStep;
        return (
          <View key={step.id} style={styles.stepWrap}>
            <Text
              style={[
                styles.emoji,
                completed && styles.emojiCompleted,
                active && styles.emojiActive,
                !completed && !active && styles.emojiUpcoming,
              ]}>
              {step.emoji}
            </Text>
            <Text
              style={[
                styles.label,
                completed && styles.labelCompleted,
                active && styles.labelActive,
              ]}
              numberOfLines={1}>
              {step.label}
            </Text>
            {index < LESSON_PHASE_STEPS.length - 1 ? (
              <Text style={[styles.arrow, completed && styles.arrowCompleted]}>→</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  stepWrap: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  emoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  emojiActive: {
    transform: [{ scale: 1.15 }],
  },
  emojiCompleted: {
    opacity: 0.45,
  },
  emojiUpcoming: {
    opacity: 0.35,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: palette.accent,
  },
  labelCompleted: {
    color: palette.muted,
    opacity: 0.55,
  },
  arrow: {
    position: 'absolute',
    right: -6,
    top: 4,
    fontSize: 10,
    color: palette.surfaceBorder,
    fontWeight: '700',
  },
  arrowCompleted: {
    color: palette.muted,
    opacity: 0.4,
  },
});
