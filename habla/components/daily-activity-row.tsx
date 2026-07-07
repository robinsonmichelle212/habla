import type { DailyActivityDay, DailyActivityKind } from '@/lib/daily-activity';
import { StyleSheet, Text, View } from 'react-native';

const palette = {
  muted: '#8B95A5',
  accent: '#FF7A59',
  grey: '#3D4654',
  greyBorder: '#4A5568',
  gem: '#A78BFA',
  dot: '#F4F6F8',
};

const KIND_LABELS: Record<DailyActivityKind, string> = {
  none: 'No activity',
  lesson: 'Lesson completed',
  drill: 'Practice drill',
  both: 'Lesson and drill',
  gem: 'Gem shop round',
};

type Props = {
  days: DailyActivityDay[];
};

export function DailyActivityRow({ days }: Props) {
  if (!days.length) return null;

  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="Last 7 days activity">
      {days.map((day) => (
        <View key={day.date} style={styles.dayCol}>
          <ActivityCircle kind={day.kind} />
          <Text style={styles.dayLetter}>{day.dayLetter}</Text>
        </View>
      ))}
    </View>
  );
}

function ActivityCircle({ kind }: { kind: DailyActivityKind }) {
  const label = KIND_LABELS[kind];

  if (kind === 'none') {
    return (
      <View
        style={[styles.circle, styles.circleEmpty]}
        accessibilityLabel={label}
      />
    );
  }

  if (kind === 'lesson') {
    return (
      <View
        style={[styles.circle, styles.circleFull]}
        accessibilityLabel={label}
      />
    );
  }

  if (kind === 'drill') {
    return (
      <View
        style={[styles.circle, styles.circleEmpty]}
        accessibilityLabel={label}>
        <View style={styles.halfFill} />
      </View>
    );
  }

  if (kind === 'both') {
    return (
      <View
        style={[styles.circle, styles.circleFull]}
        accessibilityLabel={label}>
        <View style={styles.centerDot} />
      </View>
    );
  }

  return (
    <View
      style={[styles.circle, styles.circleEmpty, styles.gemCircle]}
      accessibilityLabel={label}>
      <Text style={styles.gemEmoji}>💎</Text>
    </View>
  );
}

const CIRCLE_SIZE = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 5,
    minWidth: 28,
  },
  dayLetter: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    letterSpacing: 0.2,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
  },
  circleEmpty: {
    borderWidth: 2,
    borderColor: palette.greyBorder,
    backgroundColor: 'transparent',
  },
  circleFull: {
    backgroundColor: palette.accent,
    borderWidth: 0,
  },
  halfFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: palette.accent,
  },
  centerDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.dot,
    top: (CIRCLE_SIZE - 7) / 2,
    left: (CIRCLE_SIZE - 7) / 2,
  },
  gemCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: palette.gem,
  },
  gemEmoji: {
    fontSize: 12,
    lineHeight: 14,
  },
});
