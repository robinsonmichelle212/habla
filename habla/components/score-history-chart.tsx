import type { SkillKey, SkillSeries, SkillStat } from '@/lib/score-history';
import { formatScoreHistoryDate, parseDateKey } from '@/lib/score-history';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const CHART_HEIGHT = 168;
const PAD_LEFT = 28;
const PAD_RIGHT = 12;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;

type Props = {
  width: number;
  series: SkillSeries[];
  skills: Record<SkillKey, SkillStat>;
  periodStart: string;
  periodEnd: string;
};

type TooltipState = {
  skill: SkillKey;
  score: number;
  date: string;
  x: number;
  y: number;
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
  points: { date: string; score: number }[],
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

export function ScoreHistoryChart({ width, series, skills, periodStart, periodEnd }: Props) {
  const innerWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const [visible, setVisible] = useState<Record<SkillKey, boolean>>({
    grammar: true,
    vocabulary: true,
    fluency: true,
    writing: true,
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const xLabels = useMemo(() => {
    const allDates = series.flatMap((s) => s.points.map((p) => p.date)).sort();
    if (!allDates.length) {
      return [
        { x: PAD_LEFT, label: formatScoreHistoryDate(periodStart) },
        { x: PAD_LEFT + innerWidth, label: formatScoreHistoryDate(periodEnd) },
      ];
    }
    const first = allDates[0];
    const last = allDates[allDates.length - 1];
    return [
      {
        x: dateToX(first, periodStart, periodEnd, innerWidth),
        label: formatScoreHistoryDate(first),
      },
      {
        x: dateToX(last, periodStart, periodEnd, innerWidth),
        label: formatScoreHistoryDate(last),
      },
    ];
  }, [series, periodStart, periodEnd, innerWidth]);

  const toggleSkill = (skill: SkillKey) => {
    setVisible((prev) => ({ ...prev, [skill]: !prev[skill] }));
    setTooltip(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chartArea}>
        {tooltip ? (
          <View
            style={[
              styles.tooltip,
              {
                left: Math.max(4, Math.min(width - 120, tooltip.x - 58)),
                top: Math.max(0, tooltip.y - 36),
              },
            ]}>
            <Text style={styles.tooltipScore}>{tooltip.score}%</Text>
            <Text style={styles.tooltipDate}>{formatScoreHistoryDate(tooltip.date)}</Text>
          </View>
        ) : null}

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
                stroke="#252D3A"
                strokeWidth={1}
                strokeDasharray={tick === 50 ? '4 4' : undefined}
                opacity={0.55}
              />
            );
          })}

          {series.map((line) => {
            if (!visible[line.skill] || !line.points.length) return null;
            const path = buildLinePath(
              line.points,
              periodStart,
              periodEnd,
              innerWidth,
              innerHeight,
            );
            return (
              <Path
                key={`line-${line.skill}`}
                d={path}
                stroke={line.color}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {series.map((line) => {
            if (!visible[line.skill]) return null;
            return line.points.map((p, idx) => {
              const x = dateToX(p.date, periodStart, periodEnd, innerWidth);
              const y = scoreToY(p.score, innerHeight);
              return (
                <Circle
                  key={`${line.skill}-${p.date}-${idx}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill={line.color}
                  stroke="#0B0F14"
                  strokeWidth={1.5}
                  onPress={() =>
                    setTooltip((current) =>
                      current?.skill === line.skill &&
                      current.date === p.date &&
                      current.score === p.score
                        ? null
                        : { skill: line.skill, score: p.score, date: p.date, x, y },
                    )
                  }
                />
              );
            });
          })}

          {xLabels.map((item, idx) => (
            <SvgText
              key={`${item.label}-${idx}`}
              x={item.x}
              y={CHART_HEIGHT - 4}
              fill="#8B95A5"
              fontSize={9}
              fontWeight="600"
              textAnchor={idx === 0 ? 'start' : 'end'}>
              {item.label}
            </SvgText>
          ))}

          <SvgText x={4} y={PAD_TOP + 4} fill="#8B95A5" fontSize={9} fontWeight="600">
            100
          </SvgText>
          <SvgText x={8} y={PAD_TOP + innerHeight / 2} fill="#8B95A5" fontSize={9} fontWeight="600">
            50
          </SvgText>
          <SvgText x={12} y={PAD_TOP + innerHeight} fill="#8B95A5" fontSize={9} fontWeight="600">
            0
          </SvgText>
        </Svg>
      </View>

      <View style={styles.legendRow}>
        {series.map((line) => {
          const isVisible = visible[line.skill];
          const trend = skills[line.skill].trendArrow;

          return (
            <Pressable
              key={line.skill}
              onPress={() => toggleSkill(line.skill)}
              style={[styles.legendItem, !isVisible && styles.legendItemHidden]}
              accessibilityRole="button"
              accessibilityState={{ selected: isVisible }}>
              <Text style={[styles.legendDot, { color: line.color }]}>●</Text>
              <Text style={[styles.legendLabel, !isVisible && styles.legendLabelHidden]}>
                {line.label} {line.points.length ? trend : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chartArea: { position: 'relative' },
  tooltip: {
    position: 'absolute',
    zIndex: 2,
    backgroundColor: '#151B24',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#252D3A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  tooltipScore: { fontSize: 14, fontWeight: '900', color: '#F4F6F8' },
  tooltipDate: { fontSize: 11, fontWeight: '600', color: '#8B95A5', marginTop: 2 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 27, 36, 0.6)',
  },
  legendItemHidden: { opacity: 0.45 },
  legendDot: { fontSize: 12, fontWeight: '900' },
  legendLabel: { fontSize: 12, fontWeight: '700', color: '#F4F6F8' },
  legendLabelHidden: { color: '#8B95A5' },
});
