import { LevelProgressionList } from '@/components/level-detail-modal';
import { LEVEL_BANDS, type LevelBand, type LevelBandId } from '@/lib/level-progress';
import type { LevelBarometer } from '@/lib/level-progress';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
  grey: '#3D4654',
};

type Props = {
  barometer: LevelBarometer;
  onSelectBand: (id: LevelBandId) => void;
  hideTitle?: boolean;
  embedded?: boolean;
};

export function LevelBarometerSection({
  barometer,
  onSelectBand,
  hideTitle = false,
  embedded = false,
}: Props) {
  return (
    <View style={embedded ? styles.embeddedSection : styles.section}>
      {!hideTitle ? <Text style={styles.sectionTitle}>Level barometer</Text> : null}
      <View style={styles.card}>
        <Pressable onPress={() => onSelectBand(barometer.band.id)} accessibilityRole="button">
          <Text style={[styles.currentBand, styles.currentBandTappable]}>{barometer.band.label}</Text>
          <Text style={styles.tapHint}>Tap your level for a full description</Text>
        </Pressable>
        <Text style={styles.avgLabel}>
          {barometer.averageScore}% average · last 10 sessions
        </Text>

        <View style={styles.bandRow}>
          {LEVEL_BANDS.map((band, i) => (
            <BandPill
              key={band.id}
              band={band}
              active={i === barometer.bandIndex}
              passed={i < barometer.bandIndex}
              locked={i > barometer.bandIndex}
              onPress={() => onSelectBand(band.id)}
            />
          ))}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${barometer.progressInBand}%` }]} />
        </View>
        <Text style={styles.progressMessage}>{barometer.message}</Text>

        <Text style={styles.progressionHeader}>B1 → B2 progression</Text>
        <LevelProgressionList
          currentBandIndex={barometer.bandIndex}
          onSelectBand={onSelectBand}
        />
      </View>
    </View>
  );
}

function BandPill({
  band,
  active,
  passed,
  locked,
  onPress,
}: {
  band: LevelBand;
  active: boolean;
  passed: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  const short = band.label.replace('B1 ', '').replace('B2 ', 'B2·');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bandPill,
        active && styles.bandPillActive,
        passed && !active && styles.bandPillPassed,
        locked && styles.bandPillLocked,
        pressed && styles.bandPillPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${band.label} level`}>
      <Text
        style={[
          styles.bandPillText,
          active && styles.bandPillTextActive,
          passed && !active && styles.bandPillTextPassed,
          locked && styles.bandPillTextLocked,
        ]}
        numberOfLines={1}>
        {passed ? '✓ ' : ''}
        {short}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  embeddedSection: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  currentBand: { fontSize: 28, fontWeight: '900', color: palette.text, marginBottom: 4 },
  currentBandTappable: { color: palette.accent },
  tapHint: { fontSize: 12, fontWeight: '600', color: palette.muted, marginBottom: 8 },
  avgLabel: { fontSize: 14, fontWeight: '600', color: palette.muted, marginBottom: 16 },
  progressionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 16,
    marginBottom: 4,
  },
  bandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  bandPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  bandPillActive: {
    backgroundColor: 'rgba(255, 122, 89, 0.2)',
    borderColor: palette.accent,
  },
  bandPillPassed: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  bandPillLocked: {
    opacity: 0.45,
  },
  bandPillPressed: {
    opacity: 0.88,
  },
  bandPillText: { fontSize: 10, fontWeight: '800', color: palette.muted },
  bandPillTextActive: { color: palette.accent },
  bandPillTextPassed: { color: palette.green },
  bandPillTextLocked: { color: palette.grey },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
  progressMessage: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
});
