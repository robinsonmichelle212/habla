import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GrammarVerbDeck } from '@/components/grammar-verb-deck';
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

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
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
            The 10 most important Spanish verbs — swipe between them, tap any form to hear
            pronunciation
          </Text>
          <GrammarVerbDeck
            verbs={verbs}
            title="ser · estar · tener · ir · hacer …"
            hidePalaceLink={false}
          />
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
});
