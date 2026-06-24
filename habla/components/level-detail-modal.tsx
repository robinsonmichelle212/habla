import {
  buildJaviFocusForNextLevel,
  getBandProgressStatus,
  getLevelDescription,
  type BandProgressStatus,
} from '@/lib/level-descriptions';
import { LEVEL_BANDS, estimateSessionsToReachScore, type LevelBandId, type NextLevelRequirements } from '@/lib/level-progress';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
  locked: '#5A6475',
};

type Props = {
  visible: boolean;
  bandId: LevelBandId | null;
  currentBandIndex: number;
  currentAverage: number;
  history: LessonHistoryEntry[];
  nextRequirements: NextLevelRequirements | null;
  onClose: () => void;
};

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function statusLabel(status: BandProgressStatus): string {
  if (status === 'achieved') return '✅ Achieved';
  if (status === 'current') return '▶ Current level';
  return '🔒 Locked';
}

export function LevelDetailModal({
  visible,
  bandId,
  currentBandIndex,
  currentAverage,
  history,
  nextRequirements,
  onClose,
}: Props) {
  if (!bandId) return null;

  const bandIndex = LEVEL_BANDS.findIndex((b) => b.id === bandId);
  const band = LEVEL_BANDS[bandIndex];
  const description = getLevelDescription(bandId);
  const status = getBandProgressStatus(bandIndex, currentBandIndex);
  const isCurrent = status === 'current';
  const isLocked = status === 'locked';
  const nextBand = bandIndex < LEVEL_BANDS.length - 1 ? LEVEL_BANDS[bandIndex + 1] : null;

  let footerMessage: string | null = null;
  if (isCurrent) {
    footerMessage = 'You are currently here';
  } else if (isLocked && band) {
    const sessions = estimateSessionsToReachScore(currentAverage, band.min, history);
    if (sessions != null && sessions > 0) {
      footerMessage = `About ${sessions} session${sessions === 1 ? '' : 's'} to reach this level`;
    } else {
      const gap = Math.max(0, band.min - currentAverage);
      footerMessage =
        gap > 0
          ? `Reach ${band.min}% average to unlock this level (${gap}% to go)`
          : 'Complete more lessons to estimate your pace';
    }
  }

  const javiFocus =
    isCurrent && nextBand
      ? buildJaviFocusForNextLevel(nextRequirements, nextBand.label)
      : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isCurrent && styles.headerTitleCurrent]}>
            {description.title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusBadge,
              status === 'achieved' && styles.statusAchieved,
              isCurrent && styles.statusCurrent,
              isLocked && styles.statusLocked,
            ]}>
            {statusLabel(status)}
          </Text>
          {band ? (
            <Text style={styles.scoreRange}>
              {band.min}–{band.max === 100 ? '100' : band.max}% avg
            </Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Section title="What you can do">
            <BulletList items={description.whatYouCanDo} />
          </Section>

          <Section title="Grammar at this level">
            <BulletList items={description.grammar} />
          </Section>

          <Section title="Vocabulary range">
            <BulletList items={description.vocabulary} />
          </Section>

          <Section title="Real conversation looks like">
            <BulletList items={description.realConversation} />
          </Section>

          {footerMessage ? (
            <View style={[styles.footerCard, isCurrent && styles.footerCardCurrent]}>
              <Text style={[styles.footerText, isCurrent && styles.footerTextCurrent]}>{footerMessage}</Text>
            </View>
          ) : null}

          {isCurrent && javiFocus.length ? (
            <View style={styles.javiFocusCard}>
              <Text style={styles.javiFocusTitle}>
                What Javi will focus on to get you to the next level
              </Text>
              <BulletList items={javiFocus} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type ProgressionListProps = {
  currentBandIndex: number;
  onSelectBand: (id: LevelBandId) => void;
};

export function LevelProgressionList({ currentBandIndex, onSelectBand }: ProgressionListProps) {
  return (
    <View style={styles.progressionList}>
      {LEVEL_BANDS.map((band, index) => {
        const status = getBandProgressStatus(index, currentBandIndex);
        const isCurrent = status === 'current';
        const isLocked = status === 'locked';
        const isAchieved = status === 'achieved';

        return (
          <Pressable
            key={band.id}
            onPress={() => onSelectBand(band.id)}
            style={({ pressed }) => [
              styles.progressionRow,
              isCurrent && styles.progressionRowCurrent,
              pressed && styles.progressionRowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${band.label} level details`}>
            <Text style={styles.progressionIcon}>
              {isAchieved ? '✅' : isCurrent ? '▶️' : '⬜'}
            </Text>
            <Text
              style={[
                styles.progressionLabel,
                isCurrent && styles.progressionLabelCurrent,
                isLocked && styles.progressionLabelLocked,
              ]}>
              {band.label}
            </Text>
            <Text style={styles.progressionChevron}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: palette.text, flex: 1 },
  headerTitleCurrent: { color: palette.accent },
  closeButton: { fontSize: 22, fontWeight: '700', color: palette.muted, paddingLeft: 12 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: palette.muted,
  },
  statusAchieved: { color: palette.green },
  statusCurrent: { color: palette.accent },
  statusLocked: { color: palette.locked },
  scoreRange: { fontSize: 12, fontWeight: '700', color: palette.muted },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 14, color: palette.accent, lineHeight: 20, width: 12 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22, color: palette.text, fontWeight: '500' },
  footerCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 16,
  },
  footerCardCurrent: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.1)',
  },
  footerText: { fontSize: 15, fontWeight: '700', color: palette.text, textAlign: 'center' },
  footerTextCurrent: { color: palette.accent },
  javiFocusCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 8,
  },
  javiFocusTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 12,
    lineHeight: 20,
  },
  progressionList: { marginTop: 12, gap: 2 },
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 45, 58, 0.6)',
  },
  progressionRowCurrent: {
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
    borderRadius: 10,
    marginHorizontal: -6,
    paddingHorizontal: 12,
  },
  progressionRowPressed: { opacity: 0.85 },
  progressionIcon: { fontSize: 14, width: 24 },
  progressionLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text },
  progressionLabelCurrent: { color: palette.accent },
  progressionLabelLocked: { color: palette.locked },
  progressionChevron: { fontSize: 20, fontWeight: '700', color: palette.muted },
});
