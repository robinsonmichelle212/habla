import { ConjugationTableCard } from '@/components/conjugation-table';
import { lookupVerbConjugation } from '@/lib/claude-conjugation';
import { getFocusVerbsForTopic } from '@/lib/conjugation-data';
import {
  GRAMMAR_WEEK_DEFINITIONS,
  getWeekDefinition,
  type GrammarTopic,
} from '@/lib/grammar-curriculum';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
};

function parseTopic(value: string | undefined): GrammarTopic | null {
  if (!value) return null;
  const week = parseInt(value, 10);
  if (Number.isFinite(week) && week >= 1 && week <= 20) {
    return getWeekDefinition(week).topic;
  }
  const topics = GRAMMAR_WEEK_DEFINITIONS.map((w) => w.topic);
  return topics.includes(value as GrammarTopic) ? (value as GrammarTopic) : null;
}

export default function ConjugationTablesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ week?: string; topic?: string }>();

  const topic = useMemo(
    () => parseTopic(params.topic) ?? parseTopic(params.week) ?? 'Present tense',
    [params.topic, params.week],
  );

  const weekNum = useMemo(() => {
    const w = parseInt(params.week ?? '', 10);
    return Number.isFinite(w) ? w : null;
  }, [params.week]);

  const weekDef = weekNum ? getWeekDefinition(weekNum) : GRAMMAR_WEEK_DEFINITIONS.find((w) => w.topic === topic);
  const focusTables = useMemo(
    () => getFocusVerbsForTopic(weekDef?.focusVerbs ?? [], topic),
    [weekDef?.focusVerbs, topic],
  );

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<ReturnType<typeof getFocusVerbsForTopic>[number] | null>(null);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    void (async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const result = await lookupVerbConjugation(trimmed, topic);
        setSearchResult(result);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Lookup failed');
        setSearchResult(null);
      } finally {
        setSearching(false);
      }
    })();
  }, [query, topic]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Conjugation Tables 📋</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.topicLabel}>{topic}</Text>
          {weekDef ? <Text style={styles.weekMeta}>Week {weekDef.week} focus verbs</Text> : null}

          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>Search any verb</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. hablar, comer, vivir"
                placeholderTextColor={palette.muted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              <Pressable
                onPress={handleSearch}
                disabled={searching || !query.trim()}
                style={[styles.searchBtn, (searching || !query.trim()) && styles.searchBtnDisabled]}>
                {searching ? (
                  <ActivityIndicator color="#0B0F14" size="small" />
                ) : (
                  <Text style={styles.searchBtnText}>Look up</Text>
                )}
              </Pressable>
            </View>
            {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
          </View>

          {searchResult ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search result</Text>
              <ConjugationTableCard verb={searchResult} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Common verbs for this tense</Text>
            <Text style={styles.sectionHint}>
              Pre-built tables for this week&apos;s focus verbs — tap any form to hear it
            </Text>
            {focusTables.length ? (
              focusTables.map((verb) => (
                <ConjugationTableCard key={verb.infinitive} verb={verb} />
              ))
            ) : (
              <Text style={styles.emptyText}>
                Use the search bar above to look up verbs for this topic.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  back: { fontSize: 16, fontWeight: '700', color: palette.accent, minWidth: 72 },
  title: { fontSize: 17, fontWeight: '900', color: palette.text },
  headerSpacer: { minWidth: 72 },
  scroll: { padding: 20, gap: 16 },
  topicLabel: { fontSize: 20, fontWeight: '900', color: palette.text },
  weekMeta: { fontSize: 14, fontWeight: '600', color: palette.muted, marginTop: -8 },
  searchCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 10,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  searchBtn: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 88,
  },
  searchBtnDisabled: { opacity: 0.55 },
  searchBtnText: { fontSize: 14, fontWeight: '900', color: '#0B0F14' },
  errorText: { fontSize: 13, fontWeight: '700', color: '#F87171' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: palette.text },
  sectionHint: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18, marginTop: -6 },
  emptyText: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
});
