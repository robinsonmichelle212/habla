import { EssentialVerbsCard } from '@/components/essential-verbs-card';
import {
  GRAMMAR_WEEK_DEFINITIONS,
  TOTAL_CURRICULUM_WEEKS,
  daysRemainingInWeek,
  isWeekCompleted,
  isWeekLocked,
  weekLabel,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import { getErrorsForGrammarTopic } from '@/lib/tense-guide-content';
import { averageScoreForTopic } from '@/lib/level-progress';
import { getLessonHistory } from '@/lib/practice-storage';
import type { ErrorDNAItem } from '@/lib/error-dna';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

type Props = {
  curriculum: GrammarCurriculumState | null;
  history: Awaited<ReturnType<typeof getLessonHistory>>;
  errors: ErrorDNAItem[];
  onReset: () => void;
};

export function GrammarCurriculumSection({ curriculum, history, errors, onReset }: Props) {
  const router = useRouter();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(curriculum?.currentWeek ?? null);

  if (!curriculum) return null;

  const daysLeft = daysRemainingInWeek(curriculum);
  const progressPercent = Math.round((curriculum.currentWeek / TOTAL_CURRICULUM_WEEKS) * 100);

  const openConjugation = (week: number) => {
    router.push({ pathname: '/conjugation-tables', params: { week: String(week) } });
  };

  const openGuide = (week: number) => {
    router.push({ pathname: '/tense-guide', params: { week: String(week) } });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Grammar curriculum</Text>

      <EssentialVerbsCard />

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

        <View style={styles.topicList}>
          {GRAMMAR_WEEK_DEFINITIONS.map((week) => {
            const done = isWeekCompleted(curriculum, week.week);
            const locked = isWeekLocked(curriculum, week.week);
            const isCurrent = week.week === curriculum.currentWeek;
            const expandable = !locked;
            const expanded = expandedWeek === week.week;
            const avg = averageScoreForTopic(history, week.topic, 'grammar');
            const topicErrors = getErrorsForGrammarTopic(errors, week.topic);

            return (
              <View key={week.week} style={styles.weekBlock}>
                <Pressable
                  onPress={() => {
                    if (locked) return;
                    setExpandedWeek(expanded ? null : week.week);
                  }}
                  disabled={locked}
                  style={[
                    styles.topicRow,
                    isCurrent && styles.topicRowFocus,
                    expanded && styles.topicRowExpanded,
                  ]}>
                  <Text style={styles.topicIcon}>
                    {done ? '✅' : locked ? '🔒' : isCurrent ? '▶️' : '▶️'}
                  </Text>
                  <View style={styles.topicMain}>
                    <Text
                      style={[styles.topicLabel, locked && styles.topicLabelLocked]}
                      numberOfLines={2}>
                      {weekLabel(week)}
                      {isCurrent ? ' · now' : ''}
                    </Text>
                    {locked ? (
                      <Text style={styles.lockedHint}>Unlocks when this week becomes current</Text>
                    ) : (
                      <Text style={styles.weekSummaryInline} numberOfLines={expanded ? undefined : 1}>
                        {week.summary}
                      </Text>
                    )}
                  </View>
                  {!locked && avg != null ? (
                    <Text style={[styles.topicScore, { color: scoreColor(avg) }]}>{avg}%</Text>
                  ) : null}
                </Pressable>

                {expanded && !locked ? (
                  <View style={styles.expandedBody}>
                    <Text style={styles.expandedSummary}>{week.summary}</Text>

                    {avg != null ? (
                      <Text style={styles.statLine}>
                        Your average score for {week.topic}:{' '}
                        <Text style={{ color: scoreColor(avg), fontWeight: '900' }}>{avg}%</Text>
                      </Text>
                    ) : (
                      <Text style={styles.statLineMuted}>
                        No grammar lessons scored for {week.topic} yet.
                      </Text>
                    )}

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
                        onPress={() => openConjugation(week.week)}
                        style={({ pressed }) => [styles.refBtn, pressed && styles.refBtnPressed]}>
                        <Text style={styles.refBtnText}>Conjugation Tables 📋</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openGuide(week.week)}
                        style={({ pressed }) => [styles.refBtn, pressed && styles.refBtnPressed]}>
                        <Text style={styles.refBtnText}>Tense Guide 📖</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

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
  focusLine: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 12,
  },
  progressLabel: { fontSize: 13, fontWeight: '700', color: palette.muted, marginBottom: 8 },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.accent },
  topicList: { gap: 2 },
  weekBlock: { borderBottomWidth: 1, borderBottomColor: 'rgba(37, 45, 58, 0.6)' },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
  },
  topicRowFocus: {
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  topicRowExpanded: {
    paddingBottom: 4,
  },
  topicIcon: { fontSize: 14, width: 22, marginTop: 2 },
  topicMain: { flex: 1, gap: 4 },
  topicLabel: { fontSize: 14, fontWeight: '700', color: palette.text, lineHeight: 18 },
  topicLabelLocked: { color: palette.muted },
  lockedHint: { fontSize: 12, fontWeight: '600', color: palette.grey, lineHeight: 16 },
  weekSummaryInline: { fontSize: 12, fontWeight: '600', color: palette.muted, lineHeight: 16 },
  topicScore: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  expandedBody: {
    paddingLeft: 30,
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
