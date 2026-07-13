import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

const ITEM_STAGGER_MS = 200;
const SCORE_COUNT_MS = 800;
const GEM_COUNT_MS = 500;

function safeCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function safeScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type SummaryRevealControls = {
  skip: () => void;
  stop: () => void;
  complete: boolean;
  displayScore: number;
  titleOpacity: Animated.Value;
  titleTranslateY: Animated.Value;
  subtitleOpacity: Animated.Value;
  subtitleTranslateY: Animated.Value;
  scoreOpacity: Animated.Value;
  scoreScale: Animated.Value;
  scoreProgress: Animated.Value;
  strongHeaderOpacity: Animated.Value;
  strongHeaderTranslateX: Animated.Value;
  strongItemOpacities: Animated.Value[];
  weakHeaderOpacity: Animated.Value;
  weakHeaderTranslateX: Animated.Value;
  weakItemOpacities: Animated.Value[];
  focusHeaderOpacity: Animated.Value;
  focusHeaderTranslateX: Animated.Value;
  focusItemOpacities: Animated.Value[];
  gemsOpacity: Animated.Value;
  gemsScale: Animated.Value;
  gemPulse: Animated.Value;
  challengeOpacity: Animated.Value;
  challengeTranslateY: Animated.Value;
  challengeHighlight: Animated.Value;
  practiceOpacity: Animated.Value;
  homeOpacity: Animated.Value;
  gemCountDisplay: number;
};

export function scoreColorFor(value: number): string {
  if (value >= 75) return '#34D399';
  if (value >= 60) return '#FBBF24';
  return '#F87171';
}

function makeItemOpacities(count: number): Animated.Value[] {
  return Array.from({ length: Math.max(count, 0) }, () => new Animated.Value(0));
}

function fadeSlideIn(
  opacity: Animated.Value,
  translate: Animated.Value,
  duration = 320,
): Animated.CompositeAnimation {
  return Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translate, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]);
}

function fadeIn(opacity: Animated.Value, duration = 280): Animated.CompositeAnimation {
  return Animated.timing(opacity, {
    toValue: 1,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
}

function staggerItems(opacities: Animated.Value[], startDelay = 0): Animated.CompositeAnimation {
  if (!opacities.length) return Animated.delay(0);
  return Animated.sequence([
    Animated.delay(startDelay),
    Animated.stagger(
      ITEM_STAGGER_MS,
      opacities.map((opacity) =>
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ),
  ]);
}

export function useSummaryReveal(options: {
  enabled: boolean;
  overallScore: number;
  strongCount: number;
  weakCount: number;
  focusCount: number;
  gemsEarned: number;
  gemsBefore: number;
}): SummaryRevealControls {
  const safeOverallScore = safeScore(options.overallScore);
  const safeStrongCount = safeCount(options.strongCount);
  const safeWeakCount = safeCount(options.weakCount);
  const safeFocusCount = safeCount(options.focusCount);
  const safeGemsEarned = safeCount(options.gemsEarned);
  const safeGemsBefore = safeCount(options.gemsBefore);
  const enabled = !!options.enabled;

  const [complete, setComplete] = useState(!enabled);
  const [displayScore, setDisplayScore] = useState(enabled ? 0 : safeOverallScore);
  const [gemCountDisplay, setGemCountDisplay] = useState(safeGemsBefore);
  const skippedRef = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const gemsProgress = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const titleTranslateY = useRef(new Animated.Value(enabled ? -28 : 0)).current;
  const subtitleOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const subtitleTranslateY = useRef(new Animated.Value(enabled ? 18 : 0)).current;
  const scoreOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const scoreScale = useRef(new Animated.Value(enabled ? 0.85 : 1)).current;
  const scoreProgress = useRef(new Animated.Value(enabled ? 0 : safeOverallScore)).current;

  const strongHeaderOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const strongHeaderTranslateX = useRef(new Animated.Value(enabled ? -36 : 0)).current;
  const weakHeaderOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const weakHeaderTranslateX = useRef(new Animated.Value(enabled ? -36 : 0)).current;
  const focusHeaderOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const focusHeaderTranslateX = useRef(new Animated.Value(enabled ? -36 : 0)).current;

  const strongItemOpacities = useRef(makeItemOpacities(safeStrongCount)).current;
  const weakItemOpacities = useRef(makeItemOpacities(safeWeakCount)).current;
  const focusItemOpacities = useRef(makeItemOpacities(safeFocusCount)).current;

  const gemsOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const gemsScale = useRef(new Animated.Value(enabled ? 0.4 : 1)).current;
  const gemPulse = useRef(new Animated.Value(1)).current;
  const challengeOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const challengeTranslateY = useRef(new Animated.Value(enabled ? 48 : 0)).current;
  const challengeHighlight = useRef(new Animated.Value(enabled ? 0 : 0.35)).current;
  const practiceOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const homeOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;

  const applySkip = useCallback(() => {
    titleOpacity.setValue(1);
    titleTranslateY.setValue(0);
    subtitleOpacity.setValue(1);
    subtitleTranslateY.setValue(0);
    scoreOpacity.setValue(1);
    scoreScale.setValue(1);
    scoreProgress.setValue(safeOverallScore);
    strongHeaderOpacity.setValue(1);
    strongHeaderTranslateX.setValue(0);
    weakHeaderOpacity.setValue(1);
    weakHeaderTranslateX.setValue(0);
    focusHeaderOpacity.setValue(1);
    focusHeaderTranslateX.setValue(0);
    strongItemOpacities.forEach((o) => o.setValue(1));
    weakItemOpacities.forEach((o) => o.setValue(1));
    focusItemOpacities.forEach((o) => o.setValue(1));
    gemsOpacity.setValue(1);
    gemsScale.setValue(1);
    gemPulse.setValue(1);
    gemsProgress.setValue(1);
    challengeOpacity.setValue(1);
    challengeTranslateY.setValue(0);
    challengeHighlight.setValue(0.35);
    practiceOpacity.setValue(1);
    homeOpacity.setValue(1);
    setDisplayScore(safeOverallScore);
    setGemCountDisplay(safeGemsBefore + safeGemsEarned);
    setComplete(true);
  }, [
    safeOverallScore,
    safeGemsBefore,
    safeGemsEarned,
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    scoreOpacity,
    scoreScale,
    scoreProgress,
    strongHeaderOpacity,
    strongHeaderTranslateX,
    weakHeaderOpacity,
    weakHeaderTranslateX,
    focusHeaderOpacity,
    focusHeaderTranslateX,
    strongItemOpacities,
    weakItemOpacities,
    focusItemOpacities,
    gemsOpacity,
    gemsScale,
    gemPulse,
    gemsProgress,
    challengeOpacity,
    challengeTranslateY,
    challengeHighlight,
    practiceOpacity,
    homeOpacity,
  ]);

  const skip = useCallback(() => {
    if (!enabled || skippedRef.current) return;
    skippedRef.current = true;
    animationRef.current?.stop();
    applySkip();
  }, [enabled, applySkip]);

  const stop = useCallback(() => {
    skippedRef.current = true;
    animationRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDisplayScore(safeOverallScore);
      setGemCountDisplay(safeGemsBefore + safeGemsEarned);
      return;
    }

    const scoreListener = scoreProgress.addListener(({ value }) => {
      setDisplayScore(Math.round(Number.isFinite(value) ? value : 0));
    });

    const gemListener = gemsProgress.addListener(({ value }) => {
      setGemCountDisplay(Math.round(safeGemsBefore + safeGemsEarned * (Number.isFinite(value) ? value : 0)));
    });

    skippedRef.current = false;
    setComplete(false);
    setDisplayScore(0);
    setGemCountDisplay(safeGemsBefore);
    gemsProgress.setValue(0);

    const sequence = Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          delay: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 400,
          delay: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scoreOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scoreScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scoreProgress, {
          toValue: safeOverallScore,
          duration: SCORE_COUNT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(100),
      ...(safeStrongCount > 0
        ? [fadeSlideIn(strongHeaderOpacity, strongHeaderTranslateX), staggerItems(strongItemOpacities, 120)]
        : []),
      Animated.delay(safeWeakCount > 0 ? 180 : 80),
      ...(safeWeakCount > 0
        ? [fadeSlideIn(weakHeaderOpacity, weakHeaderTranslateX), staggerItems(weakItemOpacities, 120)]
        : []),
      Animated.delay(safeFocusCount > 0 ? 180 : 80),
      ...(safeFocusCount > 0
        ? [fadeSlideIn(focusHeaderOpacity, focusHeaderTranslateX), staggerItems(focusItemOpacities, 120)]
        : []),
      Animated.delay(200),
      Animated.parallel([
        fadeIn(gemsOpacity, 260),
        Animated.spring(gemsScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(gemsProgress, {
          toValue: 1,
          duration: GEM_COUNT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.sequence([
        Animated.timing(gemPulse, {
          toValue: 1.22,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(gemPulse, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(challengeOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(challengeTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(challengeHighlight, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(challengeHighlight, {
          toValue: 0.35,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
      fadeIn(practiceOpacity, 280),
      fadeIn(homeOpacity, 280),
    ]);

    animationRef.current = sequence;
    sequence.start(({ finished }) => {
      if (finished && !skippedRef.current) {
        setGemCountDisplay(safeGemsBefore + safeGemsEarned);
        setComplete(true);
      }
    });

    return () => {
      scoreProgress.removeListener(scoreListener);
      gemsProgress.removeListener(gemListener);
      sequence.stop();
    };
  }, [
    enabled,
    safeOverallScore,
    safeStrongCount,
    safeWeakCount,
    safeFocusCount,
    safeGemsEarned,
    safeGemsBefore,
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    scoreOpacity,
    scoreScale,
    scoreProgress,
    strongHeaderOpacity,
    strongHeaderTranslateX,
    weakHeaderOpacity,
    weakHeaderTranslateX,
    focusHeaderOpacity,
    focusHeaderTranslateX,
    strongItemOpacities,
    weakItemOpacities,
    focusItemOpacities,
    gemsOpacity,
    gemsScale,
    gemPulse,
    gemsProgress,
    challengeOpacity,
    challengeTranslateY,
    challengeHighlight,
    practiceOpacity,
    homeOpacity,
  ]);

  return {
    skip,
    stop,
    complete,
    displayScore,
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    scoreOpacity,
    scoreScale,
    scoreProgress,
    strongHeaderOpacity,
    strongHeaderTranslateX,
    strongItemOpacities,
    weakHeaderOpacity,
    weakHeaderTranslateX,
    weakItemOpacities,
    focusHeaderOpacity,
    focusHeaderTranslateX,
    focusItemOpacities,
    gemsOpacity,
    gemsScale,
    gemPulse,
    challengeOpacity,
    challengeTranslateY,
    challengeHighlight,
    practiceOpacity,
    homeOpacity,
    gemCountDisplay,
  };
}
