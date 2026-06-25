import type { SpanishWrappedReport } from '@/lib/wrapped-data';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const palette = {
  background: '#0B0F14',
  accent: '#FF7A59',
  text: '#F4F6F8',
  muted: '#8B95A5',
  gem: '#A78BFA',
};

type Props = {
  report: SpanishWrappedReport;
};

export const WrappedShareCard = forwardRef<View, Props>(function WrappedShareCard({ report }, ref) {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <Text style={styles.brand}>Habla 🇪🇸</Text>
      <Text style={styles.headline}>I&apos;ve been learning Spanish with Habla</Text>
      <Text style={styles.month}>{report.monthLabel}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{report.totalLessons}</Text>
          <Text style={styles.statLabel}>lessons</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {report.improvementPercent > 0 ? `+${report.improvementPercent}%` : `${report.averageScoreEnd}%`}
          </Text>
          <Text style={styles.statLabel}>improvement</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{report.longestStreakThisMonth}</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
      </View>

      <Text style={styles.level}>{report.levelAtEnd}</Text>
      <Text style={styles.cta}>Download Habla — learn Spanish with Javi</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: palette.background,
    borderRadius: 24,
    padding: 28,
    borderWidth: 2,
    borderColor: palette.accent,
    gap: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.accent,
    letterSpacing: 1,
  },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 28,
  },
  month: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.muted,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
  },
  level: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.gem,
    textAlign: 'center',
    marginTop: 4,
  },
  cta: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
