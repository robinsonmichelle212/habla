import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { scoreBarColor } from '@/lib/practice-storage';
import type { SkillTabInsights } from '@/lib/skill-tab-insights';
import {
  materializeBreakdownSkillTabs,
  resolveFluencyInsights,
  resolveGrammarInsights,
  resolveVocabularyInsights,
  resolveWritingInsights,
} from '@/lib/skill-tab-insights';
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
  green: '#34D399',
  amber: '#FBBF24',
  blue: '#60A5FA',
};

export type ScoreDetailTab = 'grammar' | 'vocabulary' | 'fluency' | 'writing';

type Props = {
  visible: boolean;
  tab: ScoreDetailTab | null;
  entry: LessonHistoryEntry;
  onClose: () => void;
};

export function ScoreDetailModal({ visible, tab, entry, onClose }: Props) {
  if (!tab) return null;

  const breakdown = materializeBreakdownSkillTabs(entry.breakdown, {
    weakAreas: entry.weakAreas,
    focusAreas: entry.focusAreas,
  });
  const titles: Record<ScoreDetailTab, string> = {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    fluency: 'Fluency',
    writing: 'Writing',
  };

  const tabConfig: Record<
    ScoreDetailTab,
    { score: number; insights: SkillTabInsights }
  > = {
    grammar: { score: breakdown.grammar.score, insights: resolveGrammarInsights(breakdown.grammar) },
    vocabulary: {
      score: breakdown.vocabulary.score,
      insights: resolveVocabularyInsights(breakdown.vocabulary),
    },
    fluency: { score: breakdown.fluency.score, insights: resolveFluencyInsights(breakdown.fluency) },
    writing: { score: breakdown.writing.score, insights: resolveWritingInsights(breakdown.writing) },
  };

  const { score, insights } = tabConfig[tab];
  const rawSection = entry.breakdown?.[tab] as
    | { didWell?: unknown; workOn?: unknown; focusThisWeek?: unknown }
    | undefined;
  const displayedInsights: SkillTabInsights = {
    didWell:
      Array.isArray(rawSection?.didWell) && rawSection.didWell.length > 0 ? insights.didWell : [],
    workOn:
      Array.isArray(rawSection?.workOn) && rawSection.workOn.length > 0 ? insights.workOn : [],
    focusThisWeek:
      Array.isArray(rawSection?.focusThisWeek) && rawSection.focusThisWeek.length > 0
        ? insights.focusThisWeek
        : [],
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
          <Text style={styles.headerTitle}>{titles[tab]}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkillTabDetail score={score} insights={displayedInsights} tab={tab} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SkillTabDetail({
  score,
  insights,
  tab,
}: {
  score: number;
  insights: SkillTabInsights;
  tab: ScoreDetailTab;
}) {
  const emptyFallback = `Complete a full lesson to see ${tab} analysis.`;
  return (
    <>
      <View style={styles.scoreHeader}>
        <Text style={[styles.scoreBig, { color: scoreBarColor(score) }]}>{score}%</Text>
      </View>

      <InsightSection
        label="What you did well ✅"
        color={palette.green}
        items={insights.didWell}
        emptyFallback={emptyFallback}
      />
      <InsightSection
        label="What to work on ⚠️"
        color={palette.amber}
        items={insights.workOn}
        emptyFallback={emptyFallback}
      />
      <InsightSection
        label="Focus this week 🎯"
        color={palette.blue}
        items={insights.focusThisWeek}
        emptyFallback={emptyFallback}
      />
    </>
  );
}

function InsightSection({
  label,
  color,
  items,
  emptyFallback,
}: {
  label: string;
  color: string;
  items: string[];
  emptyFallback: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      <View style={styles.sectionCard}>
        {items.length > 0 ? (
          items.map((item, idx) => (
            <Text key={`${label}-${idx}`} style={styles.bullet}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyLine}>{emptyFallback}</Text>
        )}
      </View>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  scoreHeader: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
  scoreBig: { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 22,
  },
  emptyLine: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
