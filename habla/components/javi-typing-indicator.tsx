import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const palette = {
  accent: '#FF7A59',
  muted: '#8B95A5',
};

export function JaviTypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.35,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 140);
    const a3 = pulse(dot3, 280);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.row} accessibilityLabel="Javi is typing">
      {[dot1, dot2, dot3].map((opacity, i) => (
        <Animated.Text key={i} style={[styles.dot, { opacity }]}>
          ●
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 22,
  },
  dot: {
    fontSize: 10,
    color: palette.accent,
  },
});
