import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import ErrorBoundary from '@/components/ErrorBoundary';
import type { MilestoneCelebration } from '@/lib/milestones';

const palette = {
  background: '#0B0F14',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  gem: '#A78BFA',
  star: '#FBBF24',
};

type Props = {
  visible: boolean;
  celebration: MilestoneCelebration | null;
  navigating?: boolean;
  onDismiss: () => void;
  onRecoveryHome?: () => void;
};

function MilestoneCelebrationContent({
  visible,
  celebration,
  navigating = false,
  onDismiss,
}: Props) {
  const starsX = useSharedValue(-120);
  const starsOpacity = useSharedValue(0);
  const gemsScale = useSharedValue(0.3);
  const gemsOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible || !celebration) return;
    console.log('Milestone modal mounted');
  }, [visible, celebration]);

  useEffect(() => {
    if (!visible || !celebration) return;

    contentOpacity.value = 0;
    starsX.value = -120;
    starsOpacity.value = 0;
    gemsScale.value = 0.3;
    gemsOpacity.value = 0;

    contentOpacity.value = withTiming(1, { duration: 350 });
    starsOpacity.value = withDelay(400, withTiming(1, { duration: 250 }));
    starsX.value = withDelay(
      400,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    gemsOpacity.value = withDelay(900, withTiming(1, { duration: 200 }));
    gemsScale.value = withDelay(
      900,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 200 }),
      ),
    );

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible, celebration, contentOpacity, gemsOpacity, gemsScale, starsOpacity, starsX]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const starsStyle = useAnimatedStyle(() => ({
    opacity: starsOpacity.value,
    transform: [{ translateX: starsX.value }],
  }));

  const gemsStyle = useAnimatedStyle(() => ({
    opacity: gemsOpacity.value,
    transform: [{ scale: gemsScale.value }],
  }));

  if (!celebration) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={navigating ? undefined : onDismiss}>
      <View style={styles.screen}>
        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.emoji}>{celebration.emoji}</Text>
          <Text style={styles.name}>{celebration.name}</Text>
          <Text style={styles.description}>{celebration.description}</Text>
          <Text style={styles.message}>{celebration.message}</Text>

          {celebration.starsAwarded > 0 ? (
            <Animated.Text style={[styles.rewardStars, starsStyle]}>
              +{celebration.starsAwarded} 🌟
            </Animated.Text>
          ) : null}

          {celebration.gemsAwarded > 0 ? (
            <Animated.Text style={[styles.rewardGems, gemsStyle]}>
              +{celebration.gemsAwarded} 💎
            </Animated.Text>
          ) : null}

          <Pressable
            onPress={onDismiss}
            disabled={navigating}
            style={({ pressed }) => [
              styles.dismissBtn,
              (pressed || navigating) && styles.dismissBtnPressed,
              navigating && styles.dismissBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: navigating }}>
            <Text style={styles.dismissBtnText}>Keep Going 💪</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function MilestoneCelebrationModal(props: Props) {
  return (
    <ErrorBoundary onGoHome={props.onRecoveryHome}>
      <MilestoneCelebrationContent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 4,
  },
  message: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  rewardStars: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.star,
    marginTop: 16,
  },
  rewardGems: {
    fontSize: 36,
    fontWeight: '900',
    color: palette.gem,
    marginTop: 8,
  },
  dismissBtn: {
    marginTop: 36,
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: 'center',
  },
  dismissBtnPressed: {
    opacity: 0.88,
  },
  dismissBtnDisabled: {
    opacity: 0.55,
  },
  dismissBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
  },
});
