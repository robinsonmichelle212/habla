/**
 * GrammarVerbDeck — swipeable verb conjugation cards for the Grammar Reference.
 *
 * Matches the Phase 1 lesson verb card design exactly:
 *   - pagingEnabled horizontal ScrollView, arrow buttons, dot indicator
 *   - Defaults to 4 primary forms (yo / tú / él·ella / nosotros)
 *   - "Ver todo →" toggle expands to all 6 forms per card
 *   - Multi-tense tab bar when a verb has more than one tense
 *   - Memory Palace link below deck (when weekNumber provided)
 *   - Tap verb name → save to vocabulary
 *   - Tap any conjugation → expo-speech pronounces it
 */

import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { ConjugationFormRow, VerbConjugationEntry } from '@/lib/conjugation-data';
import { getFirstPalaceVerbSetIdForWeek } from '@/lib/memory-palace';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
import { speakJavi } from '@/lib/javi-speech';
import { getVerbMemoryHook, pickVerbExample } from '@/lib/verb-memory-hooks';
import type { TenseKey } from '@/lib/grammar-tenses';

const PRIMARY_PERSONS = new Set(['yo', 'tú', 'él/ella', 'nosotros']);
const HORIZONTAL_PADDING = 20;

const palette = {
  background: '#0B0F14',
  surface: '#181F2A',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

export type GrammarVerbDeckProps = {
  verbs: VerbConjugationEntry[];
  weekNumber?: number;
  examples?: { spanish: string; english: string }[];
  /** Label shown above the deck — e.g. "Essential Verbs" or "Week 3 focus verbs" */
  title?: string;
  /** Hide the Memory Palace link */
  hidePalaceLink?: boolean;
};

function speakForm(form: string) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  void speakJavi(form);
}

function hasRegionalVariant(rows: ConjugationFormRow[]): boolean {
  return rows.some((r) => !!r.argentinaNote);
}

function buildRegionalNote(rows: ConjugationFormRow[]): string | null {
  const parts: string[] = [];
  const vosotrosRow = rows.find((r) => r.person === 'vosotros');
  const tuRow = rows.find((r) => r.person === 'tú');
  if (vosotrosRow) parts.push(`🇪🇸 vosotros: ${vosotrosRow.form}`);
  if (tuRow?.argentinaNote) parts.push(`🇦🇷 vos: ${tuRow.argentinaNote.replace(/[()]/g, '')}`);
  return parts.length ? parts.join(' / ') : null;
}

// ─── Single verb card ────────────────────────────────────────────────────────

function VerbDeckCard({
  verb,
  tenseIndex,
  examples,
  cardWidth,
  saved,
  saving,
  onSave,
}: {
  verb: VerbConjugationEntry;
  tenseIndex: number;
  examples: { spanish: string; english: string }[];
  cardWidth: number;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const table = verb.tenses[tenseIndex] ?? verb.tenses[0];
  const allRows = table?.forms ?? [];

  const primaryRows = expanded
    ? allRows
    : allRows.filter((r) => PRIMARY_PERSONS.has(r.person));

  const yoForm = allRows.find((r) => r.person === 'yo')?.form;
  const example = pickVerbExample(verb.infinitive, examples, yoForm);
  const memoryHook = !verb.regular ? getVerbMemoryHook(verb.infinitive) : undefined;
  const regional = hasRegionalVariant(allRows) || !!verb.regionNote;
  const regionalNote = buildRegionalNote(allRows);

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      {/* ── Top: name, English, badge ── */}
      <View style={styles.cardTop}>
        <Pressable
          onPress={onSave}
          disabled={saved || saving}
          style={({ pressed }) => [styles.verbIdentity, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Save ${verb.infinitive}`}>
          <Text style={styles.verbName}>
            {verb.infinitive.toUpperCase()}
            {saved ? ' 💾' : saving ? ' …' : ''}
          </Text>
          <Text style={styles.verbEnglish}>{verb.english}</Text>
        </Pressable>
        <View style={[styles.badge, verb.regular ? styles.badgeRegular : styles.badgeIrregular]}>
          <Text
            style={[styles.badgeText, verb.regular ? styles.badgeTextRegular : styles.badgeTextIrregular]}>
            {verb.regular ? 'Regular' : 'Irregular'}
          </Text>
        </View>
      </View>

      {/* ── Memory hook ── */}
      {memoryHook ? (
        <Text style={styles.memoryHook} numberOfLines={2}>
          💡 {memoryHook}
        </Text>
      ) : null}

      {/* ── Regional flags summary ── */}
      {regional && !expanded ? <Text style={styles.regionalFlags}>🇪🇸 · 🇦🇷</Text> : null}

      {/* ── Conjugation table ── */}
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.cell, styles.personCol, styles.headerCell]}>Pronoun</Text>
          <Text style={[styles.cell, styles.formCol, styles.headerCell]}>Conjugation</Text>
          <Text style={[styles.cell, styles.englishCol, styles.headerCell]}>English</Text>
        </View>
        {primaryRows.map((row) => (
          <View key={row.person} style={styles.tableRow}>
            <Text style={[styles.cell, styles.personCol, styles.personText]}>{row.person}</Text>
            <Pressable
              onPress={() => speakForm(row.form)}
              style={[styles.cell, styles.formCol, styles.formPressable]}
              accessibilityRole="button"
              accessibilityLabel={`Pronounce ${row.form}`}>
              <Text style={[styles.formText, row.irregular && styles.irregularForm]}>
                {row.form}
              </Text>
              {row.argentinaNote ? (
                <Text style={styles.argentinaNote}>{row.argentinaNote}</Text>
              ) : null}
            </Pressable>
            <Text style={[styles.cell, styles.englishCol, styles.englishForm]} numberOfLines={2}>
              {row.englishForm}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Ver todo toggle ── */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.verTodoBtn, pressed && styles.pressed]}
        accessibilityRole="button">
        <Text style={styles.verTodoText}>
          {expanded ? 'Ver menos ↑' : 'Ver todo →'}
        </Text>
      </Pressable>

      {/* ── Spain/Argentina note (shown when expanded) ── */}
      {expanded && regionalNote ? (
        <Text style={styles.regionalNote}>{regionalNote}</Text>
      ) : null}

      {/* ── Example sentence ── */}
      {example ? (
        <View style={styles.exampleBlock}>
          <Text style={styles.exampleSpanish} numberOfLines={2}>
            {example.spanish}
          </Text>
          <Text style={styles.exampleEnglish} numberOfLines={1}>
            {example.english}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Tense tab bar ────────────────────────────────────────────────────────────

function TenseTabs({
  tenses,
  activeIndex,
  onSelect,
}: {
  tenses: { tenseKey: TenseKey; tenseLabel: string }[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  if (tenses.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tenseTabs}>
      {tenses.map((t, i) => {
        const active = i === activeIndex;
        // Show only the short label before the parentheses
        const shortLabel = t.tenseLabel.split(' (')[0];
        return (
          <Pressable
            key={t.tenseKey}
            onPress={() => onSelect(i)}
            style={[styles.tenseTab, active && styles.tenseTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.tenseTabText, active && styles.tenseTabTextActive]}>
              {shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export function GrammarVerbDeck({
  verbs,
  weekNumber,
  examples = [],
  title,
  hidePalaceLink = false,
}: GrammarVerbDeckProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTenseIndex, setActiveTenseIndex] = useState(0);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const total = verbs.length;

  // Reset tense tab when switching card
  const goToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(total - 1, index));
      scrollRef.current?.scrollTo({ x: clamped * cardWidth, animated: true });
      setActiveIndex(clamped);
      setActiveTenseIndex(0);
    },
    [cardWidth, total],
  );

  const currentTenses = verbs[activeIndex]?.tenses ?? [];

  const saveVerb = useCallback(
    async (verb: VerbConjugationEntry) => {
      const key = verb.infinitive.toLowerCase();
      if (savedKeys.has(key)) return;
      setSavingKey(key);
      try {
        const table = verb.tenses[0];
        const yoForm = table?.forms.find((r) => r.person === 'yo')?.form ?? '';
        const example = pickVerbExample(verb.infinitive, examples, yoForm);
        await saveVocabularyWord(verb.infinitive, {
          source: 'lesson',
          needsReview: true,
          english: verb.english,
          exampleSpanish: example?.spanish ?? yoForm,
          exampleEnglish: example?.english ?? '',
          partOfSpeech: 'verb',
          vocabThemeTag: weekNumber ? `grammar_verb:Week ${weekNumber}` : 'grammar_verb',
        });
        setSavedKeys((prev) => new Set(prev).add(key));
      } finally {
        setSavingKey(null);
      }
    },
    [examples, savedKeys, weekNumber],
  );

  const palaceHref = useMemo((): Href => {
    if (!weekNumber) return '/memory-palace' as Href;
    const setId = getFirstPalaceVerbSetIdForWeek(weekNumber);
    return setId
      ? (`/memory-palace?set=${encodeURIComponent(setId)}` as Href)
      : ('/memory-palace' as Href);
  }, [weekNumber]);

  if (!total) return null;

  return (
    <View style={styles.wrap}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
          <Text style={styles.headerSubtitle}>Desliza para ver todos → tap to pronounce</Text>
        </View>
        <Text style={styles.positionLabel}>
          {activeIndex + 1} / {total}
        </Text>
      </View>

      {/* ── Tense tabs (only when current card has multiple tenses) ── */}
      <TenseTabs
        tenses={currentTenses}
        activeIndex={activeTenseIndex}
        onSelect={(i) => setActiveTenseIndex(i)}
      />

      {/* ── Card deck ── */}
      <View style={styles.deckWrap}>
        <Pressable
          onPress={() => goToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          style={[styles.arrowBtn, styles.arrowLeft, activeIndex === 0 && styles.arrowDisabled]}
          accessibilityLabel="Previous verb">
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          snapToInterval={cardWidth}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
            const clamped = Math.max(0, Math.min(total - 1, idx));
            setActiveIndex(clamped);
            setActiveTenseIndex(0);
          }}
          contentContainerStyle={styles.deckScroll}>
          {verbs.map((verb) => {
            const key = verb.infinitive.toLowerCase();
            return (
              <VerbDeckCard
                key={verb.infinitive}
                verb={verb}
                tenseIndex={activeTenseIndex}
                examples={examples}
                cardWidth={cardWidth}
                saved={savedKeys.has(key)}
                saving={savingKey === key}
                onSave={() => void saveVerb(verb)}
              />
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => goToIndex(activeIndex + 1)}
          disabled={activeIndex >= total - 1}
          style={[
            styles.arrowBtn,
            styles.arrowRight,
            activeIndex >= total - 1 && styles.arrowDisabled,
          ]}
          accessibilityLabel="Next verb">
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {/* ── Dots ── */}
      <View style={styles.dotsRow}>
        {verbs.map((verb, i) => (
          <Pressable key={verb.infinitive} onPress={() => goToIndex(i)} hitSlop={6}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* ── Memory Palace link ── */}
      {!hidePalaceLink ? (
        <Pressable
          onPress={() => router.push(palaceHref)}
          style={({ pressed }) => [styles.palaceLink, pressed && styles.pressed]}>
          <Text style={styles.palaceLinkText}>🏛️ Practica en el Memory Palace →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
  headerSubtitle: { fontSize: 12, fontWeight: '600', color: palette.muted },
  positionLabel: { fontSize: 13, fontWeight: '800', color: palette.accent },

  // Tense tabs
  tenseTabs: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  tenseTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.surface,
  },
  tenseTabActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
  },
  tenseTabText: { fontSize: 12, fontWeight: '800', color: palette.muted },
  tenseTabTextActive: { color: palette.accent },

  // Deck
  deckWrap: { position: 'relative', justifyContent: 'center' },
  deckScroll: { paddingVertical: 2 },
  arrowBtn: {
    position: 'absolute',
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 15, 20, 0.72)',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 4 },
  arrowRight: { right: 4 },
  arrowDisabled: { opacity: 0.25 },
  arrowText: { fontSize: 22, fontWeight: '700', color: palette.muted, lineHeight: 24 },

  // Card
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.28)',
    padding: 14,
    gap: 6,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  verbIdentity: { flex: 1, gap: 2 },
  verbName: { fontSize: 22, fontWeight: '900', color: palette.text, letterSpacing: 0.5 },
  verbEnglish: { fontSize: 14, fontWeight: '600', color: palette.muted },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeRegular: { backgroundColor: 'rgba(52, 211, 153, 0.15)' },
  badgeIrregular: { backgroundColor: 'rgba(255, 122, 89, 0.15)' },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  badgeTextRegular: { color: palette.green },
  badgeTextIrregular: { color: palette.accent },
  memoryHook: { fontSize: 11, fontWeight: '600', color: palette.muted, lineHeight: 15 },
  regionalFlags: { fontSize: 11, fontWeight: '700', color: palette.muted },
  regionalNote: { fontSize: 11, fontWeight: '600', color: palette.muted, lineHeight: 16 },

  // Table
  table: {
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
    minHeight: 34,
  },
  tableHeaderRow: { backgroundColor: palette.background },
  cell: { paddingVertical: 5, paddingHorizontal: 6, justifyContent: 'center' },
  headerCell: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personCol: { width: '26%' },
  formCol: { flex: 1 },
  englishCol: { flex: 1.1 },
  personText: { fontSize: 12, fontWeight: '600', color: palette.muted },
  formPressable: { justifyContent: 'center' },
  formText: { fontSize: 14, fontWeight: '800', color: palette.text },
  irregularForm: { color: palette.accent },
  englishForm: {
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    color: 'rgba(139, 149, 165, 0.75)',
    lineHeight: 13,
  },
  argentinaNote: { fontSize: 9, fontWeight: '600', color: palette.muted },

  // Ver todo
  verTodoBtn: { alignSelf: 'flex-start', paddingVertical: 2 },
  verTodoText: { fontSize: 11, fontWeight: '800', color: palette.accent },

  // Example
  exampleBlock: { gap: 1, marginTop: 2 },
  exampleSpanish: { fontSize: 11, fontWeight: '600', fontStyle: 'italic', color: palette.muted },
  exampleEnglish: {
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    color: 'rgba(139, 149, 165, 0.65)',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(139, 149, 165, 0.35)',
  },
  dotActive: { backgroundColor: palette.accent, width: 8, height: 8 },

  // Palace link
  palaceLink: { alignSelf: 'center', paddingVertical: 4 },
  palaceLinkText: { fontSize: 13, fontWeight: '700', color: palette.accent },

  pressed: { opacity: 0.88 },
});
