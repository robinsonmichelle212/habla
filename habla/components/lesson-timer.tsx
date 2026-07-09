import { formatLessonElapsed } from '@/lib/lesson-timer';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const palette = {
  muted: '#8B95A5',
  text: '#F4F6F8',
  surface: '#151B24',
  border: '#252D3A',
};

type Props = {
  /** Change to restart the timer (e.g. new lesson type). */
  resetKey?: string | number;
  /** Pause counting — keeps the current elapsed value visible. */
  paused?: boolean;
};

export function LessonTimer({ resetKey, paused = false }: Props) {
  const startedAtRef = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    if (paused) return;

    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetKey, paused]);

  const label = formatLessonElapsed(elapsedSeconds);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="timer"
      accessibilityLabel={`Lesson time ${label}`}
      accessibilityLiveRegion="polite">
      <Text style={styles.icon}>⏱</Text>
      <Text style={styles.time}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  icon: {
    fontSize: 12,
    lineHeight: 14,
  },
  time: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
});
