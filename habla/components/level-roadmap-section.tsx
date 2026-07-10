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
import { useEffect, useRef } from 'react';
import {
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

const NODE_WIDTH = 96;
const LINE_HEIGHT = 3;
const CIRCLE = 26;
const CIRCLE_CURRENT = 34;

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
  const pulse = useRef(new Animated.Value(1)).current;
  const markerPulse = useRef(new Animated.Value(1)).current;
  const recentScores = getRecentLessonScores(history, 5).map((s) => Math.round(s));
  const trend = getScoreTrend(recentScores);
  const { bandIndex, progressInBand, nextBand } = barometer;

  useEffect(() => {
    const makePulse = (value: Animated.Value, peak: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: peak,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const nodeAnim = makePulse(pulse, 1.18);
    const markerAnim = makePulse(markerPulse, 1.35);
    nodeAnim.start();
    markerAnim.start();
    return () => {
      nodeAnim.stop();
      markerAnim.stop();
    };
  }, [pulse, markerPulse]);

  useEffect(() => {
    const offset = Math.max(0, bandIndex * NODE_WIDTH - 40);
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
        <View style={styles.trackRow}>
          {LEVEL_BANDS.map((band, index) => {
            const isAchieved = index < bandIndex;
            const isCurrent = index === bandIndex;
            const isFuture = index > bandIndex;
            const { tier, name } = shortBandLabel(band.label);

            const leftSegmentFill =
              index > 0
                ? index - 1 < bandIndex
                  ? 1
                  : index - 1 === bandIndex
                    ? progressInBand / 100
                    : 0
                : 0;

            const rightSegmentFill =
              index < LEVEL_BANDS.length - 1
                ? index < bandIndex
                  ? 1
                  : index === bandIndex
                    ? progressInBand / 100
                    : 0
                : 0;

            const showMarker = isCurrent && index < LEVEL_BANDS.length - 1;

            return (
              <View key={band.id} style={styles.nodeCol}>
                <View style={styles.nodeTrackRow}>
                  <View style={[styles.halfLine, index === 0 && styles.halfLineHidden]}>
                    {index > 0 ? (
                      <>
                        <View style={styles.lineBg} />
                        <View style={[styles.lineFill, { width: `${leftSegmentFill * 100}%` }]} />
                      </>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => onSelectBand(band.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${band.label} level details`}
                    style={styles.circlePress}>
                    {isCurrent ? (
                      <Animated.View
                        style={[
                          styles.circleOuter,
                          styles.circleCurrentOuter,
                          { transform: [{ scale: pulse }] },
                        ]}>
                        <View style={[styles.circle, styles.circleCurrent]} />
                      </Animated.View>
                    ) : (
                      <View
                        style={[
                          styles.circle,
                          isAchieved && styles.circleAchieved,
                          isFuture && styles.circleFuture,
                        ]}
                      />
                    )}
                  </Pressable>

                  <View
                    style={[
                      styles.halfLine,
                      index === LEVEL_BANDS.length - 1 && styles.halfLineHidden,
                    ]}>
                    {index < LEVEL_BANDS.length - 1 ? (
                      <>
                        <View style={styles.lineBg} />
                        <View style={[styles.lineFill, { width: `${rightSegmentFill * 100}%` }]} />
                        {showMarker ? (
                          <View
                            style={[
                              styles.youAreHereWrap,
                              { left: `${Math.min(98, Math.max(2, progressInBand))}%` },
                            ]}>
                            <Animated.View style={{ transform: [{ scale: markerPulse }] }}>
                              <View style={styles.youAreHereDot} />
                            </Animated.View>
                            <Text style={styles.youAreHereText}>You are here</Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                </View>

                <Pressable onPress={() => onSelectBand(band.id)} style={styles.labelPress}>
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
            );
          })}
        </View>
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
  trackScroll: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  trackRow: { flexDirection: 'row', alignItems: 'flex-start' },
  nodeCol: { width: NODE_WIDTH, alignItems: 'center' },
  nodeTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: NODE_WIDTH,
    height: 44,
  },
  halfLine: {
    flex: 1,
    height: LINE_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  halfLineHidden: { opacity: 0 },
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
  circlePress: { zIndex: 2 },
  circleOuter: {
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
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  circleAchieved: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  circleCurrent: {
    width: CIRCLE_CURRENT,
    height: CIRCLE_CURRENT,
    borderRadius: CIRCLE_CURRENT / 2,
    borderWidth: 3,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  circleFuture: {
    backgroundColor: palette.background,
    borderColor: palette.track,
  },
  youAreHereWrap: {
    position: 'absolute',
    top: -22,
    transform: [{ translateX: -28 }],
    alignItems: 'center',
    width: 56,
    zIndex: 3,
  },
  youAreHereDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
    marginBottom: 2,
  },
  youAreHereText: {
    fontSize: 8,
    fontWeight: '800',
    color: palette.accent,
    textAlign: 'center',
  },
  labelPress: { alignItems: 'center', paddingTop: 6, minHeight: 36 },
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
