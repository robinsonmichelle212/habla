import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConjugationTableCard } from '@/components/conjugation-table';
import { getEssentialVerbsReference } from '@/lib/conjugation-data';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  background: '#0B0F14',
};

type Props = {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export function EssentialVerbsCard({ expanded: controlledExpanded, onExpandedChange }: Props = {}) {
  const verbs = getEssentialVerbsReference();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [activeVerb, setActiveVerb] = useState<string | null>(null);

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
    if (!next) setActiveVerb(null);
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <Text style={styles.title}>Essential Verbs — Always Available 📋</Text>
        <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text>
      </Pressable>

      {expanded ? (
        <>
          <Text style={styles.subtitle}>
            The 10 most important Spanish verbs — tap any form to hear pronunciation
          </Text>
          <View style={styles.verbTabs}>
            {verbs.map((verb) => {
              const active = activeVerb === verb.infinitive;
              return (
                <Pressable
                  key={verb.infinitive}
                  onPress={() => setActiveVerb(active ? null : verb.infinitive)}
                  style={[styles.verbTab, active && styles.verbTabActive]}>
                  <Text style={[styles.verbTabText, active && styles.verbTabTextActive]}>
                    {verb.infinitive}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {activeVerb ? (
            <ConjugationTableCard
              verb={verbs.find((v) => v.infinitive === activeVerb)!}
              compact
            />
          ) : null}
        </>
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
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerPressed: { opacity: 0.92 },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.muted,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
  },
  verbTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  verbTab: {
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
});
