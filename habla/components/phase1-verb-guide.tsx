import { ConjugationTableCard } from '@/components/conjugation-table';
import { getFocusVerbsForTopic } from '@/lib/conjugation-data';
import type { LessonFocusContext } from '@/lib/lesson-focus';
import { TENSE_GUIDE_CONTENT } from '@/lib/tense-guide-content';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
  amber: '#FBBF24',
};

type Props = {
  focus: Extract<LessonFocusContext, { kind: 'grammar' }>;
};

export function Phase1VerbGuide({ focus }: Props) {
  const guide = TENSE_GUIDE_CONTENT[focus.topic];
  const verbs = useMemo(
    () => getFocusVerbsForTopic(focus.focusVerbs, focus.topic),
    [focus.focusVerbs, focus.topic],
  );

  const [expanded, setExpanded] = useState(true);
  const [activeVerb, setActiveVerb] = useState<string | null>(null);

  useEffect(() => {
    if (verbs.length && !activeVerb) {
      setActiveVerb(verbs[0].infinitive);
    }
  }, [verbs, activeVerb]);

  const selectedVerb = verbs.find((v) => v.infinitive === activeVerb) ?? null;
  const regularLines = guide.howToForm.filter((line) => /-ar|-er|-ir/i.test(line));
  const otherFormLines = guide.howToForm.filter((line) => !/-ar|-er|-ir/i.test(line));

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Phase 1 · Week {focus.weekNumber}</Text>
          <Text style={styles.title}>
            {focus.topic} — {focus.topicSpanish}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.summary}>{focus.weekSummary}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When to use it</Text>
            {guide.whenToUse.map((line, i) => (
              <Text key={`when-${i}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Regular verb endings</Text>
            <Text style={styles.sectionHint}>
              Remove -ar / -er / -ir, then add these endings. Irregular verbs change the stem
              or form — see the tables below.
            </Text>
            {regularLines.map((line, i) => (
              <Text key={`form-${i}`} style={styles.formLine}>
                {line}
              </Text>
            ))}
            {otherFormLines.map((line, i) => (
              <Text key={`extra-${i}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              This week&apos;s 10 verbs — regular & irregular
            </Text>
            <Text style={styles.sectionHint}>
              Tap a verb to see every form. Orange highlights are irregular endings. Tap any
              conjugation to hear it.
            </Text>
            <View style={styles.verbTabs}>
              {verbs.map((verb) => {
                const active = activeVerb === verb.infinitive;
                return (
                  <Pressable
                    key={verb.infinitive}
                    onPress={() => setActiveVerb(verb.infinitive)}
                    style={[styles.verbTab, active && styles.verbTabActive]}>
                    <Text style={[styles.verbTabText, active && styles.verbTabTextActive]}>
                      {verb.infinitive}
                    </Text>
                    {!verb.regular ? (
                      <Text style={styles.irregularDot}>★</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {selectedVerb ? (
              <ConjugationTableCard verb={selectedVerb} compact />
            ) : null}
          </View>

          {guide.memoryTips.length ? (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>💡 Memory tip</Text>
              <Text style={styles.tipText}>{guide.memoryTips[0]}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    marginBottom: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  headerPressed: { opacity: 0.92 },
  headerText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 21,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.muted,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
  },
  summary: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    paddingTop: 12,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 17,
  },
  bullet: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 19,
    paddingLeft: 2,
  },
  formLine: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.green,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  verbTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  verbTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.background,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verbTabActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
  },
  verbTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
  },
  verbTabTextActive: { color: palette.accent },
  irregularDot: {
    fontSize: 9,
    color: palette.amber,
  },
  tipBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    padding: 12,
    gap: 4,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.amber,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 18,
  },
});
