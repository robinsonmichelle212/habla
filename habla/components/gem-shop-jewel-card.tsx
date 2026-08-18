import type { BonusRoundDef, RoundShopState } from '@/lib/gem-shop';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

export const JEWEL_PALETTE = {
  background: '#0B0B14',
  card: '#1A1A2E',
  cardRevealed: '#24243C',
  cardBorder: '#2A2A44',
  text: '#F4F6F8',
  muted: '#7A8194',
  accent: '#FF7A59',
  gem: '#C4B5FD',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
} as const;

export type CardOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  round: BonusRoundDef;
  shopState: RoundShopState;
  gems: number;
  demoMode: boolean;
  completedLevels: number;
  revealed: boolean;
  reduceMotion: boolean;
  liteEffects: boolean;
  size: number;
  hidden: boolean;
  expiryLabel: string | null;
  onReveal: () => void;
  onOpen: (origin: CardOrigin) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function statusLabel(
  shopState: RoundShopState,
  demoMode: boolean,
  gems: number,
): string {
  if (shopState.kind === 'mastered') return 'Mastered';
  if (shopState.kind === 'play') return `Level ${shopState.level} ready`;
  if (shopState.kind === 'locked') return `Level ${shopState.blockedLevel} locked`;
  if (demoMode) return 'Try for free';
  if (gems < shopState.cost) return `${shopState.cost} 💎`;
  return `${shopState.cost} 💎`;
}

function isLockedSilhouette(
  shopState: RoundShopState,
  gems: number,
  demoMode: boolean,
): boolean {
  if (shopState.kind === 'locked') return true;
  if (shopState.kind === 'unlock' && !demoMode && gems < shopState.cost) return true;
  return false;
}

export function JewelCard({
  round,
  shopState,
  gems,
  demoMode,
  completedLevels,
  revealed,
  reduceMotion,
  liteEffects,
  size,
  hidden,
  expiryLabel,
  onReveal,
  onOpen,
}: Props) {
  const cardRef = useRef<View>(null);
  const revealedAtPress = useRef(false);
  const rafRef = useRef<number | null>(null);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const revealAnim = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;

  const allowShimmer = !reduceMotion && !liteEffects;
  const allowTilt = !reduceMotion && !liteEffects && Platform.OS !== 'web';
  const allowSpring = !reduceMotion;

  useEffect(() => {
    if (reduceMotion) {
      revealAnim.setValue(revealed ? 1 : 0);
      return;
    }
    Animated.timing(revealAnim, {
      toValue: revealed ? 1 : 0,
      duration: revealed ? 400 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [revealed, reduceMotion, revealAnim]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const playShimmer = () => {
    shimmerAnim.setValue(0);
    Animated.timing(shimmerAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const playSpring = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.06,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    });
  };

  const resetTilt = () => {
    Animated.timing(tiltX, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(tiltY, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handleTiltMove = (event: GestureResponderEvent) => {
    if (!allowTilt) return;
    if (rafRef.current != null) return;
    const { locationX, locationY } = event.nativeEvent;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const nextX = clamp(((locationY - size / 2) / size) * 8, -8, 8);
      const nextY = clamp(((locationX - size / 2) / size) * -8, -8, 8);
      tiltX.setValue(nextX);
      tiltY.setValue(nextY);
    });
  };

  const openFromLayout = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onOpen({ x, y, width, height });
    });
  };

  const locked = isLockedSilhouette(shopState, gems, demoMode);
  const playable = shopState.kind === 'play' || shopState.kind === 'mastered';
  const nextLevel = completedLevels < 5 ? completedLevels + 1 : null;
  const progressLabel =
    completedLevels <= 0
      ? 'Level 1 next'
      : completedLevels >= 5
        ? 'All 5 levels completed'
        : `Level ${completedLevels} completed — Level ${nextLevel} next`;

  const silhouetteOpacity = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const revealedOpacity = revealAnim;
  const emojiScale = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-size, size * 2],
  });
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [0, 0.3, 0.3, 0],
  });
  const glowOpacity = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const rotateX = tiltX.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-8deg', '8deg'],
  });
  const rotateY = tiltY.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-8deg', '8deg'],
  });

  const status = expiryLabel ?? statusLabel(shopState, demoMode, gems);

  return (
    <Animated.View
      ref={cardRef}
      collapsable={false}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.card,
        {
          width: size,
          height: size,
          opacity: hidden ? 0 : 1,
          transform: [
            { perspective: 800 },
            { rotateX },
            { rotateY },
            { scale: scaleAnim },
          ],
        },
      ]}>
      <Pressable
        onPressIn={() => {
          revealedAtPress.current = revealed;
          if (!revealed) onReveal();
          if (allowShimmer && !revealed) playShimmer();
          if (allowSpring && !revealed) playSpring();
        }}
        onPressOut={() => {
          resetTilt();
        }}
        onPress={() => {
          if (revealedAtPress.current) openFromLayout();
        }}
        onTouchMove={handleTiltMove}
        accessibilityRole="button"
        accessibilityLabel={`${round.name}. ${status}. ${revealed ? 'Open' : 'Reveal'}`}
        style={styles.press}>
        <View style={styles.baseFill} />

        <Animated.View
          pointerEvents="none"
          style={[styles.glowBorder, { opacity: glowOpacity }]}
        />

        {locked ? (
          <Text style={styles.lockMark}>🔒</Text>
        ) : playable ? (
          <View style={styles.readyDot} />
        ) : null}

        <Animated.View style={[styles.body, { opacity: silhouetteOpacity }]}>
          <Text
            style={[
              styles.emoji,
              Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as Record<string, string>) : null,
            ]}>
            {round.emoji}
          </Text>
          <Text numberOfLines={2} style={styles.name}>
            {round.name}
          </Text>
          <Text numberOfLines={1} style={styles.status}>
            {status}
          </Text>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.revealedCopy, { opacity: revealedOpacity }]}>
          <Animated.Text
            style={[
              styles.emojiRevealed,
              { transform: [{ scale: emojiScale }] },
            ]}>
            {round.emoji}
          </Animated.Text>
          <Text numberOfLines={2} style={styles.nameRevealed}>
            {round.name}
          </Text>
          <Text numberOfLines={1} style={styles.statusRevealed}>
            {status}
          </Text>
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, Math.min(100, (completedLevels / 5) * 100))}%` },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {allowShimmer ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                transform: [{ translateX: shimmerX }, { rotate: '28deg' }],
              },
            ]}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: JEWEL_PALETTE.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: JEWEL_PALETTE.cardBorder,
  },
  press: { flex: 1 },
  baseFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: JEWEL_PALETTE.card,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.55)',
    backgroundColor: JEWEL_PALETTE.cardRevealed,
    shadowColor: JEWEL_PALETTE.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  lockMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 11,
    opacity: 0.55,
    zIndex: 3,
  },
  readyDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: JEWEL_PALETTE.accent,
    opacity: 0.7,
    zIndex: 3,
  },
  body: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  revealedCopy: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 36,
    opacity: 0.6,
    marginBottom: 4,
  },
  emojiRevealed: {
    fontSize: 40,
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    color: JEWEL_PALETTE.muted,
  },
  nameRevealed: {
    fontSize: 14,
    fontWeight: '800',
    color: JEWEL_PALETTE.text,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    color: JEWEL_PALETTE.muted,
  },
  statusRevealed: {
    fontSize: 12,
    fontWeight: '700',
    color: JEWEL_PALETTE.accent,
    textAlign: 'center',
  },
  progressWrap: {
    width: '100%',
    marginTop: 8,
    gap: 5,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JEWEL_PALETTE.muted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 122, 89, 0.7)',
  },
  shimmer: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});
