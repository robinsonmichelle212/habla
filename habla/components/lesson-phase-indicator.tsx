import { StyleSheet, View } from 'react-native';

const palette = {
  muted: '#8B95A5',
  accent: '#FF7A59',
  track: '#1A2029',
};

const SEGMENT_COUNT = 4;

type Props = {
  /** 0 = Write, 1 = Speak, 2 = Converse, 3 = Summary */
  activeStep: number;
};

export function LessonPhaseIndicator({ activeStep }: Props) {
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
        const completed = index < activeStep;
        const active = index === activeStep;
        return (
          <View
            key={index}
            style={[
              styles.segment,
              completed && styles.segmentCompleted,
              active && styles.segmentActive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.track,
  },
  segmentCompleted: {
    backgroundColor: palette.muted,
    opacity: 0.45,
  },
  segmentActive: {
    backgroundColor: palette.accent,
  },
});
