import { progressPalette } from '@/components/progress/chart-theme';
import { formatProgressDate } from '@/lib/progress-data';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

export type ChartPoint = {
  date: string;
  score: number;
  isPersonalBest?: boolean;
};

type SeriesInput = {
  color: string;
  segments: ChartPoint[][];
  showBest?: boolean;
};

type ProgressLineChartProps = {
  series: SeriesInput[];
  width: number;
  height?: number;
  yMax?: number;
  yMin?: number;
};

const PADDING_LEFT = 36;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;

function buildPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function ProgressLineChart({
  series,
  width,
  height = 220,
  yMax = 100,
  yMin = 0,
}: ProgressLineChartProps) {
  const layout = useMemo(() => {
    const allPoints: ChartPoint[] = [];
    for (const s of series) {
      for (const segment of s.segments) {
        allPoints.push(...segment);
      }
    }

    const uniqueDates = [...new Set(allPoints.map((p) => p.date))].sort();
    const dateToX = new Map<string, number>();
    const innerWidth = width - PADDING_LEFT - PADDING_RIGHT;
    uniqueDates.forEach((date, index) => {
      const x =
        uniqueDates.length <= 1
          ? PADDING_LEFT + innerWidth / 2
          : PADDING_LEFT + (innerWidth * index) / (uniqueDates.length - 1);
      dateToX.set(date, x);
    });

    const yRange = yMax - yMin;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;
    const scoreToY = (score: number) =>
      PADDING_TOP + innerHeight * (1 - (score - yMin) / yRange);

    const yTicks = [0, 25, 50, 75, 100].filter((v) => v >= yMin && v <= yMax);

    const renderedSeries = series.map((s) => ({
      color: s.color,
      showBest: s.showBest ?? false,
      segments: s.segments.map((segment) =>
        segment.map((point) => ({
          ...point,
          x: dateToX.get(point.date) ?? PADDING_LEFT,
          y: scoreToY(point.score),
        })),
      ),
    }));

    const xLabels =
      uniqueDates.length <= 3
        ? uniqueDates
        : [uniqueDates[0], uniqueDates[Math.floor(uniqueDates.length / 2)], uniqueDates.at(-1)!];

    return { renderedSeries, yTicks, scoreToY, xLabels, dateToX, innerHeight };
  }, [series, width, height, yMax, yMin]);

  if (!series.some((s) => s.segments.some((seg) => seg.length > 0))) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No lesson data in this range yet</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {layout.yTicks.map((tick) => {
          const y = layout.scoreToY(tick);
          return (
            <Line
              key={`grid-${tick}`}
              x1={PADDING_LEFT}
              y1={y}
              x2={width - PADDING_RIGHT}
              y2={y}
              stroke={progressPalette.grid}
              strokeWidth={1}
            />
          );
        })}

        {layout.yTicks.map((tick) => {
          const y = layout.scoreToY(tick);
          return (
            <SvgText
              key={`ylabel-${tick}`}
              x={PADDING_LEFT - 6}
              y={y + 4}
              fontSize={10}
              fill={progressPalette.muted}
              textAnchor="end">
              {tick}
            </SvgText>
          );
        })}

        {layout.renderedSeries.map((s, seriesIndex) =>
          s.segments.map((segment, segIndex) => {
            const path = buildPath(segment);
            return (
              <Path
                key={`path-${seriesIndex}-${segIndex}`}
                d={path}
                stroke={s.color}
                strokeWidth={2.5}
                fill="none"
              />
            );
          }),
        )}

        {layout.renderedSeries.map((s, seriesIndex) =>
          s.segments.flatMap((segment, segIndex) =>
            segment.map((point, pointIndex) => (
              <Circle
                key={`dot-${seriesIndex}-${segIndex}-${pointIndex}`}
                cx={point.x}
                cy={point.y}
                r={s.showBest && point.isPersonalBest ? 6 : 4}
                fill={s.showBest && point.isPersonalBest ? '#FBBF24' : s.color}
                stroke={progressPalette.background}
                strokeWidth={1.5}
              />
            )),
          ),
        )}

        {layout.xLabels.map((date) => {
          const x = layout.dateToX.get(date) ?? PADDING_LEFT;
          return (
            <SvgText
              key={`xlabel-${date}`}
              x={x}
              y={height - 8}
              fontSize={10}
              fill={progressPalette.muted}
              textAnchor="middle">
              {formatProgressDate(date)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: progressPalette.surface,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: progressPalette.muted,
  },
});
