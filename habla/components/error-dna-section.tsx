import {
  getLastSessionDates,
  getMostRecentSessionDate,
  isErrorImproving,
  isErrorRecent,
  occurrenceIndicator,
  type ArchivedErrorDNAItem,
  type ErrorDNACategory,
  type ErrorDNAItem,
} from '@/lib/error-dna';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import { useMemo, useState } from 'react';
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

type DisplayCategoryId =
  | 'grammar'
  | 'vocabulary'
  | 'fluency'
  | 'writing'
  | 'word-order'
  | 'speaking';

const CATEGORY_GROUPS: {
  id: DisplayCategoryId;
  label: string;
  headerEmoji: string;
  sourceCategories: ErrorDNACategory[];
}[] = [
  { id: 'grammar', label: 'Grammar', headerEmoji: '🔵', sourceCategories: ['grammar'] },
  { id: 'vocabulary', label: 'Vocabulary', headerEmoji: '🟢', sourceCategories: ['vocabulary'] },
  { id: 'fluency', label: 'Fluency', headerEmoji: '🟡', sourceCategories: ['structure'] },
  { id: 'writing', label: 'Writing', headerEmoji: '🟠', sourceCategories: ['writing'] },
  { id: 'word-order', label: 'Word Order', headerEmoji: '🔴', sourceCategories: ['word-order'] },
  { id: 'speaking', label: 'Speaking', headerEmoji: '🟣', sourceCategories: ['speaking'] },
];

function sortErrorsByOccurrences(items: ErrorDNAItem[]): ErrorDNAItem[] {
  return [...items].sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return a.error.localeCompare(b.error);
  });
}

function groupErrorsByCategory(errors: ErrorDNAItem[]): Map<DisplayCategoryId, ErrorDNAItem[]> {
  const groups = new Map<DisplayCategoryId, ErrorDNAItem[]>();
  for (const group of CATEGORY_GROUPS) {
    groups.set(group.id, []);
  }
  for (const item of errors) {
    const displayGroup = CATEGORY_GROUPS.find((g) => g.sourceCategories.includes(item.category));
    if (!displayGroup) continue;
    groups.get(displayGroup.id)!.push(item);
  }
  for (const [id, items] of groups) {
    groups.set(id, sortErrorsByOccurrences(items));
  }
  return groups;
}

function patternCountLabel(count: number): string {
  return `${count} pattern${count === 1 ? '' : 's'}`;
}

function buildSummary(errors: ErrorDNAItem[]): string | null {
  if (!errors.length) return null;
  const groups = groupErrorsByCategory(errors);
  const activeCategoryCount = CATEGORY_GROUPS.filter(
    (g) => (groups.get(g.id)?.length ?? 0) > 0,
  ).length;
  const topError = sortErrorsByOccurrences(errors)[0];
  return `${errors.length} recurring pattern${errors.length === 1 ? '' : 's'} across ${activeCategoryCount} categor${activeCategoryCount === 1 ? 'y' : 'ies'} — most persistent: ${topError.error}`;
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
        <Text style={styles.errorTitle}>{item.error}</Text>
        <Text style={styles.occurrenceBadge}>
          {occurrenceIndicator(item.occurrences)} {item.occurrences}×
        </Text>
      </View>

      {item.example ? (
        <View style={styles.exampleBlock}>
          <Text style={styles.exampleLabel}>Example</Text>
          <Text style={styles.exampleText}>{item.example}</Text>
        </View>
      ) : null}

      {item.correction ? (
        <Text style={styles.correctionText}>{item.correction}</Text>
      ) : null}

      {improving ? (
        <View style={styles.statusRow}>
          <Text style={styles.improvingBadge}>✅ Improving</Text>
        </View>
      ) : null}
    </View>
  );
}

function CategoryGroup({
  label,
  headerEmoji,
  items,
  expanded,
  onToggle,
  lastSessionDate,
  recentSessionDates,
}: {
  label: string;
  headerEmoji: string;
  items: ErrorDNAItem[];
  expanded: boolean;
  onToggle: () => void;
  lastSessionDate: string | null;
  recentSessionDates: string[];
}) {
  if (!items.length) return null;

  return (
    <View style={styles.categoryGroup}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.categoryHeader, pressed && styles.categoryHeaderPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <View style={styles.categoryHeaderMain}>
          <Text style={styles.categoryHeaderTitle}>
            {headerEmoji} {label}
          </Text>
          <Text style={styles.categoryHeaderCount}>{patternCountLabel(items.length)}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text>
      </Pressable>

      {expanded
        ? items.map((item) => (
            <ErrorRow
              key={item.error}
              item={item}
              lastSessionDate={lastSessionDate}
              recentSessionDates={recentSessionDates}
            />
          ))
        : null}
    </View>
  );
}

function ArchivedRow({ item }: { item: ArchivedErrorDNAItem }) {
  const group = CATEGORY_GROUPS.find((g) => g.sourceCategories.includes(item.category));
  const categoryName = group ? `${group.headerEmoji} ${group.label}` : item.category;

  return (
    <View style={[styles.errorCard, styles.archivedCard]}>
      <View style={styles.errorHeader}>
        <Text style={styles.errorTitle}>{item.error}</Text>
        <Text style={styles.occurrenceBadge}>✅ archived</Text>
      </View>
      <Text style={styles.archivedCategory}>{categoryName}</Text>
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
  hideTitle = false,
}: {
  errors: ErrorDNAItem[];
  archived: ArchivedErrorDNAItem[];
  history: LessonHistoryEntry[];
  hideTitle?: boolean;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const lastSessionDate = getMostRecentSessionDate(history);
  const recentSessionDates = getLastSessionDates(history);

  const groupedErrors = useMemo(() => groupErrorsByCategory(errors), [errors]);
  const summary = useMemo(() => buildSummary(errors), [errors]);

  const toggleCategory = (id: DisplayCategoryId) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={hideTitle ? styles.embeddedSection : styles.section}>
      {!hideTitle ? <Text style={styles.sectionTitle}>Error DNA 🧬</Text> : null}
      <View style={styles.card}>
        <Text style={styles.title}>Your Recurring Patterns</Text>
        <Text style={styles.subtitle}>Javi watches for these every lesson</Text>

        {errors.length === 0 ? (
          <Text style={styles.emptyText}>
            Complete a few lessons and Javi will start tracking your recurring mistakes here.
          </Text>
        ) : (
          <>
            {summary ? <Text style={styles.summaryLine}>{summary}</Text> : null}
            {CATEGORY_GROUPS.map((group) => (
              <CategoryGroup
                key={group.id}
                label={group.label}
                headerEmoji={group.headerEmoji}
                items={groupedErrors.get(group.id) ?? []}
                expanded={!!expandedCategories[group.id]}
                onToggle={() => toggleCategory(group.id)}
                lastSessionDate={lastSessionDate}
                recentSessionDates={recentSessionDates}
              />
            ))}
          </>
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
  embeddedSection: { marginBottom: 0 },
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
  summaryLine: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 21,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
  },
  categoryGroup: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.background,
  },
  categoryHeaderPressed: { opacity: 0.92 },
  categoryHeaderMain: { flex: 1, gap: 2 },
  categoryHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.text,
  },
  categoryHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.muted,
    width: 18,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    padding: 12,
    marginBottom: 0,
  },
  archivedCard: { opacity: 0.85, marginBottom: 10, borderRadius: 12, borderWidth: 1 },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  occurrenceBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
    flexShrink: 0,
  },
  errorTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    lineHeight: 21,
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
  improvingBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.green,
  },
  archiveToggle: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 8,
  },
  archiveToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
  },
  archivedCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 6,
  },
  archivedMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 6,
  },
});
