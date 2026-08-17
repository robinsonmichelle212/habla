import { Phase1VerbDeck } from '@/components/phase1-verb-deck';
import { getFocusVerbsForTopic, sortVerbsForPhase1Deck } from '@/lib/conjugation-data';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { TENSE_GUIDE_CONTENT } from '@/lib/tense-guide-content';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
};

type Props = {
  focus: Extract<LessonFocusContext, { kind: 'grammar' }>;
};

export function Phase1VerbGuide({ focus }: Props) {
  const guide = TENSE_GUIDE_CONTENT[focus.topic];
  const verbs = useMemo(() => {
    const loaded = getFocusVerbsForTopic(focus.focusVerbs, focus.topic);
    return sortVerbsForPhase1Deck(loaded, focus.focusVerbs);
  }, [focus.focusVerbs, focus.topic]);

  const [whenToUseExpanded, setWhenToUseExpanded] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.topicHeader}>
        <Text style={styles.eyebrow}>Phase 1 · Week {focus.weekNumber}</Text>
        <Text style={styles.title}>
          {focus.topic} — {focus.topicSpanish}
        </Text>
        {focus.weekSummary ? <Text style={styles.summary}>{focus.weekSummary}</Text> : null}
      </View>

      <View style={styles.whenToUseCard}>
        <Pressable
          onPress={() => setWhenToUseExpanded((v) => !v)}
          style={({ pressed }) => [styles.whenToUseHeader, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: whenToUseExpanded }}>
          <Text style={styles.whenToUseTitle}>When to use it</Text>
          <Text style={styles.chevron}>{whenToUseExpanded ? '▼' : '›'}</Text>
        </Pressable>
        {whenToUseExpanded ? (
          <View style={styles.whenToUseBody}>
            {guide.whenToUse.map((line, i) => (
              <Text key={`when-${i}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <Phase1VerbDeck verbs={verbs} weekNumber={focus.weekNumber} examples={guide.examples} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 12 },
  topicHeader: { gap: 4, paddingHorizontal: 2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 22,
  },
  summary: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
  },
  whenToUseCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    overflow: 'hidden',
  },
  whenToUseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  whenToUseTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: { fontSize: 18, fontWeight: '700', color: palette.muted },
  whenToUseBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
  },
  bullet: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 19,
  },
  pressed: { opacity: 0.92 },
});
