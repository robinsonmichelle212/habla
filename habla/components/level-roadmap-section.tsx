import {
  getRecentLessonScores,
  getScoreTrend,
  LEVEL_BANDS,
  shortBandLabel,
  type LevelBandId,
  type LevelBarometer,
} from '@/lib/level-progress';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import type { NextLevelRequirements } from '@/lib/level-progress';
import { useFocusEffect } from '@react-navigation/native';
import { Fragment, useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  track: '#3D4654',
};

const NODE_WIDTH = 72;
const CONNECTOR_WIDTH = 88;
const LINE_HEIGHT = 3;
const CIRCLE = 26;
const CIRCLE_CURRENT = 34;
const TRACK_OVERLAP = (NODE_WIDTH - CIRCLE) / 2;
const TRACK_WIDTH = CONNECTOR_WIDTH + TRACK_OVERLAP * 2;
const TICK_PERCENTS = [20, 40, 60, 80, 100] as const;
const DOT_SIZE = 12;

type Props = {
  barometer: LevelBarometer;
  nextRequirements: NextLevelRequirements | null;
  history: LessonHistoryEntry[];
  onSelectBand: (id: LevelBandId) => void;
  embedded?: boolean;
};

export function LevelRoadmapSection({
  barometer,
  nextRequirements,
  history,
  onSelectBand,
  embedded = false,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const fillAnim = useRef(new Animated.Value(0)).current;
  const priorTrackFill = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(1)).current;
  const currentPulse = useRef(new Animated.Value(1)).current;
  const nodeFills = useRef(LEVEL_BANDS.map(() => new Animated.Value(0))).current;

  const runIdRef = useRef(0);
  const animatingRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const journeyRef = useRef<Animated.CompositeAnimation | null>(null);
  const idlePulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const recentScores = getRecentLessonScores(history, 5).map((s) => Math.round(s));
  const trend = getScoreTrend(recentScores);
  const { bandIndex, progressInBand, nextBand } = barometer;
  const progressTarget = Math.min(1, Math.max(0, progressInBand / 100));
  const hasConnector = bandIndex < LEVEL_BANDS.length - 1;

  const travelPx = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });
  const priorFillPx = priorTrackFill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  const stopIdlePulse = useCallback(() => {
    idlePulseRef.current?.stop();
    idlePulseRef.current = null;
    currentPulse.stopAnimation();
    currentPulse.setValue(1);
  }, [currentPulse]);

  const stopJourney = useCallback(() => {
    journeyRef.current?.stop();
    journeyRef.current = null;
    fillAnim.stopAnimation();
    priorTrackFill.stopAnimation();
    dotScale.stopAnimation();
    nodeFills.forEach((value) => value.stopAnimation());
    stopIdlePulse();
  }, [dotScale, fillAnim, nodeFills, priorTrackFill, stopIdlePulse]);

  const applyFinal = useCallback(() => {
    fillAnim.setValue(progressTarget);
    priorTrackFill.setValue(1);
    dotScale.setValue(1);
    currentPulse.setValue(1);
    nodeFills.forEach((value, index) => {
      value.setValue(index <= bandIndex ? 1 : 0);
    });
  }, [bandIndex, currentPulse, dotScale, fillAnim, nodeFills, priorTrackFill, progressTarget]);

  const startIdlePulse = useCallback(() => {
    if (reduceMotionRef.current) return;
    stopIdlePulse();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(currentPulse, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(currentPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    idlePulseRef.current = pulse;
    pulse.start();
  }, [currentPulse, stopIdlePulse]);

  const skipToFinal = useCallback(() => {
    if (!animatingRef.current) return;
    runIdRef.current += 1;
    stopJourney();
    applyFinal();
    animatingRef.current = false;
    startIdlePulse();
  }, [applyFinal, startIdlePulse, stopJourney]);

  useFocusEffect(
    useCallback(() => {
      const runId = ++runIdRef.current;
      let cancelled = false;
      animatingRef.current = true;
      stopJourney();
      fillAnim.setValue(0);
      priorTrackFill.setValue(0);
      dotScale.setValue(1);
      currentPulse.setValue(1);
      nodeFills.forEach((value) => value.setValue(0));

      const finishIfCurrent = (finished: boolean, next: () => void) => {
        if (cancelled || !finished || runId !== runIdRef.current) return;
        next();
      };

      const lightCompletedNodes = () => {
        if (bandIndex <= 0) {
          animatingRef.current = false;
          startIdlePulse();
          return;
        }
        Animated.timing(priorTrackFill, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
        const nodes = Animated.stagger(
          80,
          nodeFills.slice(0, bandIndex).map((value) =>
            Animated.timing(value, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        );
        journeyRef.current = nodes;
        nodes.start(({ finished }) => {
          finishIfCurrent(finished, () => {
            animatingRef.current = false;
            startIdlePulse();
          });
        });
      };

      const bounceDot = () => {
        const scaleValue = hasConnector ? dotScale : currentPulse;
        const bounce = Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1.3,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(scaleValue, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }),
        ]);
        journeyRef.current = bounce;
        bounce.start(({ finished }) => {
          finishIfCurrent(finished, lightCompletedNodes);
        });
      };

      const playJourney = () => {
        animatingRef.current = true;
        const fillDuration = hasConnector && progressTarget > 0 ? 800 : 0;
        Animated.timing(nodeFills[bandIndex], {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        const fill = Animated.timing(fillAnim, {
          toValue: progressTarget,
          duration: fillDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        journeyRef.current = fill;
        fill.start(({ finished }) => {
          finishIfCurrent(finished, bounceDot);
        });
      };

      void (async () => {
        const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        if (cancelled || runId !== runIdRef.current) return;
        reduceMotionRef.current = reduceMotion;
        if (reduceMotion) {
          applyFinal();
          animatingRef.current = false;
          return;
        }
        playJourney();
      })();

      return () => {
        cancelled = true;
        runIdRef.current += 1;
        animatingRef.current = false;
        stopJourney();
      };
    }, [
      applyFinal,
      bandIndex,
      currentPulse,
      dotScale,
      fillAnim,
      hasConnector,
      nodeFills,
      priorTrackFill,
      progressTarget,
      startIdlePulse,
      stopJourney,
    ]),
  );

  useEffect(() => {
    const offset = Math.max(0, bandIndex * (NODE_WIDTH + CONNECTOR_WIDTH) - 40);
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  }, [bandIndex]);

  const gapLabel = nextBand
    ? `${nextRequirements?.gap ?? Math.max(0, (nextBand.min ?? 0) - barometer.averageScore)}% to reach ${nextBand.label}`
    : 'You are at the top level — keep practising!';

  return (
    <View style={embedded ? styles.embedded : styles.section}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trackScroll}
        style={styles.trackScrollView}>
        <Pressable onPress={skipToFinal} accessible={false} style={styles.trackRow}>
          {LEVEL_BANDS.map((band, index) => {
            const isAchieved = index < bandIndex;
            const isCurrent = index === bandIndex;
            const isFuture = index > bandIndex;
            const { tier, name } = shortBandLabel(band.label);
            const showDot = isCurrent && hasConnector;

            return (
              <Fragment key={band.id}>
                <View style={styles.nodeCol}>
                  <View style={styles.nodeCircleSlot}>
                    <Pressable
                      onPress={() => {
                        skipToFinal();
                        onSelectBand(band.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${band.label} level details`}
                      style={styles.circlePress}>
                      {isCurrent ? (
                        <View style={styles.currentAnchor}>
                          <View style={[styles.circle, styles.circleEmpty]} />
                          <Animated.View
                            style={[
                              styles.circleOuter,
                              styles.circleCurrentOuter,
                              {
                                opacity: nodeFills[index],
                                transform: [{ scale: currentPulse }],
                              },
                            ]}>
                            <View style={[styles.circle, styles.circleCurrent]}>
                              <View style={styles.circleCurrentFill} />
                            </View>
                          </Animated.View>
                        </View>
                      ) : (
                        <View style={[styles.circle, styles.circleEmpty]}>
                          <Animated.View
                            pointerEvents="none"
                            style={[styles.circleFill, { opacity: nodeFills[index] }]}
                          />
                        </View>
                      )}
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => {
                      skipToFinal();
                      onSelectBand(band.id);
                    }}
                    style={styles.labelPress}>
                    <Text style={[styles.tierLabel, isCurrent && styles.labelCurrent]}>{tier}</Text>
                    <Text
                      style={[
                        styles.nameLabel,
                        isAchieved && styles.labelAchieved,
                        isCurrent && styles.labelCurrent,
                        isFuture && styles.labelFuture,
                      ]}
                      numberOfLines={2}>
                      {name}
                    </Text>
                  </Pressable>
                </View>

                {index < LEVEL_BANDS.length - 1 ? (
                  <View style={styles.connector}>
                    <View style={styles.connectorTrack}>
                      <View style={styles.lineBg} />
                      {index < bandIndex ? (
                        <Animated.View style={[styles.lineFill, { width: priorFillPx }]} />
                      ) : null}
                      {index === bandIndex ? (
                        <Animated.View style={[styles.lineFill, { width: travelPx }]} />
                      ) : null}
                      {TICK_PERCENTS.map((pct) => (
                        <View key={pct} style={[styles.tick, { left: `${pct}%` }]} />
                      ))}
                      {showDot ? (
                        <Animated.View style={[styles.progressDotWrap, { left: travelPx }]}>
                          <Animated.View style={{ transform: [{ scale: dotScale }] }}>
                            <View style={styles.progressDot} />
                          </Animated.View>
                        </Animated.View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </Pressable>
      </ScrollView>

      <View style={styles.scoreContext}>
        <ContextLine label="Current band" value={barometer.band.label} highlight />
        <ContextLine label="Your average" value={`${barometer.averageScore}%`} />
        <ContextLine
          label="Target for next level"
          value={
            nextRequirements && nextBand
              ? `${nextRequirements.targetAverage}%`
              : '—'
          }
        />
        <ContextLine label="Gap to close" value={gapLabel} />
      </View>

      {recentScores.length > 0 ? (
        <View style={styles.trendBlock}>
          <View style={styles.trendTrack}>
            {recentScores.map((score, i) => (
              <View key={`${score}-${i}`} style={styles.trendDotCol}>
                <View
                  style={[
                    styles.trendDot,
                    { opacity: 0.45 + (score / 100) * 0.55 },
                  ]}
                />
                {i < recentScores.length - 1 ? <View style={styles.trendConnector} /> : null}
              </View>
            ))}
          </View>
          <Text style={styles.trendMessage}>{trend.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ContextLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.contextRow}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={[styles.contextValue, highlight && styles.contextValueHighlight]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  embedded: { marginBottom: 0 },
  trackScrollView: { marginHorizontal: -4 },
  trackScroll: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 },
  trackRow: { flexDirection: 'row', alignItems: 'flex-start', overflow: 'visible' },
  nodeCol: { width: NODE_WIDTH, alignItems: 'center', zIndex: 2 },
  nodeCircleSlot: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentAnchor: {
    width: CIRCLE_CURRENT + 8,
    height: CIRCLE_CURRENT + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: CONNECTOR_WIDTH,
    height: 44,
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  connectorTrack: {
    height: LINE_HEIGHT,
    width: TRACK_WIDTH,
    marginLeft: -TRACK_OVERLAP,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  lineBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.track,
    borderRadius: 999,
  },
  lineFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  tick: {
    position: 'absolute',
    top: -3,
    width: 1.5,
    height: 9,
    marginLeft: -0.75,
    backgroundColor: palette.muted,
    opacity: 0.55,
    borderRadius: 1,
    zIndex: 1,
  },
  progressDotWrap: {
    position: 'absolute',
    top: -(DOT_SIZE / 2 - LINE_HEIGHT / 2),
    marginLeft: -(DOT_SIZE / 2),
    zIndex: 4,
  },
  progressDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: palette.accent,
    borderWidth: 2,
    borderColor: palette.background,
  },
  circlePress: { zIndex: 2 },
  labelPress: { alignItems: 'center', paddingTop: 6, minHeight: 36 },
  circleOuter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCurrentOuter: {
    width: CIRCLE_CURRENT + 8,
    height: CIRCLE_CURRENT + 8,
    borderRadius: (CIRCLE_CURRENT + 8) / 2,
    backgroundColor: 'rgba(255, 122, 89, 0.15)',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    overflow: 'hidden',
  },
  circleEmpty: {
    borderColor: palette.track,
    backgroundColor: palette.background,
  },
  circleFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.accent,
    borderRadius: CIRCLE / 2,
  },
  circleCurrent: {
    width: CIRCLE_CURRENT,
    height: CIRCLE_CURRENT,
    borderRadius: CIRCLE_CURRENT / 2,
    borderWidth: 3,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    overflow: 'hidden',
  },
  circleCurrentFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.accent,
    borderRadius: CIRCLE_CURRENT / 2,
  },
  tierLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.muted,
    letterSpacing: 0.4,
  },
  nameLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 1,
  },
  labelAchieved: { color: palette.text },
  labelCurrent: { color: palette.accent },
  labelFuture: { color: palette.muted },
  scoreContext: {
    marginTop: 14,
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    flexShrink: 0,
  },
  contextValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  contextValueHighlight: { color: palette.accent },
  trendBlock: { marginTop: 12, gap: 8 },
  trendTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  trendDotCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
  trendConnector: {
    width: 20,
    height: 2,
    backgroundColor: palette.track,
    marginHorizontal: 2,
  },
  trendMessage: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
});
