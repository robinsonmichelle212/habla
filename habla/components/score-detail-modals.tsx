import type { ReactNode } from 'react';
import type { GrammarTopic } from '@/lib/grammar-curriculum';
import { TOTAL_CURRICULUM_WEEKS } from '@/lib/grammar-curriculum';
import { vocabThemeRotation, type VocabTheme } from '@/lib/lesson-focus';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { scoreBarColor } from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const WRITING_PRACTICE_KEY = 'writingPracticePrompt';

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
};

export type ScoreDetailTab = 'grammar' | 'vocabulary' | 'fluency' | 'writing';

type Props = {
  visible: boolean;
  tab: ScoreDetailTab | null;
  entry: LessonHistoryEntry;
  currentGrammarTopic: GrammarTopic | null;
  curriculumWeek: number | null;
  coveredGrammarTopics: string[];
  coveredVocabThemes: string[];
  previousFluencyScore: number | null;
  onClose: () => void;
};

export function ScoreDetailModal({
  visible,
  tab,
  entry,
  currentGrammarTopic,
  curriculumWeek,
  coveredGrammarTopics,
  coveredVocabThemes,
  previousFluencyScore,
  onClose,
}: Props) {
  const router = useRouter();
  if (!tab) return null;

  const breakdown = entry.breakdown;
  const titles: Record<ScoreDetailTab, string> = {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    fluency: 'Fluency',
    writing: 'Writing',
  };

  const goGrammarDrill = () => {
    onClose();
    router.push({ pathname: '/practice', params: { drill: 'grammar', topic: breakdown.grammar.topic } });
  };

  const goVocabDrill = () => {
    onClose();
    router.push({ pathname: '/practice', params: { drill: 'vocabulary', topic: breakdown.vocabulary.topic } });
  };

  const goWritingPractice = async () => {
    const prompt = breakdown.writing.writingPrompt ?? breakdown.writing.details[0] ?? '';
    if (prompt) {
      await AsyncStorage.setItem(WRITING_PRACTICE_KEY, prompt);
    }
    onClose();
    router.push({ pathname: '/writing', params: { practice: '1' } });
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
          {tab === 'grammar' ? (
            <GrammarDetail
              section={breakdown.grammar}
              currentGrammarTopic={currentGrammarTopic}
              curriculumWeek={curriculumWeek}
              coveredGrammarTopics={coveredGrammarTopics}
              onDrill={goGrammarDrill}
            />
          ) : null}
          {tab === 'vocabulary' ? (
            <VocabularyDetail
              section={breakdown.vocabulary}
              coveredVocabThemes={coveredVocabThemes}
              onDrill={goVocabDrill}
            />
          ) : null}
          {tab === 'fluency' ? (
            <FluencyDetail
              section={breakdown.fluency}
              previousFluencyScore={previousFluencyScore}
            />
          ) : null}
          {tab === 'writing' ? (
            <WritingDetail section={breakdown.writing} onPractice={goWritingPractice} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ScoreHeader({ score, subtitle }: { score: number; subtitle?: string }) {
  const color = scoreBarColor(score);
  return (
    <View style={styles.scoreHeader}>
      <Text style={[styles.scoreBig, { color }]}>{score}%</Text>
      {subtitle ? <Text style={styles.scoreSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function GrammarDetail({
  section,
  currentGrammarTopic,
  curriculumWeek,
  onDrill,
}: {
  section: LessonHistoryEntry['breakdown']['grammar'];
  currentGrammarTopic: GrammarTopic | null;
  curriculumWeek: number | null;
  coveredGrammarTopics: string[];
  onDrill: () => void;
}) {
  const weekTopic = currentGrammarTopic ?? section.topic;
  const progress = curriculumWeek
    ? Math.round((curriculumWeek / TOTAL_CURRICULUM_WEEKS) * 100)
    : 0;

  return (
    <>
      <ScoreHeader score={section.score} subtitle={section.topic} />
      {section.lessonDescription ? (
        <Card title="Today's lesson">
          <Text style={styles.bodyText}>{section.lessonDescription}</Text>
        </Card>
      ) : null}
      <Card title="This week's focus">
        <Text style={styles.highlightText}>
          {curriculumWeek ? `Week ${curriculumWeek} of ${TOTAL_CURRICULUM_WEEKS}: ` : ''}
          {weekTopic}
        </Text>
      </Card>
      <Card title="Grammar curriculum">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {curriculumWeek
            ? `Week ${curriculumWeek} of ${TOTAL_CURRICULUM_WEEKS} (${progress}%)`
            : '20-week structured curriculum'}
        </Text>
      </Card>
      {section.mistakes?.length ? (
        <Card title="Mistakes today">
          {section.mistakes.map((m, i) => (
            <View key={`m-${i}`} style={styles.mistakeRow}>
              <Text style={styles.mistakeWrong}>{m.mistake}</Text>
              <Text style={styles.mistakeRight}>→ {m.correction}</Text>
              {m.explanation ? <Text style={styles.mistakeNote}>{m.explanation}</Text> : null}
            </View>
          ))}
        </Card>
      ) : section.details.length ? (
        <Card title="Notes">
          {section.details.map((d, i) => (
            <Text key={`d-${i}`} style={styles.listItem}>• {d}</Text>
          ))}
        </Card>
      ) : null}
      <Pressable onPress={onDrill} style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}>
        <Text style={styles.actionText}>Drill this topic</Text>
      </Pressable>
    </>
  );
}

function VocabularyDetail({
  section,
  coveredVocabThemes,
  onDrill,
}: {
  section: LessonHistoryEntry['breakdown']['vocabulary'];
  coveredVocabThemes: string[];
  onDrill: () => void;
}) {
  const rotation = vocabThemeRotation(coveredVocabThemes);

  return (
    <>
      <ScoreHeader score={section.score} subtitle={section.topic} />
      <Card title="Theme today">
        <Text style={styles.highlightText}>{section.topic}</Text>
      </Card>
      {section.wordsCorrect?.length ? (
        <Card title="Used correctly">
          {section.wordsCorrect.map((w, i) => (
            <Text key={`ok-${i}`} style={styles.wordRow}>
              <Text style={styles.wordSpanish}>{w.spanish}</Text>
              <Text style={styles.wordEnglish}> — {w.english}</Text>
            </Text>
          ))}
        </Card>
      ) : null}
      {section.wordsToRevisit?.length ? (
        <Card title="Words to revisit">
          {section.wordsToRevisit.map((w, i) => (
            <Text key={`rev-${i}`} style={styles.wordRow}>
              <Text style={styles.wordRevisit}>{w.spanish}</Text>
              <Text style={styles.wordEnglish}> — {w.english}</Text>
            </Text>
          ))}
        </Card>
      ) : null}
      <Card title="Themes covered">
        {rotation.covered.map((t: VocabTheme) => (
          <Text key={`vc-${t}`} style={styles.checkItem}>✅ {t}</Text>
        ))}
        {!rotation.covered.length ? <Text style={styles.mutedText}>None yet</Text> : null}
      </Card>
      {rotation.remaining.length ? (
        <Card title="Still to cover">
          {rotation.remaining.map((t: VocabTheme) => (
            <Text key={`vr-${t}`} style={styles.checkItemMuted}>⬜ {t}</Text>
          ))}
        </Card>
      ) : null}
      <Pressable onPress={onDrill} style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}>
        <Text style={styles.actionText}>Drill vocabulary</Text>
      </Pressable>
    </>
  );
}

function FluencyDetail({
  section,
  previousFluencyScore,
}: {
  section: LessonHistoryEntry['breakdown']['fluency'];
  previousFluencyScore: number | null;
}) {
  const delta =
    previousFluencyScore != null ? section.score - previousFluencyScore : null;
  const trend =
    delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

  return (
    <>
      <ScoreHeader score={section.score} />
      {section.description ? (
        <Card title="What this means">
          <Text style={styles.bodyText}>{section.description}</Text>
        </Card>
      ) : null}
      {section.positivePatterns?.length ? (
        <Card title="What went well">
          {section.positivePatterns.map((p, i) => (
            <Text key={`p-${i}`} style={[styles.listItem, styles.positive]}>+ {p}</Text>
          ))}
        </Card>
      ) : null}
      {section.negativePatterns?.length ? (
        <Card title="Patterns to work on">
          {section.negativePatterns.map((p, i) => (
            <Text key={`n-${i}`} style={[styles.listItem, styles.negative]}>− {p}</Text>
          ))}
        </Card>
      ) : null}
      {section.sentenceNotes?.length ? (
        <Card title="Sentence construction">
          {section.sentenceNotes.map((n, i) => (
            <Text key={`s-${i}`} style={styles.listItem}>• {n}</Text>
          ))}
        </Card>
      ) : null}
      {previousFluencyScore != null ? (
        <Card title="Vs last lesson">
          <Text style={styles.bodyText}>
            Last lesson: {previousFluencyScore}% → Today: {section.score}%
            {trend === 'up' ? ' 📈' : trend === 'down' ? ' 📉' : ' →'}
          </Text>
        </Card>
      ) : null}
      {section.weeklyTips?.length ? (
        <Card title="Javi&apos;s tips this week">
          {section.weeklyTips.map((t, i) => (
            <Text key={`t-${i}`} style={styles.listItem}>💡 {t}</Text>
          ))}
        </Card>
      ) : section.details.length ? (
        <Card title="Notes">
          {section.details.map((d, i) => (
            <Text key={`d-${i}`} style={styles.listItem}>• {d}</Text>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function WritingDetail({
  section,
  onPractice,
}: {
  section: LessonHistoryEntry['breakdown']['writing'];
  onPractice: () => void;
}) {
  return (
    <>
      <ScoreHeader score={section.score} subtitle="Writing quality" />
      {section.originalText ? (
        <Card title="Your text">
          <Text style={styles.bodyText}>{section.originalText}</Text>
        </Card>
      ) : null}
      {section.correctedText ? (
        <Card title="Corrected version">
          <HighlightedCorrection original={section.originalText ?? ''} corrected={section.correctedText} />
        </Card>
      ) : null}
      {section.corrections?.length ? (
        <Card title="Corrections">
          {section.corrections.map((c, i) => (
            <View key={`c-${i}`} style={styles.mistakeRow}>
              <Text style={styles.mistakeWrong}>{c.mistake}</Text>
              <Text style={styles.mistakeRight}>→ {c.correction}</Text>
              {c.explanation ? <Text style={styles.mistakeNote}>{c.explanation}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}
      {section.accentIssues?.length ? (
        <Card title="Accent marks">
          {section.accentIssues.map((a, i) => (
            <Text key={`a-${i}`} style={[styles.listItem, styles.accent]}>´ {a}</Text>
          ))}
        </Card>
      ) : null}
      {section.structuralFeedback?.length ? (
        <Card title="Structure">
          {section.structuralFeedback.map((s, i) => (
            <Text key={`sf-${i}`} style={styles.listItem}>• {s}</Text>
          ))}
        </Card>
      ) : section.details.length ? (
        <Card title="Notes">
          {section.details.map((d, i) => (
            <Text key={`d-${i}`} style={styles.listItem}>• {d}</Text>
          ))}
        </Card>
      ) : null}
      <Pressable onPress={onPractice} style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}>
        <Text style={styles.actionText}>Practice writing</Text>
      </Pressable>
    </>
  );
}

function HighlightedCorrection({ original, corrected }: { original: string; corrected: string }) {
  if (!original.trim()) {
    return <Text style={styles.bodyText}>{corrected}</Text>;
  }
  return (
    <Text style={styles.bodyText}>
      <Text style={styles.correctedHighlight}>{corrected}</Text>
    </Text>
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
  scoreHeader: { alignItems: 'center', marginBottom: 16, marginTop: 4 },
  scoreBig: { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  scoreSubtitle: { fontSize: 14, fontWeight: '700', color: palette.muted, marginTop: 4 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  bodyText: { fontSize: 15, fontWeight: '600', color: palette.text, lineHeight: 22 },
  highlightText: { fontSize: 17, fontWeight: '800', color: palette.text },
  mutedText: { fontSize: 14, fontWeight: '600', color: palette.muted },
  listItem: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20, marginBottom: 6 },
  positive: { color: palette.green },
  negative: { color: palette.amber },
  accent: { color: palette.amber },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: palette.accent },
  progressLabel: { fontSize: 12, fontWeight: '700', color: palette.muted, marginBottom: 10 },
  checkList: { gap: 4, marginBottom: 6 },
  checkItem: { fontSize: 13, fontWeight: '700', color: palette.text, lineHeight: 18 },
  checkItemMuted: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18 },
  mistakeRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.surfaceBorder },
  mistakeWrong: { fontSize: 14, fontWeight: '700', color: palette.red, marginBottom: 4 },
  mistakeRight: { fontSize: 14, fontWeight: '800', color: palette.green, marginBottom: 4 },
  mistakeNote: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18 },
  wordRow: { marginBottom: 8 },
  wordSpanish: { fontSize: 15, fontWeight: '800', color: palette.text },
  wordRevisit: { fontSize: 15, fontWeight: '800', color: palette.amber },
  wordEnglish: { fontSize: 14, fontWeight: '600', color: palette.muted },
  correctedHighlight: { color: palette.green, fontWeight: '700' },
  actionButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionPressed: { opacity: 0.92 },
  actionText: { fontSize: 17, fontWeight: '900', color: '#0B0F14' },
});

export { WRITING_PRACTICE_KEY };
