import { CollapsibleProfileSection } from '@/components/collapsible-profile-section';
import { ErrorDnaSection } from '@/components/error-dna-section';
import { MilestonesSection } from '@/components/milestones-section';
import { ResetCurriculumModal } from '@/components/reset-curriculum-modal';
import {
  getArchivedErrorDNA,
  getErrorDNA,
  type ArchivedErrorDNAItem,
  type ErrorDNAItem,
} from '@/lib/error-dna';
import {
  resolveGrammarCurriculum,
  resetGrammarCurriculum,
  daysRemainingInWeek,
  TOTAL_CURRICULUM_WEEKS,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import { getMilestoneHistory } from '@/lib/milestones';
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
  vocabSourceLabel,
  type SavedVocabWord,
  type VocabStats,
} from '@/lib/saved-vocabulary';
import {
  averageScoreForTopic,
} from '@/lib/level-progress';
import {
  getCoveredVocabThemes,
  getLessonHistory,
} from '@/lib/practice-storage';
import {
  formatReminderTimeLabel,
  getReminderTime,
  setReminderTime,
  type ReminderTime,
} from '@/lib/streak-notifications';
import { getOnboardingProfile, isAssessmentSkipped } from '@/lib/onboarding-storage';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
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

export default function LevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [milestonesAchieved, setMilestonesAchieved] = useState(0);
  const [grammarCurriculum, setGrammarCurriculum] = useState<GrammarCurriculumState | null>(null);
  const [vocabCovered, setVocabCovered] = useState<Set<string>>(new Set());
  const [yourDayCovered, setYourDayCovered] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [vocabStats, setVocabStats] = useState<VocabStats | null>(null);
  const [savedWords, setSavedWords] = useState<SavedVocabWord[]>([]);
  const [errorDna, setErrorDna] = useState<ErrorDNAItem[]>([]);
  const [archivedErrorDna, setArchivedErrorDna] = useState<ArchivedErrorDNAItem[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [reminderTime, setReminderTimeState] = useState<ReminderTime | null>(null);
  const [assessmentSkipped, setAssessmentSkipped] = useState(false);
  const [confirmedLevel, setConfirmedLevel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setExpandedSections({});
    }, []),
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
            reminder,
            milestoneHistory,
            skippedAssessment,
            onboardingProfile,
          ] = await Promise.all([
            getLessonHistory(),
            getCoveredVocabThemesFromStorage(),
            getCoveredYourDayTopicsFromStorage(),
            resolveGrammarCurriculum(),
            getVocabStats(),
            getSavedVocabulary(),
            getErrorDNA(),
            getArchivedErrorDNA(),
            getReminderTime(),
            getMilestoneHistory(),
            isAssessmentSkipped(),
            getOnboardingProfile(),
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
          setVocabStats(stats);
          setSavedWords(words);
          setErrorDna(activeErrors);
          setArchivedErrorDna(archivedErrors);
          setReminderTimeState(reminder);
          const achievedIds = new Set(
            milestoneHistory.map((m) => m.id),
          );
          setMilestonesAchieved(achievedIds.size);
          setAssessmentSkipped(skippedAssessment);
          setConfirmedLevel(onboardingProfile?.confirmedLevel ?? null);
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
    setShowResetModal(true);
  };

  const confirmResetCurriculum = () => {
    setShowResetModal(false);
    void resetGrammarCurriculum().then((state) => {
      setGrammarCurriculum(state);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2500);
    });
  };

  const vocabCoveredCount = VOCAB_THEMES.filter((t) => isCovered(t, vocabCovered)).length;
  const yourDayCoveredCount = YOUR_DAY_TOPICS.filter((t) => isCovered(t, yourDayCovered)).length;
  const grammarDaysLeft = grammarCurriculum ? daysRemainingInWeek(grammarCurriculum) : 0;
  const errorDnaSummary =
    errorDna.length > 0
      ? `${errorDna.length} recurring pattern${errorDna.length === 1 ? '' : 's'} tracked`
      : 'No patterns tracked yet';
  const vocabularySummary = vocabStats
    ? `${vocabStats.saved} words saved · ${vocabStats.mastered} mastered`
    : 'Save words during lessons';
  const grammarSummary = grammarCurriculum
    ? `Week ${grammarCurriculum.currentWeek} of ${TOTAL_CURRICULUM_WEEKS} — ${grammarCurriculum.currentTopic} · ${grammarDaysLeft} day${grammarDaysLeft === 1 ? '' : 's'} left`
    : '20-week grammar path';
  const milestonesSummary = `${milestonesAchieved} of 6 achieved`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile 👤</Text>
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
          {resetSuccess ? (
            <View style={styles.resetSuccessBanner}>
              <Text style={styles.resetSuccessText}>Curriculum reset to Week 1 ✅</Text>
            </View>
          ) : null}

          {assessmentSkipped ? (
            <View style={styles.assessmentBanner}>
              <Text style={styles.assessmentBannerText}>
                Level self-assessed{confirmedLevel ? ` (${confirmedLevel})` : ''} — take the test to
                confirm
              </Text>
              <Pressable
                onPress={() => router.push('/onboarding?retake=1' as Href)}
                style={({ pressed }) => [
                  styles.assessmentBannerBtn,
                  pressed && styles.assessmentBannerBtnPressed,
                ]}>
                <Text style={styles.assessmentBannerBtnText}>Take level assessment</Text>
              </Pressable>
            </View>
          ) : null}

          <CollapsibleProfileSection
            title="Error DNA 🧬"
            summary={errorDnaSummary}
            expanded={!!expandedSections.errorDna}
            onToggle={() => toggleSection('errorDna')}>
            <ErrorDnaSection
              errors={errorDna}
              archived={archivedErrorDna}
              history={history}
              hideTitle
            />
          </CollapsibleProfileSection>

          <CollapsibleProfileSection
            title="Vocabulary Dashboard"
            summary={vocabularySummary}
            expanded={!!expandedSections.vocabulary}
            onToggle={() => toggleSection('vocabulary')}>
            <VocabSection
              covered={vocabCovered}
              coveredCount={vocabCoveredCount}
              history={history}
              embedded
            />
            <YourDaySection covered={yourDayCovered} coveredCount={yourDayCoveredCount} embedded />
            {vocabStats ? (
              <SavedVocabularySection stats={vocabStats} words={savedWords} embedded />
            ) : null}
          </CollapsibleProfileSection>

          <CollapsibleProfileSection
            title="Grammar Curriculum"
            summary={grammarSummary}
            expanded={!!expandedSections.grammar}
            onToggle={() => toggleSection('grammar')}>
            <Pressable
              onPress={() => router.push('/grammar-curriculum')}
              style={({ pressed }) => [styles.curriculumLink, pressed && styles.curriculumLinkPressed]}
              accessibilityRole="button">
              <Text style={styles.curriculumLinkTitle}>Open full grammar curriculum 📚</Text>
              <Text style={styles.curriculumLinkHint}>
                Week {grammarCurriculum?.currentWeek ?? 1} of {TOTAL_CURRICULUM_WEEKS} · tap to view all
                weeks, conjugation tables, and tense guides
              </Text>
            </Pressable>
          </CollapsibleProfileSection>

          <CollapsibleProfileSection
            title="Milestones 🏆"
            summary={milestonesSummary}
            expanded={!!expandedSections.milestones}
            onToggle={() => toggleSection('milestones')}>
            <MilestonesSection hideTitle />
          </CollapsibleProfileSection>

          <CollapsibleProfileSection
            title="Settings"
            summary="Notifications · Curriculum · Account"
            expanded={!!expandedSections.settings}
            onToggle={() => toggleSection('settings')}>
            <SettingsSection
              reminderTime={reminderTime}
              onReminderChange={async (hour, minute) => {
                await setReminderTime(hour, minute);
                setReminderTimeState({ hour, minute });
              }}
              onResetCurriculum={handleResetCurriculum}
              onRetakeAssessment={() => router.push('/onboarding?retake=1' as Href)}
              embedded
            />
          </CollapsibleProfileSection>
        </ScrollView>
      )}

      <ResetCurriculumModal
        visible={showResetModal}
        onConfirm={confirmResetCurriculum}
        onCancel={() => setShowResetModal(false)}
      />
    </SafeAreaView>
  );
}

function SettingsSection({
  reminderTime,
  onReminderChange,
  onResetCurriculum,
  onRetakeAssessment,
  embedded = false,
}: {
  reminderTime: ReminderTime | null;
  onReminderChange: (hour: number, minute: number) => Promise<void>;
  onResetCurriculum: () => void;
  onRetakeAssessment: () => void;
  embedded?: boolean;
}) {
  const options: ReminderTime[] = [
    { hour: 18, minute: 0 },
    { hour: 19, minute: 0 },
    { hour: 20, minute: 0 },
    { hour: 21, minute: 0 },
  ];

  return (
    <View style={embedded ? undefined : styles.section}>
      {!embedded ? <Text style={styles.sectionTitle}>Settings</Text> : null}
      <View style={styles.card}>
        <Text style={styles.settingsLabel}>Streak reminder time</Text>
        <Text style={styles.settingsHint}>
          Current: {reminderTime ? formatReminderTimeLabel(reminderTime) : '8:00 PM'}
        </Text>
        <View style={styles.reminderRow}>
          {options.map((opt) => {
            const selected =
              reminderTime?.hour === opt.hour && reminderTime?.minute === opt.minute;
            return (
              <Pressable
                key={`${opt.hour}-${opt.minute}`}
                onPress={() => void onReminderChange(opt.hour, opt.minute)}
                style={[styles.reminderChip, selected && styles.reminderChipSelected]}>
                <Text style={[styles.reminderChipText, selected && styles.reminderChipTextSelected]}>
                  {formatReminderTimeLabel(opt)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onResetCurriculum} style={styles.settingsDangerBtn}>
          <Text style={styles.settingsDangerText}>Reset grammar curriculum</Text>
        </Pressable>

        <Pressable onPress={onRetakeAssessment} style={styles.settingsActionBtn}>
          <Text style={styles.settingsActionText}>Retake level assessment</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VocabSection({
  covered,
  coveredCount,
  history,
  embedded = false,
}: {
  covered: Set<string>;
  coveredCount: number;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
  embedded?: boolean;
}) {
  return (
    <View style={embedded ? styles.embeddedBlock : styles.section}>
      {!embedded ? <Text style={styles.sectionTitle}>Vocabulary progress</Text> : null}
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
  embedded = false,
}: {
  covered: Set<string>;
  coveredCount: number;
  embedded?: boolean;
}) {
  return (
    <View style={embedded ? styles.embeddedBlock : styles.section}>
      {!embedded ? <Text style={styles.sectionTitle}>Your Day topics</Text> : null}
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

function SavedVocabularySection({
  stats,
  words,
  embedded = false,
}: {
  stats: VocabStats;
  words: SavedVocabWord[];
  embedded?: boolean;
}) {
  const active = getActiveVocabulary(words);
  const mastered = getMasteredVocabulary(words);

  return (
    <View style={embedded ? styles.embeddedBlock : styles.section}>
      {!embedded ? <Text style={styles.sectionTitle}>Saved vocabulary</Text> : null}
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
        {vocabSourceLabel(word) ? ` · ${vocabSourceLabel(word)}` : ''}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: palette.text },
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
  embeddedBlock: { marginBottom: 14 },
  curriculumLink: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 6,
  },
  curriculumLinkPressed: { opacity: 0.92 },
  curriculumLinkTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
  },
  curriculumLinkHint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
  },
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 100,
  },
  badgeEmoji: { fontSize: 28, marginBottom: 4 },
  badgeLabel: { fontSize: 13, fontWeight: '800', color: palette.text, textAlign: 'center' },
  badgeDate: { fontSize: 11, fontWeight: '600', color: palette.muted, marginTop: 2 },
  settingsLabel: { fontSize: 14, fontWeight: '800', color: palette.text, marginBottom: 4 },
  settingsHint: { fontSize: 13, fontWeight: '600', color: palette.muted, marginBottom: 12 },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  reminderChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.background,
  },
  reminderChipSelected: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
  },
  reminderChipText: { fontSize: 13, fontWeight: '700', color: palette.muted },
  reminderChipTextSelected: { color: palette.accent },
  settingsDangerBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  settingsDangerText: { fontSize: 14, fontWeight: '800', color: palette.red },
  resetSuccessBanner: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  resetSuccessText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.green,
  },
  assessmentBanner: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  assessmentBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  assessmentBannerBtn: {
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  assessmentBannerBtnPressed: { opacity: 0.9 },
  assessmentBannerBtnText: { fontSize: 14, fontWeight: '800', color: '#0B0F14' },
  settingsActionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  settingsActionText: { fontSize: 14, fontWeight: '800', color: palette.text },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
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
