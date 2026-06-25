import { EssentialVerbsCard } from '@/components/essential-verbs-card';
import {
  GRAMMAR_TOPIC_GROUPS,
  TOTAL_CURRICULUM_WEEKS,
  daysRemainingInWeek,
  getWeekDefinition,
  isWeekCompleted,
  isWeekLocked,
  weekDisplayTitle,
  weekRangeLabel,
  type GrammarCurriculumState,
  type GrammarWeekDefinition,
} from '@/lib/grammar-curriculum';
import { getErrorsForGrammarTopic } from '@/lib/tense-guide-content';
import { averageScoreForTopic } from '@/lib/level-progress';
import { getLessonHistory } from '@/lib/practice-storage';
import type { ErrorDNAItem } from '@/lib/error-dna';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

function scoreColor(score: number | null): string {
  if (score == null) return palette.muted;
  if (score >= 80) return palette.green;
  if (score >= 65) return palette.amber;
  return palette.red;
}

function weekStatusIcon(done: boolean, locked: boolean, isCurrent: boolean): string {
  if (done) return '✅';
  if (locked) return '🔒';
  if (isCurrent) return '🔵';
  return '▶️';
}

type Props = {
  curriculum: GrammarCurriculumState | null;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
  errors: ErrorDNAItem[];
  onReset: () => void;
  hideOuterTitle?: boolean;
};

export function GrammarCurriculumSection({
  curriculum,
  history,
  errors,
  onReset,
  hideOuterTitle = false,
}: Props) {
  const router = useRouter();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [essentialExpanded, setEssentialExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setExpandedWeek(null);
      setExpandedGroups({});
      setEssentialExpanded(false);
    }, []),
  );

  if (!curriculum) return null;

  const daysLeft = daysRemainingInWeek(curriculum);
  const progressPercent = Math.round((curriculum.completedWeeks.length / TOTAL_CURRICULUM_WEEKS) * 100);

  const openConjugation = (week: number) => {
    router.push({ pathname: '/conjugation-tables', params: { week: String(week) } });
  };

  const openGuide = (week: number) => {
    router.push({ pathname: '/tense-guide', params: { week: String(week) } });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleWeek = (week: number, locked: boolean) => {
    if (locked) return;
    setExpandedWeek((prev) => (prev === week ? null : week));
  };

  const renderWeekRow = (week: number, indented = false) => {
    const def = getWeekDefinition(week);
    if (!def) return null;

    const done = isWeekCompleted(curriculum, week);
    const locked = isWeekLocked(curriculum, week);
    const isCurrent = week === curriculum.currentWeek;
    const expanded = expandedWeek === week;
    const avg = averageScoreForTopic(history, def.topic, 'grammar');
    const topicErrors = getErrorsForGrammarTopic(errors, def.topic);

    return (
      <View key={week} style={[styles.weekBlock, indented && styles.weekBlockIndented]}>
        <Pressable
          onPress={() => toggleWeek(week, locked)}
          disabled={locked}
          style={[
            styles.weekRow,
            isCurrent && !locked && styles.weekRowCurrent,
            locked && styles.weekRowLocked,
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded: expanded && !locked, disabled: locked }}>
          <Text style={[styles.weekIcon, locked && styles.weekIconLocked]}>
            {weekStatusIcon(done, locked, isCurrent)}
          </Text>
          <View style={styles.weekMain}>
            <Text
              style={[styles.weekTitle, locked && styles.weekTitleLocked]}
              numberOfLines={2}>
              {weekDisplayTitle(def)}
            </Text>
            {isCurrent && !locked ? (
              <Text style={styles.weekMeta}>
                {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining
              </Text>
            ) : done && avg != null ? (
              <Text style={[styles.weekMeta, { color: scoreColor(avg) }]}>{avg}% avg</Text>
            ) : locked ? (
              <Text style={styles.weekMetaLocked}>Unlocks when you reach this week</Text>
            ) : null}
          </View>
          {!locked ? <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text> : null}
        </Pressable>

        {expanded && !locked ? (
          <View style={styles.expandedBody}>
            <Text style={styles.expandedSummary}>{def.summary}</Text>

            {avg != null ? (
              <Text style={styles.statLine}>
                Your average score for {def.topic}:{' '}
                <Text style={{ color: scoreColor(avg), fontWeight: '900' }}>{avg}%</Text>
              </Text>
            ) : (
              <Text style={styles.statLineMuted}>
                No grammar lessons scored for {def.topic} yet.
              </Text>
            )}

            {def.focusVerbs.length ? (
              <View style={styles.focusBlock}>
                <Text style={styles.focusHeading}>Focus verbs</Text>
                <Text style={styles.focusText}>{def.focusVerbs.join(' · ')}</Text>
              </View>
            ) : null}

            {topicErrors.length ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorHeading}>Your error DNA for this tense</Text>
                {topicErrors.slice(0, 3).map((err) => (
                  <Text key={err.error} style={styles.errorLine}>
                    · {err.error} ({err.occurrences}×)
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.statLineMuted}>No error DNA for this tense yet — great start!</Text>
            )}

            <View style={styles.refButtons}>
              <Pressable
                onPress={() => openConjugation(week)}
                style={({ pressed }) => [styles.refBtn, pressed && styles.refBtnPressed]}>
                <Text style={styles.refBtnText}>Conjugation Tables 📋</Text>
              </Pressable>
              <Pressable
                onPress={() => openGuide(week)}
                style={({ pressed }) => [styles.refBtn, pressed && styles.refBtnPressed]}>
                <Text style={styles.refBtnText}>Tense Guide 📖</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderGroup = (group: (typeof GRAMMAR_TOPIC_GROUPS)[number]) => {
    const completedInGroup = group.weeks.filter((w) => isWeekCompleted(curriculum, w)).length;
    const groupExpanded = expandedGroups[group.id] ?? false;

    return (
      <View key={group.id} style={styles.groupBlock}>
        <Pressable
          onPress={() => toggleGroup(group.id)}
          style={({ pressed }) => [styles.groupHeader, pressed && styles.headerPressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: groupExpanded }}>
          <View style={styles.groupHeaderMain}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {weekRangeLabel(group.weeks)} · {completedInGroup} of {group.weeks.length} weeks complete
            </Text>
          </View>
          <Text style={styles.chevron}>{groupExpanded ? '▼' : '›'}</Text>
        </Pressable>

        {groupExpanded ? (
          <View style={styles.groupBody}>
            {group.weeks.map((week) => renderWeekRow(week, true))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      {!hideOuterTitle ? <Text style={styles.sectionTitle}>Grammar curriculum</Text> : null}

      <EssentialVerbsCard
        expanded={essentialExpanded}
        onExpandedChange={setEssentialExpanded}
      />

      <View style={styles.card}>
        <Text style={styles.overallProgress}>
          {curriculum.completedWeeks.length} of {TOTAL_CURRICULUM_WEEKS} weeks complete
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.groupsList}>{GRAMMAR_TOPIC_GROUPS.map(renderGroup)}</View>

        <Pressable onPress={onReset} style={styles.resetButton} accessibilityRole="button">
          <Text style={styles.resetButtonText}>Reset curriculum</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  overallProgress: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 8,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
  groupsList: { gap: 8 },
  groupBlock: {
    borderWidth: 1,
    borderColor: 'rgba(37, 45, 58, 0.8)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: palette.background,
  },
  headerPressed: { opacity: 0.92 },
  groupHeaderMain: { flex: 1, gap: 3 },
  groupTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
  groupMeta: { fontSize: 12, fontWeight: '600', color: palette.muted, lineHeight: 16 },
  groupBody: { paddingTop: 2, paddingBottom: 4 },
  weekBlock: { borderTopWidth: 1, borderTopColor: 'rgba(37, 45, 58, 0.5)' },
  weekBlockIndented: { marginLeft: 8 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  weekRowCurrent: {
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
  },
  weekRowLocked: { opacity: 0.72 },
  weekIcon: { fontSize: 14, width: 22 },
  weekIconLocked: { opacity: 0.8 },
  weekMain: { flex: 1, gap: 2 },
  weekTitle: { fontSize: 14, fontWeight: '700', color: palette.text, lineHeight: 18 },
  weekTitleLocked: { color: palette.muted },
  weekMeta: { fontSize: 12, fontWeight: '600', color: palette.muted },
  weekMetaLocked: { fontSize: 12, fontWeight: '600', color: palette.grey },
  chevron: { fontSize: 18, fontWeight: '700', color: palette.muted, width: 18, textAlign: 'center' },
  expandedBody: {
    paddingLeft: 42,
    paddingRight: 12,
    paddingBottom: 14,
    gap: 10,
  },
  expandedSummary: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
  statLine: { fontSize: 14, fontWeight: '600', color: palette.text, lineHeight: 20 },
  statLineMuted: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18 },
  focusBlock: { gap: 4 },
  focusHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  focusText: { fontSize: 13, fontWeight: '600', color: palette.text, lineHeight: 18 },
  errorBlock: { gap: 4 },
  errorHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorLine: { fontSize: 13, fontWeight: '600', color: palette.text, lineHeight: 18 },
  refButtons: { gap: 8, marginTop: 4 },
  refBtn: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  refBtnPressed: { opacity: 0.9 },
  refBtnText: { fontSize: 14, fontWeight: '800', color: palette.accent },
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
});
