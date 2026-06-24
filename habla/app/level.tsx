import {
  GRAMMAR_TOPICS,
  getCoveredGrammarTopicsFromStorage,
  getCoveredVocabThemesFromStorage,
  getCoveredYourDayTopicsFromStorage,
  getCurrentGrammarTopic,
  VOCAB_THEMES,
  YOUR_DAY_TOPICS,
  type GrammarTopic,
} from '@/lib/lesson-focus';
import {
  LEVEL_BANDS,
  averageScoreForTopic,
  getLevelBarometer,
  getNextLevelRequirements,
  type LevelBand,
  type SkillSnapshot,
} from '@/lib/level-progress';
import {
  getCoveredGrammarTopics,
  getCoveredVocabThemes,
  getLessonHistory,
} from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

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

function isCovered(topic: string, coveredSet: Set<string>): boolean {
  return coveredSet.has(topic.toLowerCase());
}

function scoreColor(score: number | null): string {
  if (score == null) return palette.muted;
  if (score >= 80) return palette.green;
  if (score >= 65) return palette.amber;
  return palette.red;
}

function skillColor(status: SkillSnapshot['status']): string {
  if (status === 'strong') return palette.green;
  if (status === 'needs-work') return palette.amber;
  return palette.red;
}

export default function LevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [barometer, setBarometer] = useState<ReturnType<typeof getLevelBarometer>>(null);
  const [nextReq, setNextReq] = useState<ReturnType<typeof getNextLevelRequirements>>(null);
  const [currentGrammarTopic, setCurrentGrammarTopic] = useState<GrammarTopic | null>(null);
  const [grammarCovered, setGrammarCovered] = useState<Set<string>>(new Set());
  const [vocabCovered, setVocabCovered] = useState<Set<string>>(new Set());
  const [yourDayCovered, setYourDayCovered] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      void (async () => {
        try {
          const [
            lessonHistory,
            grammarStorage,
            vocabStorage,
            yourDayStorage,
            grammarTopic,
          ] = await Promise.all([
            getLessonHistory(),
            getCoveredGrammarTopicsFromStorage(),
            getCoveredVocabThemesFromStorage(),
            getCoveredYourDayTopicsFromStorage(),
            getCurrentGrammarTopic(),
          ]);
          if (cancelled) return;

          const grammarFromHistory = getCoveredGrammarTopics(lessonHistory);
          const vocabFromHistory = getCoveredVocabThemes(lessonHistory);

          const grammarSet = new Set(
            [...grammarStorage, ...grammarFromHistory].map((t) => t.toLowerCase()),
          );
          const vocabSet = new Set(
            [...vocabStorage, ...vocabFromHistory].map((t) => t.toLowerCase()),
          );
          const yourDaySet = new Set(yourDayStorage.map((t) => t.toLowerCase()));

          setHistory(lessonHistory);
          setGrammarCovered(grammarSet);
          setVocabCovered(vocabSet);
          setYourDayCovered(yourDaySet);
          setCurrentGrammarTopic(grammarTopic);
          setBarometer(getLevelBarometer(lessonHistory));
          setNextReq(getNextLevelRequirements(lessonHistory));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const grammarCoveredCount = GRAMMAR_TOPICS.filter((t) => isCovered(t, grammarCovered)).length;
  const vocabCoveredCount = VOCAB_THEMES.filter((t) => isCovered(t, vocabCovered)).length;
  const yourDayCoveredCount = YOUR_DAY_TOPICS.filter((t) => isCovered(t, yourDayCovered)).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.backLink}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Your Level</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      ) : !barometer ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No level data yet</Text>
          <Text style={styles.emptyText}>Complete a few lessons to see your progression.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}>
          <LevelBarometerSection barometer={barometer} />
          <GrammarSection
            covered={grammarCovered}
            coveredCount={grammarCoveredCount}
            currentTopic={currentGrammarTopic}
            history={history}
          />
          <VocabSection covered={vocabCovered} coveredCount={vocabCoveredCount} history={history} />
          <YourDaySection covered={yourDayCovered} coveredCount={yourDayCoveredCount} />
          {nextReq ? <NextLevelSection requirements={nextReq} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LevelBarometerSection({
  barometer,
}: {
  barometer: NonNullable<ReturnType<typeof getLevelBarometer>>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Level barometer</Text>
      <View style={styles.card}>
        <Text style={styles.currentBand}>{barometer.band.label}</Text>
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
            />
          ))}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${barometer.progressInBand}%` }]} />
        </View>
        <Text style={styles.progressMessage}>{barometer.message}</Text>
      </View>
    </View>
  );
}

function BandPill({
  band,
  active,
  passed,
}: {
  band: LevelBand;
  active: boolean;
  passed: boolean;
}) {
  const short = band.label.replace('B1 ', '').replace('B2 ', 'B2·');
  return (
    <View
      style={[
        styles.bandPill,
        active && styles.bandPillActive,
        passed && !active && styles.bandPillPassed,
      ]}>
      <Text
        style={[
          styles.bandPillText,
          active && styles.bandPillTextActive,
          passed && !active && styles.bandPillTextPassed,
        ]}
        numberOfLines={1}>
        {short}
      </Text>
    </View>
  );
}

function GrammarSection({
  covered,
  coveredCount,
  currentTopic,
  history,
}: {
  covered: Set<string>;
  coveredCount: number;
  currentTopic: GrammarTopic | null;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Grammar progress</Text>
      <View style={styles.card}>
        {currentTopic ? (
          <Text style={styles.focusLine}>This week&apos;s focus: {currentTopic}</Text>
        ) : null}
        <ProgressBarLabel count={coveredCount} total={GRAMMAR_TOPICS.length} label="topics covered" />
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${(coveredCount / GRAMMAR_TOPICS.length) * 100}%` }]}
          />
        </View>
        <View style={styles.topicList}>
          {GRAMMAR_TOPICS.map((topic) => {
            const done = isCovered(topic, covered);
            const avg = done ? averageScoreForTopic(history, topic, 'grammar') : null;
            const isFocus = currentTopic === topic;
            return (
              <View key={topic} style={[styles.topicRow, isFocus && styles.topicRowFocus]}>
                <Text style={styles.topicIcon}>{done ? '✅' : '⬜'}</Text>
                <Text style={styles.topicLabel} numberOfLines={2}>
                  {topic}
                  {isFocus ? ' · this week' : ''}
                </Text>
                {done && avg != null ? (
                  <Text style={[styles.topicScore, { color: scoreColor(avg) }]}>{avg}%</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function VocabSection({
  covered,
  coveredCount,
  history,
}: {
  covered: Set<string>;
  coveredCount: number;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Vocabulary progress</Text>
      <View style={styles.card}>
        <ProgressBarLabel count={coveredCount} total={VOCAB_THEMES.length} label="themes covered" />
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${(coveredCount / VOCAB_THEMES.length) * 100}%` }]}
          />
        </View>
        <View style={styles.topicList}>
          {VOCAB_THEMES.map((theme) => {
            const done = isCovered(theme, covered);
            const avg = done ? averageScoreForTopic(history, theme, 'vocabulary') : null;
            return (
              <View key={theme} style={styles.topicRow}>
                <Text style={styles.topicIcon}>{done ? '✅' : '⬜'}</Text>
                <Text style={styles.topicLabel} numberOfLines={2}>
                  {theme}
                </Text>
                {done && avg != null ? (
                  <Text style={[styles.topicScore, { color: scoreColor(avg) }]}>{avg}%</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function YourDaySection({
  covered,
  coveredCount,
}: {
  covered: Set<string>;
  coveredCount: number;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your Day topics</Text>
      <View style={styles.card}>
        <ProgressBarLabel count={coveredCount} total={YOUR_DAY_TOPICS.length} label="starters covered" />
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(coveredCount / YOUR_DAY_TOPICS.length) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.topicList}>
          {YOUR_DAY_TOPICS.map((topic) => {
            const done = isCovered(topic, covered);
            return (
              <View key={topic} style={styles.topicRow}>
                <Text style={styles.topicIcon}>{done ? '✅' : '⬜'}</Text>
                <Text style={styles.topicLabel} numberOfLines={2}>
                  {topic}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function NextLevelSection({
  requirements,
}: {
  requirements: NonNullable<ReturnType<typeof getNextLevelRequirements>>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What you need for next level</Text>
      <View style={styles.card}>
        <View style={styles.statGrid}>
          <StatBox label="Current avg" value={`${requirements.currentAverage}%`} />
          <StatBox label="Target avg" value={`${requirements.targetAverage}%`} />
          <StatBox
            label="Gap to close"
            value={`${requirements.gap}%`}
            valueColor={requirements.gap > 0 ? palette.amber : palette.green}
          />
        </View>
        {requirements.estimatedSessions != null && requirements.gap > 0 ? (
          <Text style={styles.estimateText}>
            At your current pace, about {requirements.estimatedSessions} more session
            {requirements.estimatedSessions === 1 ? '' : 's'} to reach the next band.
          </Text>
        ) : requirements.gap > 0 ? (
          <Text style={styles.estimateText}>
            Keep completing lessons — we need a few more sessions to estimate your pace.
          </Text>
        ) : (
          <Text style={[styles.estimateText, { color: palette.green }]}>
            You&apos;ve reached the top band. Brilliant work!
          </Text>
        )}
        <Text style={styles.skillsHeader}>Skills to focus on</Text>
        {requirements.skillsToImprove.map((skill) => (
          <View key={skill.skill} style={styles.skillRow}>
            <Text style={[styles.skillName, { color: skillColor(skill.status) }]}>{skill.skill}</Text>
            <Text style={[styles.skillAvg, { color: skillColor(skill.status) }]}>{skill.average}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProgressBarLabel({ count, total, label }: { count: number; total: number; label: string }) {
  return (
    <Text style={styles.progressLabel}>
      {count} of {total} {label}
    </Text>
  );
}

function StatBox({
  label,
  value,
  valueColor = palette.text,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  backLink: { fontSize: 16, fontWeight: '700', color: palette.accent, minWidth: 72 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: palette.text },
  headerSpacer: { minWidth: 72 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: palette.text, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 20 },
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
  avgLabel: { fontSize: 14, fontWeight: '600', color: palette.muted, marginBottom: 16 },
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
    backgroundColor: palette.background,
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
  bandPillText: { fontSize: 10, fontWeight: '800', color: palette.muted },
  bandPillTextActive: { color: palette.accent },
  bandPillTextPassed: { color: palette.green },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
  progressMessage: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
  focusLine: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 12,
  },
  progressLabel: { fontSize: 13, fontWeight: '700', color: palette.muted, marginBottom: 8 },
  topicList: { marginTop: 12, gap: 2 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 45, 58, 0.6)',
  },
  topicRowFocus: {
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  topicIcon: { fontSize: 14, width: 22 },
  topicLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 18 },
  topicScore: { fontSize: 14, fontWeight: '900' },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox: {
    flex: 1,
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  statValue: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', color: palette.muted, textAlign: 'center' },
  estimateText: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20, marginBottom: 14 },
  skillsHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  skillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 45, 58, 0.6)',
  },
  skillName: { fontSize: 15, fontWeight: '800' },
  skillAvg: { fontSize: 15, fontWeight: '900' },
});
