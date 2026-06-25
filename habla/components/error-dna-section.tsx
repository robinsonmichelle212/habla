import {
  categoryLabel,
  getMostRecentSessionDate,
  getLastSessionDates,
  isErrorImproving,
  isErrorRecent,
  occurrenceIndicator,
  type ArchivedErrorDNAItem,
  type ErrorDNAItem,
} from '@/lib/error-dna';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
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
};

function categoryStyle(category: ErrorDNAItem['category']) {
  switch (category) {
    case 'grammar':
      return styles.badgeGrammar;
    case 'writing':
      return styles.badgeWriting;
    case 'vocabulary':
      return styles.badgeVocabulary;
    case 'speaking':
      return styles.badgeSpeaking;
    case 'structure':
      return styles.badgeStructure;
    case 'word-order':
      return styles.badgeWordOrder;
  }
}

function ErrorRow({
  item,
  lastSessionDate,
  recentSessionDates,
}: {
  item: ErrorDNAItem;
  lastSessionDate: string | null;
  recentSessionDates: string[];
}) {
  const recent = isErrorRecent(item, lastSessionDate);
  const improving = !recent && isErrorImproving(item, recentSessionDates);

  return (
    <View style={styles.errorCard}>
      <View style={styles.errorHeader}>
        <Text style={styles.occurrenceBadge}>
          {occurrenceIndicator(item.occurrences)} {item.occurrences}×
        </Text>
        <View style={[styles.categoryBadge, categoryStyle(item.category)]}>
          <Text style={styles.categoryBadgeText}>{categoryLabel(item.category)}</Text>
        </View>
      </View>

      <Text style={styles.errorTitle}>{item.error}</Text>

      {item.example ? (
        <View style={styles.exampleBlock}>
          <Text style={styles.exampleLabel}>Example</Text>
          <Text style={styles.exampleText}>{item.example}</Text>
        </View>
      ) : null}

      {item.correction ? (
        <Text style={styles.correctionText}>{item.correction}</Text>
      ) : null}

      <View style={styles.statusRow}>
        {recent ? (
          <Text style={styles.recentBadge}>🔴 Recent</Text>
        ) : improving ? (
          <Text style={styles.improvingBadge}>✅ Improving</Text>
        ) : null}
      </View>
    </View>
  );
}

function ArchivedRow({ item }: { item: ArchivedErrorDNAItem }) {
  return (
    <View style={[styles.errorCard, styles.archivedCard]}>
      <View style={styles.errorHeader}>
        <Text style={styles.occurrenceBadge}>✅ archived</Text>
        <View style={[styles.categoryBadge, categoryStyle(item.category)]}>
          <Text style={styles.categoryBadgeText}>{categoryLabel(item.category)}</Text>
        </View>
      </View>
      <Text style={styles.errorTitle}>{item.error}</Text>
      {item.example ? <Text style={styles.exampleText}>{item.example}</Text> : null}
      {item.correction ? <Text style={styles.correctionText}>{item.correction}</Text> : null}
      <Text style={styles.archivedMeta}>
        Appeared {item.occurrences}× · archived {item.archivedAt}
      </Text>
    </View>
  );
}

export function ErrorDnaSection({
  errors,
  archived,
  history,
}: {
  errors: ErrorDNAItem[];
  archived: ArchivedErrorDNAItem[];
  history: LessonHistoryEntry[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  const lastSessionDate = getMostRecentSessionDate(history);
  const recentSessionDates = getLastSessionDates(history);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Error DNA 🧬</Text>
      <View style={styles.card}>
        <Text style={styles.title}>Your Recurring Patterns</Text>
        <Text style={styles.subtitle}>Javi watches for these every lesson</Text>

        {errors.length === 0 ? (
          <Text style={styles.emptyText}>
            Complete a few lessons and Javi will start tracking your recurring mistakes here.
          </Text>
        ) : (
          errors.map((item) => (
            <ErrorRow
              key={item.error}
              item={item}
              lastSessionDate={lastSessionDate}
              recentSessionDates={recentSessionDates}
            />
          ))
        )}

        {archived.length > 0 ? (
          <>
            <Pressable
              onPress={() => setShowArchived((v) => !v)}
              style={styles.archiveToggle}
              accessibilityRole="button">
              <Text style={styles.archiveToggleText}>
                {showArchived ? 'Hide' : 'View'} archived improvements ({archived.length})
              </Text>
            </Pressable>
            {showArchived
              ? archived.map((item) => <ArchivedRow key={`${item.error}-${item.archivedAt}`} item={item} />)
              : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
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
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 10,
  },
  archivedCard: { opacity: 0.85 },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  occurrenceBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
  },
  categoryBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  badgeGrammar: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  badgeWriting: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  badgeVocabulary: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  badgeSpeaking: {
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
    borderColor: 'rgba(255, 122, 89, 0.45)',
  },
  badgeStructure: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  badgeWordOrder: {
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    borderColor: 'rgba(45, 212, 191, 0.45)',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    lineHeight: 21,
    marginBottom: 8,
  },
  exampleBlock: { marginBottom: 8 },
  exampleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.amber,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  correctionText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 19,
  },
  statusRow: { marginTop: 8 },
  recentBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.red,
  },
  improvingBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.green,
  },
  archiveToggle: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 8,
  },
  archiveToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
  },
  archivedMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 6,
  },
});
