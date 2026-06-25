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

export function EssentialVerbsCard() {
  const verbs = getEssentialVerbsReference();
  const [expanded, setExpanded] = useState<string | null>(verbs[0]?.infinitive ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Essential Verbs — Always Available</Text>
      <Text style={styles.subtitle}>
        The 10 most important Spanish verbs — tap any form to hear pronunciation
      </Text>
      <View style={styles.verbTabs}>
        {verbs.map((verb) => {
          const active = expanded === verb.infinitive;
          return (
            <Pressable
              key={verb.infinitive}
              onPress={() => setExpanded(active ? null : verb.infinitive)}
              style={[styles.verbTab, active && styles.verbTabActive]}>
              <Text style={[styles.verbTabText, active && styles.verbTabTextActive]}>
                {verb.infinitive}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {expanded ? (
        <ConjugationTableCard
          verb={verbs.find((v) => v.infinitive === expanded)!}
          compact
        />
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
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
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
