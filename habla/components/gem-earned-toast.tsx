import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  amount: number;
  onDone?: () => void;
};

export function GemEarnedToast({ amount, onDone }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (amount <= 0) {
      onDone?.();
      return;
    }

    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }),
    );
    translateY.value = withTiming(-72, { duration: 1600 });
  }, [amount, onDone, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (amount <= 0) return null;

  return (
    <Animated.View style={[styles.toast, animatedStyle]} pointerEvents="none">
      <Text style={styles.text}>💎 +{amount}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 100,
    backgroundColor: 'rgba(21, 27, 36, 0.92)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  text: {
    fontSize: 22,
    fontWeight: '900',
    color: '#A78BFA',
    letterSpacing: 0.3,
  },
});
