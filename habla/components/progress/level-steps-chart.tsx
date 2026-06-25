import { progressPalette } from '@/components/progress/chart-theme';
import { LEVEL_BANDS } from '@/lib/level-progress';
import { formatProgressDate, levelBandShortLabel, type LevelStep } from '@/lib/progress-data';
import { StyleSheet, Text, View } from 'react-native';

export function LevelStepsChart({ steps, currentBandIndex }: { steps: LevelStep[]; currentBandIndex: number }) {
  if (!steps.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Complete lessons to track level progression</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {LEVEL_BANDS.map((band, index) => {
        const milestone = steps.find((s) => s.bandIndex === index);
        const isCurrent = index === currentBandIndex;
        const isReached = index <= currentBandIndex;
        const isFuture = index > currentBandIndex;

        return (
          <View key={band.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.stepDot,
                  isReached && styles.stepDotReached,
                  isCurrent && styles.stepDotCurrent,
                  isFuture && styles.stepDotFuture,
                ]}
              />
              {index < LEVEL_BANDS.length - 1 ? (
                <View style={[styles.connector, isReached && index < currentBandIndex && styles.connectorReached]} />
              ) : null}
            </View>

            <View style={[styles.stepCard, isCurrent && styles.stepCardCurrent]}>
              <View style={styles.stepHeader}>
                <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>{band.label}</Text>
                {isCurrent ? <Text style={styles.currentBadge}>Current</Text> : null}
              </View>
              {milestone ? (
                <Text style={styles.stepDate}>Reached {formatProgressDate(milestone.date)}</Text>
              ) : isFuture ? (
                <Text style={styles.stepPending}>Not yet reached</Text>
              ) : (
                <Text style={styles.stepDate}>Before tracked history</Text>
              )}
              <Text style={styles.stepRange}>
                {band.min}% – {band.max === 100 ? '100' : band.max}% avg · {levelBandShortLabel(band.label)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: progressPalette.muted,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: progressPalette.surfaceBorder,
    backgroundColor: progressPalette.background,
  },
  stepDotReached: {
    borderColor: progressPalette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.35)',
  },
  stepDotCurrent: {
    borderColor: progressPalette.accent,
    backgroundColor: progressPalette.accent,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepDotFuture: {
    opacity: 0.5,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: progressPalette.surfaceBorder,
    marginVertical: 2,
  },
  connectorReached: {
    backgroundColor: 'rgba(255, 122, 89, 0.5)',
  },
  stepCard: {
    flex: 1,
    backgroundColor: progressPalette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 12,
    marginBottom: 8,
  },
  stepCardCurrent: {
    borderColor: progressPalette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: progressPalette.text,
  },
  stepLabelCurrent: {
    color: progressPalette.accent,
  },
  currentBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: progressPalette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepDate: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    marginTop: 4,
  },
  stepPending: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  stepRange: {
    fontSize: 12,
    fontWeight: '600',
    color: progressPalette.muted,
    marginTop: 2,
  },
});
