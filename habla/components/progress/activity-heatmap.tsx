import { progressPalette } from '@/components/progress/chart-theme';
import { formatProgressDate, type ActivityLevel, type HeatmapWeek } from '@/lib/progress-data';
import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL = 14;
const CELL_GAP = 3;

function activityColor(level: ActivityLevel): string {
  switch (level) {
    case 'both':
      return progressPalette.heatmapBoth;
    case 'lesson':
      return progressPalette.heatmapLesson;
    case 'drill':
      return progressPalette.heatmapDrill;
    default:
      return progressPalette.heatmapNone;
  }
}

export function ActivityHeatmap({ weeks }: { weeks: HeatmapWeek[] }) {
  const scrollRef = useRef<ScrollView>(null);

  if (!weeks.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No activity recorded yet</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        <View style={styles.gridWrap}>
          <View style={styles.dayLabelsCol}>
            <View style={{ height: CELL + 4 }} />
            {DAY_LABELS.map((label, i) => (
              <Text key={`day-${i}`} style={styles.dayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((week) => (
            <View key={week.weekStart} style={styles.weekCol}>
              <Text style={styles.weekLabel}>{formatProgressDate(week.weekStart)}</Text>
              {week.days.map((day) => (
                <View
                  key={day.date}
                  style={[styles.cell, { backgroundColor: activityColor(day.activity) }]}
                  accessibilityLabel={`${day.date}: ${day.activity}`}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <LegendSwatch color={progressPalette.heatmapNone} label="None" />
        <LegendSwatch color={progressPalette.heatmapDrill} label="Drill" />
        <LegendSwatch color={progressPalette.heatmapLesson} label="Lesson" />
        <LegendSwatch color={progressPalette.heatmapBoth} label="Both" />
      </View>
      <Text style={styles.hint}>Scroll left for older weeks · brighter = more activity</Text>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendCell, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: progressPalette.muted },
  scrollContent: { paddingRight: 8 },
  gridWrap: { flexDirection: 'row', gap: CELL_GAP },
  dayLabelsCol: { gap: CELL_GAP, marginRight: 4 },
  dayLabel: {
    height: CELL,
    lineHeight: CELL,
    fontSize: 10,
    fontWeight: '700',
    color: progressPalette.muted,
    width: 14,
    textAlign: 'center',
  },
  weekCol: { gap: CELL_GAP, alignItems: 'center' },
  weekLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: progressPalette.muted,
    height: CELL + 4,
    textAlign: 'center',
    width: CELL * 2,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 11, fontWeight: '700', color: progressPalette.muted },
  hint: {
    fontSize: 11,
    fontWeight: '600',
    color: progressPalette.muted,
    marginTop: 8,
  },
});
