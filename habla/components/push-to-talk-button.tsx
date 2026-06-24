import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type VoiceButtonState = 'idle' | 'recording' | 'processing' | 'javi-speaking';

const palette = {
  accent: '#FF7A59',
  accentPressed: '#E86242',
  recording: '#EF4444',
  javi: '#6B9FD4',
  muted: '#8B95A5',
  text: '#F4F6F8',
};

type Props = {
  state: VoiceButtonState;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

function WaveformBars({ color }: { color: string }) {
  const bars = [useRef(new Animated.Value(0.35)).current, useRef(new Animated.Value(0.6)).current, useRef(new Animated.Value(0.45)).current, useRef(new Animated.Value(0.75)).current, useRef(new Animated.Value(0.5)).current];

  useEffect(() => {
    const animations = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 320 + index * 40,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.25,
            duration: 320 + index * 40,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={styles.waveRow}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              transform: [
                {
                  scaleY: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function PushToTalkButton({ state, disabled, onPressIn, onPressOut }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'recording') {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.18,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, state]);

  const ringColor =
    state === 'recording'
      ? palette.recording
      : state === 'javi-speaking'
        ? palette.javi
        : palette.accent;

  const innerDisabled = disabled || state === 'processing' || state === 'javi-speaking';

  return (
    <View style={styles.wrap}>
      {state === 'recording' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              borderColor: palette.recording,
              transform: [{ scale: pulse }],
              opacity: pulse.interpolate({ inputRange: [1, 1.18], outputRange: [0.55, 0.15] }),
            },
          ]}
        />
      ) : null}

      <Pressable
        onPressIn={innerDisabled ? undefined : onPressIn}
        onPressOut={innerDisabled ? undefined : onPressOut}
        disabled={innerDisabled}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'recording'
            ? 'Recording'
            : state === 'processing'
              ? 'Processing speech'
              : state === 'javi-speaking'
                ? 'Javi is speaking'
                : 'Hold to speak'
        }
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor:
              state === 'recording'
                ? palette.recording
                : state === 'javi-speaking'
                  ? palette.javi
                  : palette.accent,
            opacity: innerDisabled ? 0.55 : pressed && state === 'idle' ? 0.92 : 1,
          },
        ]}>
        {state === 'processing' ? (
          <ActivityIndicator color="#0B0F14" size="large" />
        ) : state === 'javi-speaking' ? (
          <WaveformBars color="#0B0F14" />
        ) : state === 'recording' ? (
          <WaveformBars color="#FFFFFF" />
        ) : (
          <Text style={styles.micIcon}>🎤</Text>
        )}
      </Pressable>

      <View
        pointerEvents="none"
        style={[styles.ring, { borderColor: ringColor, opacity: state === 'idle' ? 0.35 : 0.9 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  pulseRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
  },
  button: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  micIcon: {
    fontSize: 36,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 28,
  },
  waveBar: {
    width: 5,
    height: 28,
    borderRadius: 3,
  },
});
