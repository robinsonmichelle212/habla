import { chartKitConfig, progressPalette } from '@/components/progress/chart-theme';
import type { StreakBar } from '@/lib/progress-data';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

export function StreakHistoryChart({ bars }: { bars: StreakBar[] }) {
  if (!bars.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Complete sessions to build streak history</Text>
      </View>
    );
  }

  const chartWidth = Dimensions.get('window').width - 72;
  const displayBars = bars.slice(-8);
  const data = {
    labels: displayBars.map((b) => b.label),
    datasets: [
      {
        data: displayBars.map((b) => Math.max(1, b.length)),
        colors: displayBars.map((b) => () =>
          b.isCurrent ? progressPalette.accent : b.isLongest ? '#FBBF24' : 'rgba(255, 122, 89, 0.55)',
        ),
      },
    ],
  };

  return (
    <View>
      <BarChart
        data={data}
        width={chartWidth}
        height={200}
        yAxisLabel=""
        yAxisSuffix="d"
        chartConfig={{
          ...chartKitConfig,
          color: (opacity = 1) => `rgba(255, 122, 89, ${opacity})`,
        }}
        style={styles.chart}
        fromZero
        showValuesOnTopOfBars
        withCustomBarColorFromData
        flatColor
      />
      <View style={styles.legendRow}>
        <Text style={styles.legendItem}>🔥 Longest streak</Text>
        <Text style={styles.legendItem}>Coral = current streak</Text>
      </View>
      {displayBars.some((b) => b.isLongest) ? (
        <Text style={styles.longestNote}>
          Longest: {Math.max(...bars.map((b) => b.length))} days 🔥
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: progressPalette.muted },
  chart: { borderRadius: 12, marginLeft: -8 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  longestNote: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FBBF24',
    marginTop: 6,
  },
});
