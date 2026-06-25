import { progressPalette } from '@/components/progress/chart-theme';
import { formatProgressDate, type ProgressSummary } from '@/lib/progress-data';
import { StyleSheet, Text, View } from 'react-native';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export function ProgressSummaryHeader({ summary }: { summary: ProgressSummary }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your journey</Text>
      <View style={styles.grid}>
        <StatTile label="Total sessions" value={String(summary.totalSessions)} />
        <StatTile
          label="Average score"
          value={summary.averageScore != null ? `${summary.averageScore}%` : '—'}
        />
        <StatTile
          label="Personal best"
          value={summary.personalBest != null ? `${summary.personalBest}% ⭐` : '—'}
        />
        <StatTile label="Current streak" value={`${summary.currentStreak} days`} />
        <StatTile label="Longest streak" value={`${summary.longestStreak} days`} />
        <StatTile
          label="Days learning"
          value={summary.daysSinceFirstLesson != null ? String(summary.daysSinceFirstLesson) : '—'}
        />
      </View>
      {summary.estimatedLevelUpDate ? (
        <Text style={styles.estimate}>
          Estimated level up: {formatProgressDate(summary.estimatedLevelUpDate)} (at current pace)
        </Text>
      ) : (
        <Text style={styles.estimateMuted}>
          Keep completing lessons to estimate your next level-up date
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: progressPalette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '47%',
    backgroundColor: progressPalette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 12,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  estimate: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: progressPalette.accent,
    lineHeight: 20,
  },
  estimateMuted: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    lineHeight: 18,
  },
});
