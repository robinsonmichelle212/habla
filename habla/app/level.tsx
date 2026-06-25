import { CulturalNotesSection } from '@/components/cultural-notes-section';
import { ErrorDnaSection } from '@/components/error-dna-section';
import { LevelDetailModal, LevelProgressionList } from '@/components/level-detail-modal';
import {
  getArchivedErrorDNA,
  getErrorDNA,
  type ArchivedErrorDNAItem,
  type ErrorDNAItem,
} from '@/lib/error-dna';
import {
  GRAMMAR_WEEK_DEFINITIONS,
  TOTAL_CURRICULUM_WEEKS,
  daysRemainingInWeek,
  isWeekCompleted,
  isWeekLocked,
  resolveGrammarCurriculum,
  resetGrammarCurriculum,
  weekLabel,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import {
  getCoveredVocabThemesFromStorage,
  getCoveredYourDayTopicsFromStorage,
  VOCAB_THEMES,
  YOUR_DAY_TOPICS,
} from '@/lib/lesson-focus';
import {
  getActiveVocabulary,
  getMasteredVocabulary,
  getSavedVocabulary,
  getVocabStats,
  type SavedVocabWord,
  type VocabStats,
} from '@/lib/saved-vocabulary';
import {
  LEVEL_BANDS,
  averageScoreForTopic,
  getLevelBarometer,
  getNextLevelRequirements,
  type LevelBand,
  type LevelBandId,
  type SkillSnapshot,
} from '@/lib/level-progress';
import {
  getCoveredVocabThemes,
  getLessonHistory,
} from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
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
  const [grammarCurriculum, setGrammarCurriculum] = useState<GrammarCurriculumState | null>(null);
  const [vocabCovered, setVocabCovered] = useState<Set<string>>(new Set());
  const [yourDayCovered, setYourDayCovered] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [vocabStats, setVocabStats] = useState<VocabStats | null>(null);
  const [savedWords, setSavedWords] = useState<SavedVocabWord[]>([]);
  const [errorDna, setErrorDna] = useState<ErrorDNAItem[]>([]);
  const [archivedErrorDna, setArchivedErrorDna] = useState<ArchivedErrorDNAItem[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<LevelBandId | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      void (async () => {
        try {
          const [
            lessonHistory,
            vocabStorage,
            yourDayStorage,
            curriculum,
            stats,
            words,
            activeErrors,
            archivedErrors,
          ] = await Promise.all([
            getLessonHistory(),
            getCoveredVocabThemesFromStorage(),
            getCoveredYourDayTopicsFromStorage(),
            resolveGrammarCurriculum(),
            getVocabStats(),
            getSavedVocabulary(),
            getErrorDNA(),
            getArchivedErrorDNA(),
          ]);
          if (cancelled) return;

          const vocabFromHistory = getCoveredVocabThemes(lessonHistory);

          const vocabSet = new Set(
            [...vocabStorage, ...vocabFromHistory].map((t) => t.toLowerCase()),
          );
          const yourDaySet = new Set(yourDayStorage.map((t) => t.toLowerCase()));

          setHistory(lessonHistory);
          setGrammarCurriculum(curriculum);
          setVocabCovered(vocabSet);
          setYourDayCovered(yourDaySet);
          setBarometer(getLevelBarometer(lessonHistory));
          setNextReq(getNextLevelRequirements(lessonHistory));
          setVocabStats(stats);
          setSavedWords(words);
          setErrorDna(activeErrors);
          setArchivedErrorDna(archivedErrors);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleResetCurriculum = () => {
    Alert.alert(
      'Reset grammar curriculum?',
      'This will restart from Week 1. Your lesson history and scores are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetGrammarCurriculum().then((state) => setGrammarCurriculum(state));
          },
        },
      ],
    );
  };

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
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => router.push('/progress')}
            style={({ pressed }) => [styles.progressLink, pressed && styles.progressLinkPressed]}
            accessibilityRole="button">
            <Text style={styles.progressLinkText}>My Progress 📈</Text>
            <Text style={styles.progressLinkHint}>Score trends · activity · streaks</Text>
          </Pressable>

          {barometer ? (
            <LevelBarometerSection
              barometer={barometer}
              onSelectBand={setSelectedBandId}
            />
          ) : null}
          {barometer ? (
            <>
              <GrammarCurriculumSection
                curriculum={grammarCurriculum}
                history={history}
                onReset={handleResetCurriculum}
              />
              <ErrorDnaSection errors={errorDna} archived={archivedErrorDna} history={history} />
              <VocabSection covered={vocabCovered} coveredCount={vocabCoveredCount} history={history} />
              <YourDaySection covered={yourDayCovered} coveredCount={yourDayCoveredCount} />
              <CulturalNotesSection />
              {nextReq ? <NextLevelSection requirements={nextReq} /> : null}
            </>
          ) : (
            <View style={styles.emptyWrapInline}>
              <Text style={styles.emptyTitle}>No level data yet</Text>
              <Text style={styles.emptyText}>Complete a few lessons to see your progression.</Text>
            </View>
          )}
          {vocabStats ? (
            <SavedVocabularySection stats={vocabStats} words={savedWords} />
          ) : null}
        </ScrollView>
      )}

      {barometer ? (
        <LevelDetailModal
          visible={selectedBandId != null}
          bandId={selectedBandId}
          currentBandIndex={barometer.bandIndex}
          currentAverage={barometer.averageScore}
          history={history}
          nextRequirements={nextReq}
          onClose={() => setSelectedBandId(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LevelBarometerSection({
  barometer,
  onSelectBand,
}: {
  barometer: NonNullable<ReturnType<typeof getLevelBarometer>>;
  onSelectBand: (id: LevelBandId) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Level barometer</Text>
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
        {passed ? '✓ ' : ''}{short}
      </Text>
    </Pressable>
  );
}

function GrammarCurriculumSection({
  curriculum,
  history,
  onReset,
}: {
  curriculum: GrammarCurriculumState | null;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
  onReset: () => void;
}) {
  if (!curriculum) return null;

  const daysLeft = daysRemainingInWeek(curriculum);
  const weekDef = GRAMMAR_WEEK_DEFINITIONS[curriculum.currentWeek - 1];
  const progressPercent = Math.round((curriculum.currentWeek / TOTAL_CURRICULUM_WEEKS) * 100);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Grammar curriculum</Text>
      <View style={styles.card}>
        <Text style={styles.focusLine}>
          Week {curriculum.currentWeek} of {TOTAL_CURRICULUM_WEEKS}: {curriculum.currentTopic}
        </Text>
        <Text style={styles.progressLabel}>
          {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining this week
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressLabel}>Week {curriculum.currentWeek} of 20</Text>

        <Text style={styles.focusVerbsLabel}>Focus verbs</Text>
        <Text style={styles.focusVerbsText}>{curriculum.currentFocusVerbs.join(' · ')}</Text>

        <View style={styles.topicList}>
          {GRAMMAR_WEEK_DEFINITIONS.map((week) => {
            const done = isWeekCompleted(curriculum, week.week);
            const locked = isWeekLocked(curriculum, week.week);
            const isCurrent = week.week === curriculum.currentWeek;
            const avg = done ? averageScoreForTopic(history, week.topic, 'grammar') : null;

            return (
              <View key={week.week} style={[styles.topicRow, isCurrent && styles.topicRowFocus]}>
                <Text style={styles.topicIcon}>
                  {done ? '✅' : locked ? '⬜' : isCurrent ? '▶️' : '⬜'}
                </Text>
                <Text style={[styles.topicLabel, locked && styles.topicLabelLocked]} numberOfLines={2}>
                  {weekLabel(week)}
                  {isCurrent ? ' · now' : locked ? ' · locked' : ''}
                </Text>
                {done && avg != null ? (
                  <Text style={[styles.topicScore, { color: scoreColor(avg) }]}>{avg}%</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {weekDef ? (
          <Text style={styles.weekSummary}>{weekDef.summary}</Text>
        ) : null}

        <Pressable onPress={onReset} style={styles.resetButton} accessibilityRole="button">
          <Text style={styles.resetButtonText}>Reset curriculum</Text>
        </Pressable>
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

function SavedVocabularySection({
  stats,
  words,
}: {
  stats: VocabStats;
  words: SavedVocabWord[];
}) {
  const active = getActiveVocabulary(words);
  const mastered = getMasteredVocabulary(words);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Saved vocabulary</Text>
      <View style={styles.card}>
        <View style={styles.statGrid}>
          <StatBox label="Words saved" value={String(stats.saved)} />
          <StatBox label="Mastered" value={String(stats.mastered)} valueColor={palette.green} />
          <StatBox label="In progress" value={String(stats.inProgress)} valueColor={palette.amber} />
        </View>
        <Text style={styles.vocabStreakLine}>
          Longest mastery streak: {stats.longestMasteryStreak} word
          {stats.longestMasteryStreak === 1 ? '' : 's'} in a row
        </Text>

        {active.length ? (
          <>
            <Text style={styles.listHeader}>Active words</Text>
            {active.map((w) => (
              <VocabWordRow key={w.spanish} word={w} />
            ))}
          </>
        ) : (
          <Text style={styles.mutedListText}>
            Save words during a lesson to drill them in practice.
          </Text>
        )}

        {mastered.length ? (
          <>
            <Text style={[styles.listHeader, { marginTop: 16 }]}>Mastered</Text>
            {mastered.map((w) => (
              <VocabWordRow key={`m-${w.spanish}`} word={w} mastered />
            ))}
          </>
        ) : null}
      </View>
    </View>
  );
}

function VocabWordRow({ word, mastered = false }: { word: SavedVocabWord; mastered?: boolean }) {
  const progress = mastered ? 5 : word.consecutiveCorrect;
  return (
    <View style={styles.vocabWordRow}>
      <View style={styles.vocabWordTop}>
        <Text style={styles.vocabSpanish}>{word.spanish}</Text>
        <Text style={[styles.vocabBadge, mastered ? styles.vocabBadgeMastered : styles.vocabBadgeActive]}>
          {mastered ? '✅ Mastered' : `${progress}/5`}
        </Text>
      </View>
      <Text style={styles.vocabEnglish}>{word.english}</Text>
      {word.exampleSpanish ? (
        <Text style={styles.vocabExample}>{word.exampleSpanish}</Text>
      ) : null}
      <Text style={styles.vocabMeta}>
        {word.difficulty}
        {word.source === 'reading' ? ' · from reading 📖' : ''}
        {' · '}seen {word.timesSeen}× · {word.timesCorrect} correct
      </Text>
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
  emptyWrapInline: { paddingVertical: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: palette.text, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  progressLink: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 20,
  },
  progressLinkPressed: { opacity: 0.92 },
  progressLinkText: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 4,
  },
  progressLinkHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
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
  topicLabelLocked: { color: palette.muted },
  topicScore: { fontSize: 14, fontWeight: '900' },
  focusVerbsLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  focusVerbsText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  weekSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
    marginTop: 12,
  },
  resetButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textDecorationLine: 'underline',
  },
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
  vocabStreakLine: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 14,
    textAlign: 'center',
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  mutedListText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
  },
  vocabWordRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 45, 58, 0.6)',
  },
  vocabWordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vocabSpanish: { fontSize: 16, fontWeight: '900', color: palette.text, flex: 1 },
  vocabEnglish: { fontSize: 14, fontWeight: '600', color: palette.muted, marginBottom: 4 },
  vocabExample: { fontSize: 13, fontWeight: '600', color: palette.text, fontStyle: 'italic', marginBottom: 4 },
  vocabMeta: { fontSize: 11, fontWeight: '700', color: palette.muted },
  vocabBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  vocabBadgeActive: {
    color: palette.amber,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  vocabBadgeMastered: {
    color: palette.green,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
});
