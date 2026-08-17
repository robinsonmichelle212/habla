import {
  getActiveProgressionBlockKey,
  hasSeenProgressionGateway,
  markProgressionGatewaySeen,
} from '@/lib/progression-test';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

const ACCENT = '#FF7A59';
const BACKGROUND = '#0B0F14';
const POINT_RADIUS = 4;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type GatewayRenderProps = {
  contentOpacity: Animated.Value;
  titlePulse: Animated.Value;
};

type Props = {
  children: (props: GatewayRenderProps) => React.ReactNode;
};

export function GatewayAnimation({ children }: Props) {
  const { width, height } = useWindowDimensions();
  const holeRadius = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const titlePulse = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const skipRef = useRef<() => void>(() => {});
  const runIdRef = useRef(0);
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const maxRadius = Math.sqrt(width * width + height * height) / 2;
  const targetRadius = Math.max(maxRadius * 1.15, 1);
  const cx = width / 2;
  const cy = height / 2;

  const glowRadius = holeRadius.interpolate({
    inputRange: [0, POINT_RADIUS, targetRadius],
    outputRange: [0, POINT_RADIUS + 16, targetRadius],
    extrapolate: 'clamp',
  });
  const glowOpacity = holeRadius.interpolate({
    inputRange: [0, POINT_RADIUS, targetRadius * 0.55, targetRadius],
    outputRange: [0, 1, 0.28, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const runId = ++runIdRef.current;
    let cancelled = false;
    animsRef.current = [];

    const stopAnims = () => {
      animsRef.current.forEach((anim) => anim.stop());
      animsRef.current = [];
      holeRadius.stopAnimation();
      contentOpacity.stopAnimation();
      titlePulse.stopAnimation();
      overlayOpacity.stopAnimation();
    };

    const applyFinal = () => {
      holeRadius.setValue(targetRadius);
      contentOpacity.setValue(1);
      titlePulse.setValue(1);
      overlayOpacity.setValue(0);
      setOverlayVisible(false);
    };

    skipRef.current = () => {
      runIdRef.current += 1;
      stopAnims();
      applyFinal();
    };

    const playTitlePulse = () => {
      const pulse = Animated.sequence([
        Animated.timing(titlePulse, {
          toValue: 1.04,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(titlePulse, {
          toValue: 1,
          duration: 100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animsRef.current.push(pulse);
      pulse.start();
    };

    const playFull = () => {
      const expand = Animated.sequence([
        Animated.delay(100),
        Animated.timing(holeRadius, {
          toValue: POINT_RADIUS,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(holeRadius, {
          toValue: targetRadius,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]);
      const reveal = Animated.sequence([
        Animated.delay(700),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      const pulse = Animated.sequence([
        Animated.delay(1100),
        Animated.timing(titlePulse, {
          toValue: 1.04,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(titlePulse, {
          toValue: 1,
          duration: 100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

      animsRef.current.push(expand, reveal, pulse);
      expand.start(({ finished }) => {
        if (finished && runId === runIdRef.current) setOverlayVisible(false);
      });
      reveal.start();
      pulse.start();
    };

    void (async () => {
      const [reduceMotion, topicKey] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        getActiveProgressionBlockKey(),
      ]);
      if (cancelled || runId !== runIdRef.current) return;

      if (reduceMotion) {
        applyFinal();
        return;
      }

      const seen = await hasSeenProgressionGateway(topicKey);
      if (cancelled || runId !== runIdRef.current) return;

      if (seen) {
        overlayOpacity.setValue(0);
        contentOpacity.setValue(1);
        setOverlayVisible(false);
        playTitlePulse();
        return;
      }

      void markProgressionGatewaySeen(topicKey);
      playFull();
    })();

    return () => {
      cancelled = true;
      runIdRef.current += 1;
      stopAnims();
    };
  }, [contentOpacity, holeRadius, overlayOpacity, targetRadius, titlePulse]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {children({ contentOpacity, titlePulse })}
      </Animated.View>

      {overlayVisible ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable
            onPress={() => skipRef.current()}
            accessibilityRole="button"
            accessibilityLabel="Skip entrance animation"
            style={styles.overlayPress}>
            <Svg width={width} height={height}>
              <Defs>
                <Mask id="gatewayHole" x="0" y="0" width={width} height={height}>
                  <Rect width={width} height={height} fill="#FFFFFF" />
                  <AnimatedCircle cx={cx} cy={cy} r={holeRadius} fill="#000000" />
                </Mask>
                <RadialGradient id="gatewayGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFB199" stopOpacity="1" />
                  <Stop offset="0.35" stopColor={ACCENT} stopOpacity="0.9" />
                  <Stop offset="0.7" stopColor={ACCENT} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={BACKGROUND} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect
                width={width}
                height={height}
                fill={BACKGROUND}
                mask="url(#gatewayHole)"
              />
              <AnimatedCircle
                cx={cx}
                cy={cy}
                r={glowRadius}
                fill="url(#gatewayGlow)"
                opacity={glowOpacity}
              />
            </Svg>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    overflow: 'hidden',
  },
  overlayPress: {
    flex: 1,
  },
});
