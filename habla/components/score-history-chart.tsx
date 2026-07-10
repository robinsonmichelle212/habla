import { progressPalette } from '@/components/progress/chart-theme';
import type { ScoreHistoryPoint, ScoreHistoryThreshold } from '@/lib/score-history';
import { formatScoreHistoryDate, parseDateKey } from '@/lib/score-history';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const CHART_HEIGHT = 148;
const PAD_LEFT = 28;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

type Props = {
  width: number;
  points: ScoreHistoryPoint[];
  threshold: ScoreHistoryThreshold | null;
  trendLabel: string;
  periodStart: string;
  periodEnd: string;
};

function scoreToY(score: number, innerHeight: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return PAD_TOP + innerHeight * (1 - clamped / 100);
}

function dateToX(date: string, start: string, end: string, innerWidth: number): number {
  const startMs = parseDateKey(start).getTime();
  const endMs = parseDateKey(end).getTime();
  const t = parseDateKey(date).getTime();
  if (endMs <= startMs) return PAD_LEFT + innerWidth / 2;
  const ratio = (t - startMs) / (endMs - startMs);
  return PAD_LEFT + Math.max(0, Math.min(1, ratio)) * innerWidth;
}

function buildLinePath(
  points: ScoreHistoryPoint[],
  start: string,
  end: string,
  innerWidth: number,
  innerHeight: number,
): string {
  if (!points.length) return '';
  return points
    .map((p, i) => {
      const x = dateToX(p.date, start, end, innerWidth);
      const y = scoreToY(p.score, innerHeight);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function buildTrendPath(
  points: ScoreHistoryPoint[],
  start: string,
  end: string,
  innerWidth: number,
  innerHeight: number,
): string | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += points[i].score;
    sumXY += i * points[i].score;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const x1 = PAD_LEFT;
  const x2 = PAD_LEFT + innerWidth;
  const y1 = scoreToY(intercept, innerHeight);
  const y2 = scoreToY(intercept + slope * (n - 1), innerHeight);
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

export function ScoreHistoryChart({
  width,
  points,
  threshold,
  trendLabel,
  periodStart,
  periodEnd,
}: Props) {
  const innerWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const linePath = useMemo(
    () => buildLinePath(points, periodStart, periodEnd, innerWidth, innerHeight),
    [points, periodStart, periodEnd, innerWidth, innerHeight],
  );

  const trendPath = useMemo(
    () => buildTrendPath(points, periodStart, periodEnd, innerWidth, innerHeight),
    [points, periodStart, periodEnd, innerWidth, innerHeight],
  );

  const thresholdY =
    threshold != null ? scoreToY(threshold.value, innerHeight) : null;

  const xLabels = useMemo(() => {
    if (points.length === 0) {
      return [
        { x: PAD_LEFT, label: formatScoreHistoryDate(periodStart) },
        { x: PAD_LEFT + innerWidth, label: formatScoreHistoryDate(periodEnd) },
      ];
    }
    const first = points[0].date;
    const last = points[points.length - 1].date;
    return [
      { x: dateToX(first, periodStart, periodEnd, innerWidth), label: formatScoreHistoryDate(first) },
      { x: dateToX(last, periodStart, periodEnd, innerWidth), label: formatScoreHistoryDate(last) },
    ];
  }, [points, periodStart, periodEnd, innerWidth]);

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={CHART_HEIGHT}>
        {[0, 50, 100].map((tick) => {
          const y = scoreToY(tick, innerHeight);
          return (
            <Line
              key={tick}
              x1={PAD_LEFT}
              y1={y}
              x2={PAD_LEFT + innerWidth}
              y2={y}
              stroke={progressPalette.grid}
              strokeWidth={1}
              strokeDasharray={tick === 50 ? '4 4' : undefined}
              opacity={0.55}
            />
          );
        })}

        {thresholdY != null && threshold ? (
          <>
            <Line
              x1={PAD_LEFT}
              y1={thresholdY}
              x2={PAD_LEFT + innerWidth}
              y2={thresholdY}
              stroke={progressPalette.muted}
              strokeWidth={1}
              strokeDasharray="6 4"
              opacity={0.7}
            />
            <SvgText
              x={PAD_LEFT + innerWidth - 2}
              y={thresholdY - 4}
              fill={progressPalette.muted}
              fontSize={9}
              fontWeight="600"
              textAnchor="end">
              {threshold.value}% · {threshold.label}
            </SvgText>
          </>
        ) : null}

        {trendPath ? (
          <Path d={trendPath} stroke={progressPalette.muted} strokeWidth={1.5} opacity={0.35} />
        ) : null}

        {linePath ? (
          <Path
            d={linePath}
            stroke={progressPalette.accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.map((p, idx) => {
          const x = dateToX(p.date, periodStart, periodEnd, innerWidth);
          const y = scoreToY(p.score, innerHeight);
          return (
            <Circle
              key={`${p.date}-${idx}`}
              cx={x}
              cy={y}
              r={p.isPersonalBest ? 5 : 4}
              fill={progressPalette.accent}
              stroke={p.isPersonalBest ? '#FBBF24' : progressPalette.background}
              strokeWidth={p.isPersonalBest ? 2 : 1.5}
            />
          );
        })}

        {xLabels.map((item, idx) => (
          <SvgText
            key={`${item.label}-${idx}`}
            x={item.x}
            y={CHART_HEIGHT - 4}
            fill={progressPalette.muted}
            fontSize={9}
            fontWeight="600"
            textAnchor={idx === 0 ? 'start' : 'end'}>
            {item.label}
          </SvgText>
        ))}

        <SvgText x={4} y={PAD_TOP + 4} fill={progressPalette.muted} fontSize={9} fontWeight="600">
          100
        </SvgText>
        <SvgText x={8} y={PAD_TOP + innerHeight / 2} fill={progressPalette.muted} fontSize={9} fontWeight="600">
          50
        </SvgText>
        <SvgText x={12} y={PAD_TOP + innerHeight} fill={progressPalette.muted} fontSize={9} fontWeight="600">
          0
        </SvgText>
      </Svg>

      <Text style={styles.trend}>{trendLabel}</Text>
      {points.some((p) => p.isPersonalBest) ? (
        <Text style={styles.legend}>⭐ Personal best in period</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  trend: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
    textAlign: 'center',
  },
  legend: {
    fontSize: 11,
    fontWeight: '600',
    color: progressPalette.muted,
    textAlign: 'center',
  },
});
