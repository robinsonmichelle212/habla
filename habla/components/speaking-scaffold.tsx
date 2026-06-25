import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
};

type Props = {
  writtenText: string;
  countdownSeconds: number;
  onComplete: () => void;
};

export function SpeakingScaffold({ writtenText, countdownSeconds, onComplete }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const completedRef = useRef(false);

  useEffect(() => {
    if (countdownSeconds <= 0) {
      onComplete();
      return;
    }

    setSecondsLeft(countdownSeconds);
    opacity.setValue(1);
    completedRef.current = false;

    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tick);
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }).start(() => {
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete();
            }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [countdownSeconds, onComplete, opacity]);

  if (countdownSeconds <= 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Your written response — memorise it 👀</Text>
      <Animated.View style={[styles.textBox, { opacity }]}>
        <Text style={styles.writtenText}>{writtenText}</Text>
      </Animated.View>
      <Text style={styles.countdown}>
        {secondsLeft > 0 ? `${secondsLeft}s` : 'Fading…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textAlign: 'center',
  },
  textBox: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
  },
  writtenText: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(244, 246, 248, 0.45)',
    fontStyle: 'italic',
  },
  countdown: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.accent,
    textAlign: 'center',
  },
});
