import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { scoreColorFor } from '@/hooks/use-summary-reveal';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 148;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  score: number;
  progress: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  pending?: boolean;
};

export function SummaryScoreRing({ score, progress, scale, opacity, pending }: Props) {
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: 'clamp',
  });

  const ringColor = progress.interpolate({
    inputRange: [0, 59, 60, 74, 75, 100],
    outputRange: ['#F87171', '#F87171', '#FBBF24', '#FBBF24', '#34D399', '#34D399'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }] }]}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#252D3A"
          strokeWidth={STROKE}
          fill="transparent"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="transparent"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        {pending ? (
          <Text style={[styles.score, styles.pendingScore]}>Pending ⏳</Text>
        ) : (
          <Text style={[styles.score, { color: scoreColorFor(score) }]}>{score}%</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  svg: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pendingScore: {
    fontSize: 22,
    color: '#8B95A5',
    letterSpacing: 0,
  },
});
