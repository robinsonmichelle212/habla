import { progressPalette } from '@/components/progress/chart-theme';
import { getMilestoneProgress, type MilestoneProgressItem } from '@/lib/milestones';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function MilestoneRow({ item }: { item: MilestoneProgressItem }) {
  const isPersonalBest = item.id === 'personal-best';
  const showAchieved = item.achieved && !isPersonalBest;
  const statusSuffix = showAchieved ? '✅' : isPersonalBest ? '' : '🔒';

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          {item.emoji} {item.name} {statusSuffix}
        </Text>
        {showAchieved && item.achievedDate ? (
          <Text style={styles.achievedDate}>{item.achievedDate}</Text>
        ) : null}
      </View>
      <Text style={styles.progressLabel}>{item.progressLabel}</Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(0, Math.min(100, item.progressPercent))}%`,
              backgroundColor: showAchieved ? '#34D399' : progressPalette.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function MilestonesSection() {
  const [items, setItems] = useState<MilestoneProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getMilestoneProgress().then((data) => {
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Milestones 🌟</Text>
      <Text style={styles.subtitle}>Big moments on your Spanish journey</Text>
      {loading ? (
        <ActivityIndicator color={progressPalette.accent} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <MilestoneRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: progressPalette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: progressPalette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 14,
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: progressPalette.text,
    lineHeight: 20,
  },
  achievedDate: {
    fontSize: 12,
    fontWeight: '700',
    color: progressPalette.muted,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: progressPalette.muted,
    lineHeight: 18,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(139, 149, 165, 0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
