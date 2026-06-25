import type { DrillHistoryEntry, LessonHistoryEntry, WeekChartDay } from '@/lib/practice-storage';
import {
  getCoveredGrammarTopics,
  getCoveredVocabThemes,
  getLessonHistory,
  getPreviousLessonEntry,
  scoreBarColor,
} from '@/lib/practice-storage';
import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';
import { getCurrentGrammarTopic, type GrammarTopic } from '@/lib/lesson-focus';
import { ScoreDetailModal, type ScoreDetailTab } from '@/components/score-detail-modals';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export type { WeekChartDay };

type Props = {
  visible: boolean;
  title: string;
  entry: LessonHistoryEntry | null;
  drillEntry?: DrillHistoryEntry | null;
  displayScore?: number | null;
  onClose: () => void;
  weekChart?: WeekChartDay[];
  showPracticeButton?: boolean;
  enableScoreDetails?: boolean;
};

export function LessonScoreBreakdownModal({
  visible,
  title,
  entry,
  drillEntry = null,
  displayScore = null,
  onClose,
  weekChart,
  showPracticeButton = false,
  enableScoreDetails = false,
}: Props) {
  const router = useRouter();
  const [detailTab, setDetailTab] = useState<ScoreDetailTab | null>(null);
  const [currentGrammarTopic, setCurrentGrammarTopic] = useState<GrammarTopic | null>(null);
  const [curriculumWeek, setCurriculumWeek] = useState<number | null>(null);
  const [coveredGrammarTopics, setCoveredGrammarTopics] = useState<string[]>([]);
  const [coveredVocabThemes, setCoveredVocabThemes] = useState<string[]>([]);
  const [previousFluencyScore, setPreviousFluencyScore] = useState<number | null>(null);
  const overall =
    displayScore ??
    entry?.overallScore ??
    drillEntry?.percentage ??
    null;
  const breakdown = entry?.breakdown;
  const isPracticeOnly = !entry && !!drillEntry;

  useEffect(() => {
    if (!visible) return;
    console.log(`[Habla] Breakdown modal opened — "${title}":`, JSON.stringify(entry, null, 2));
  }, [visible, title, entry]);

  useEffect(() => {
    if (!visible || !enableScoreDetails || !entry) return;
    let cancelled = false;

    void (async () => {
      const [grammarTopic, curriculum, history] = await Promise.all([
        getCurrentGrammarTopic(),
        resolveGrammarCurriculum(),
        getLessonHistory(),
      ]);
      if (cancelled) return;
      setCurrentGrammarTopic(grammarTopic);
      setCurriculumWeek(curriculum.currentWeek);
      setCoveredGrammarTopics(getCoveredGrammarTopics(history));
      setCoveredVocabThemes(getCoveredVocabThemes(history));
      const prev = getPreviousLessonEntry(history, entry.date);
      setPreviousFluencyScore(prev ? prev.breakdown.fluency.score : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, enableScoreDetails, entry]);

  useEffect(() => {
    if (!visible) setDetailTab(null);
  }, [visible]);

  const goPractice = () => {
    onClose();
    router.push('/practice');
  };

  return (
    <>
    <Modal
      visible={visible && detailTab == null}
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
          {!entry && !drillEntry ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No lesson data yet. Complete a lesson to see your breakdown.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.overallScore}>{overall}%</Text>
              {entry?.lessonType ? (
                <Text style={styles.lessonType}>{entry.lessonType} lesson</Text>
              ) : isPracticeOnly ? (
                <Text style={styles.lessonType}>
                  Practice drill · {drillEntry?.score}/{drillEntry?.totalQuestions}
                </Text>
              ) : null}

              {breakdown ? (
                <View style={styles.barsRow}>
                  <BreakdownBar
                    label="Grammar"
                    section={breakdown.grammar}
                    showTopic
                    tappable={enableScoreDetails && !!entry}
                    onPress={() => setDetailTab('grammar')}
                  />
                  <BreakdownBar
                    label="Vocabulary"
                    section={breakdown.vocabulary}
                    showTopic
                    tappable={enableScoreDetails && !!entry}
                    onPress={() => setDetailTab('vocabulary')}
                  />
                  <BreakdownBar
                    label="Fluency"
                    section={breakdown.fluency}
                    tappable={enableScoreDetails && !!entry}
                    onPress={() => setDetailTab('fluency')}
                  />
                  <BreakdownBar
                    label="Writing"
                    section={breakdown.writing}
                    tappable={enableScoreDetails && !!entry}
                    onPress={() => setDetailTab('writing')}
                  />
                  {breakdown.structure ? (
                    <BreakdownBar
                      label="Structure"
                      section={breakdown.structure}
                      showTopic
                      tappable={false}
                    />
                  ) : null}
                </View>
              ) : null}

              {weekChart?.length ? (
                <View style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>This week</Text>
                  <View style={styles.chartLegend}>
                    <Text style={styles.legendItem}>■ Lesson</Text>
                    <Text style={styles.legendItem}>□ Practice only</Text>
                  </View>
                  <View style={styles.chartRow}>
                    {weekChart.map((day) => {
                      const hasScore = day.score != null;
                      const barColor = hasScore ? scoreBarColor(day.score!) : palette.grey;
                      const isDrillOnly = day.activityType === 'drill';
                      return (
                        <View key={day.date} style={styles.chartCol}>
                          <View style={styles.chartBarTrack}>
                            <View
                              style={[
                                styles.chartBarFill,
                                {
                                  height: hasScore ? `${Math.max(8, day.score!)}%` : '8%',
                                  backgroundColor: barColor,
                                  opacity: isDrillOnly ? 0.45 : 1,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.chartDay}>{day.dayLabel}</Text>
                          <Text style={styles.chartScore}>
                            {hasScore ? `${day.score}%` : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {drillEntry?.weakAreasDrilled.length ? (
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Areas drilled</Text>
                  {drillEntry.weakAreasDrilled.map((w, i) => (
                    <Text key={`d-${i}`} style={styles.listItem}>
                      • {w}
                    </Text>
                  ))}
                  {drillEntry.gemsEarned > 0 ? (
                    <Text style={styles.gemNote}>💎 +{drillEntry.gemsEarned} gems earned</Text>
                  ) : null}
                </View>
              ) : null}

              {entry?.weakAreas.length ? (
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Weak areas</Text>
                  {entry.weakAreas.map((w, i) => (
                    <Text key={`w-${i}`} style={styles.listItem}>
                      • {w}
                    </Text>
                  ))}
                </View>
              ) : null}

              {entry?.focusAreas.length ? (
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

      {entry && enableScoreDetails ? (
        <ScoreDetailModal
          visible={detailTab != null}
          tab={detailTab}
          entry={entry}
          currentGrammarTopic={currentGrammarTopic}
          curriculumWeek={curriculumWeek}
          coveredGrammarTopics={coveredGrammarTopics}
          coveredVocabThemes={coveredVocabThemes}
          previousFluencyScore={previousFluencyScore}
          onClose={() => setDetailTab(null)}
        />
      ) : null}
    </>
  );
}

function BreakdownBar({
  label,
  section,
  showTopic = false,
  tappable = false,
  onPress,
}: {
  label: string;
  section: { score: number; topic?: string; details: string[] };
  showTopic?: boolean;
  tappable?: boolean;
  onPress?: () => void;
}) {
  const color = scoreBarColor(section.score);
  const inner = (
    <>
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
      {tappable ? <Text style={styles.tapHint}>Tap for details</Text> : null}
    </>
  );

  if (!tappable || !onPress) {
    return <View style={styles.barCol}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.barCol, styles.barColTappable, pressed && styles.barColPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label} score details`}>
      {inner}
    </Pressable>
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
  barColTappable: {
    borderColor: 'rgba(255, 122, 89, 0.35)',
  },
  barColPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
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
  tapHint: {
    fontSize: 8,
    fontWeight: '800',
    color: palette.accent,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
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
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
  },
  gemNote: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A78BFA',
    marginTop: 8,
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
