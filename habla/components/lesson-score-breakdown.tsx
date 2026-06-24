import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { scoreBarColor } from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
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
  amber: '#FBBF24',
  red: '#F87171',
  grey: '#3D4654',
};

export type WeekChartDay = {
  date: string;
  dayLabel: string;
  score: number | null;
};

type Props = {
  visible: boolean;
  title: string;
  entry: LessonHistoryEntry | null;
  onClose: () => void;
  weekChart?: WeekChartDay[];
  showPracticeButton?: boolean;
};

export function LessonScoreBreakdownModal({
  visible,
  title,
  entry,
  onClose,
  weekChart,
  showPracticeButton = false,
}: Props) {
  const router = useRouter();
  const overall = entry?.overallScore ?? null;
  const breakdown = entry?.breakdown;

  useEffect(() => {
    if (!visible) return;
    console.log(`[Habla] Breakdown modal opened — "${title}":`, JSON.stringify(entry, null, 2));
  }, [visible, title, entry]);

  const goPractice = () => {
    onClose();
    router.push('/practice');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      transparent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!entry ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No lesson data yet. Complete a lesson to see your breakdown.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.overallScore}>{overall}%</Text>
              {entry.lessonType ? (
                <Text style={styles.lessonType}>{entry.lessonType} lesson</Text>
              ) : null}

              {breakdown ? (
                <View style={styles.barsRow}>
                  <BreakdownBar label="Grammar" section={breakdown.grammar} showTopic />
                  <BreakdownBar label="Vocabulary" section={breakdown.vocabulary} showTopic />
                  <BreakdownBar label="Fluency" section={breakdown.fluency} />
                  <BreakdownBar label="Writing" section={breakdown.writing} />
                </View>
              ) : null}

              {weekChart?.length ? (
                <View style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>This week</Text>
                  <View style={styles.chartRow}>
                    {weekChart.map((day) => (
                      <View key={day.date} style={styles.chartCol}>
                        <View style={styles.chartBarTrack}>
                          <View
                            style={[
                              styles.chartBarFill,
                              {
                                height: day.score != null ? `${Math.max(8, day.score)}%` : '8%',
                                backgroundColor:
                                  day.score != null ? scoreBarColor(day.score) : palette.grey,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartDay}>{day.dayLabel}</Text>
                        <Text style={styles.chartScore}>
                          {day.score != null ? `${day.score}%` : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {entry.weakAreas.length ? (
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Weak areas</Text>
                  {entry.weakAreas.map((w, i) => (
                    <Text key={`w-${i}`} style={styles.listItem}>
                      • {w}
                    </Text>
                  ))}
                </View>
              ) : null}

              {entry.focusAreas.length ? (
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Focus areas</Text>
                  {entry.focusAreas.map((f, i) => (
                    <Text key={`f-${i}`} style={styles.listItem}>
                      • {f}
                    </Text>
                  ))}
                </View>
              ) : null}

              {showPracticeButton ? (
                <Pressable
                  onPress={goPractice}
                  style={({ pressed }) => [styles.practiceButton, pressed && styles.practiceButtonPressed]}>
                  <Text style={styles.practiceButtonText}>Practice weak areas</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function BreakdownBar({
  label,
  section,
  showTopic = false,
}: {
  label: string;
  section: { score: number; topic?: string; details: string[] };
  showTopic?: boolean;
}) {
  const color = scoreBarColor(section.score);
  return (
    <View style={styles.barCol}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={[styles.barPct, { color }]}>{section.score}%</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${section.score}%`, backgroundColor: color }]} />
      </View>
      {showTopic && section.topic ? (
        <Text style={styles.barTopic} numberOfLines={2}>
          {section.topic}
        </Text>
      ) : null}
      {section.details.slice(0, 2).map((d, i) => (
        <Text key={`${label}-d-${i}`} style={styles.barDetail} numberOfLines={2}>
          {d}
        </Text>
      ))}
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
  headerTitle: { fontSize: 18, fontWeight: '900', color: palette.text },
  closeButton: { fontSize: 22, fontWeight: '700', color: palette.muted, padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 20,
    marginTop: 20,
  },
  emptyText: { fontSize: 15, fontWeight: '600', color: palette.muted, lineHeight: 22 },
  overallScore: {
    fontSize: 64,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    letterSpacing: -2,
    marginTop: 8,
  },
  lessonType: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  barCol: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 10,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  barPct: { fontSize: 18, fontWeight: '900', marginBottom: 6 },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: { height: 6, borderRadius: 999 },
  barTopic: { fontSize: 10, fontWeight: '800', color: palette.text, marginBottom: 4, lineHeight: 13 },
  barDetail: { fontSize: 9, fontWeight: '600', color: palette.muted, lineHeight: 12, marginBottom: 2 },
  chartCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    height: 140,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  chartBarTrack: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(61, 70, 84, 0.35)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  chartBarFill: { width: '100%', borderRadius: 8, minHeight: 4 },
  chartDay: { fontSize: 11, fontWeight: '800', color: palette.muted },
  chartScore: { fontSize: 9, fontWeight: '700', color: palette.muted, marginTop: 2 },
  listCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  listItem: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20, marginBottom: 6 },
  practiceButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  practiceButtonPressed: { opacity: 0.92 },
  practiceButtonText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
});
