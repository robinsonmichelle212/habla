import { progressPalette } from '@/components/progress/chart-theme';
import type { ProgressDateRange } from '@/lib/progress-data';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const OPTIONS: { id: ProgressDateRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

export function DateRangeToggle({
  value,
  onChange,
}: {
  value: ProgressDateRange;
  onChange: (range: ProgressDateRange) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: progressPalette.background,
  },
  chipActive: {
    borderColor: progressPalette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.15)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: progressPalette.muted,
  },
  chipTextActive: {
    color: progressPalette.accent,
  },
});
