import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
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

const CARD_HEIGHT = 320;
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

type Props = {
  verbs: VerbConjugationEntry[];
  weekNumber: number;
  examples: { spanish: string; english: string }[];
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

function VerbDeckCard({
  verb,
  examples,
  cardWidth,
  saved,
  saving,
  onSave,
}: {
  verb: VerbConjugationEntry;
  examples: { spanish: string; english: string }[];
  cardWidth: number;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const table = verb.tenses[0];
  const rows = table?.forms ?? [];
  const yoForm = rows.find((r) => r.person === 'yo')?.form;
  const example = pickVerbExample(verb.infinitive, examples, yoForm);
  const memoryHook = !verb.regular ? getVerbMemoryHook(verb.infinitive) : undefined;
  const regional = hasRegionalVariant(rows) || !!verb.regionNote;

  return (
    <View style={[styles.card, { width: cardWidth, height: CARD_HEIGHT }]}>
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
          <Text style={[styles.badgeText, verb.regular ? styles.badgeTextRegular : styles.badgeTextIrregular]}>
            {verb.regular ? 'Regular' : 'Irregular'}
          </Text>
        </View>
      </View>

      {memoryHook ? (
        <Text style={styles.memoryHook} numberOfLines={2}>
          💡 {memoryHook}
        </Text>
      ) : null}

      {regional ? <Text style={styles.regionalFlags}>🇪🇸 · 🇦🇷</Text> : null}

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.cell, styles.personCol, styles.headerText]}>Pronoun</Text>
          <Text style={[styles.cell, styles.formCol, styles.headerText]}>Conjugation</Text>
          <Text style={[styles.cell, styles.englishCol, styles.headerText]}>English</Text>
        </View>
        {rows.map((row) => (
          <View key={row.person} style={styles.tableRow}>
            <Text style={[styles.cell, styles.personCol, styles.personText]}>{row.person}</Text>
            <Pressable
              onPress={() => speakForm(row.form)}
              style={[styles.cell, styles.formCol, styles.formPressable]}
              accessibilityRole="button"
              accessibilityLabel={`Pronounce ${row.form}`}>
              <Text style={[styles.formText, row.irregular && styles.irregularForm]}>{row.form}</Text>
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

      {example ? (
        <View style={styles.exampleBlock}>
          <Text style={styles.exampleSpanish} numberOfLines={1}>
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

export function Phase1VerbDeck({ verbs, weekNumber, examples }: Props) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quickRefOpen, setQuickRefOpen] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const total = verbs.length;

  const goToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(total - 1, index));
      scrollRef.current?.scrollTo({ x: clamped * cardWidth, animated: true });
      setActiveIndex(clamped);
    },
    [cardWidth, total],
  );

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
          vocabThemeTag: `grammar_verb:Week ${weekNumber}`,
        });
        setSavedKeys((prev) => new Set(prev).add(key));
      } finally {
        setSavingKey(null);
      }
    },
    [examples, savedKeys, weekNumber],
  );

  const palaceHref = useMemo((): Href => {
    const setId = getFirstPalaceVerbSetIdForWeek(weekNumber);
    return setId
      ? (`/memory-palace?set=${encodeURIComponent(setId)}` as Href)
      : ('/memory-palace' as Href);
  }, [weekNumber]);

  if (!total) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Esta semana — {total} verbos 🔤</Text>
          <Text style={styles.headerSubtitle}>Desliza para ver todos →</Text>
        </View>
        <Text style={styles.positionLabel}>
          {activeIndex + 1} / {total}
        </Text>
      </View>

      <Pressable
        onPress={() => setQuickRefOpen(true)}
        style={({ pressed }) => [styles.quickRefBtn, pressed && styles.pressed]}>
        <Text style={styles.quickRefText}>Ver todos</Text>
      </Pressable>

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
            setActiveIndex(Math.max(0, Math.min(total - 1, idx)));
          }}
          contentContainerStyle={styles.deckScroll}>
          {verbs.map((verb) => {
            const key = verb.infinitive.toLowerCase();
            return (
              <VerbDeckCard
                key={verb.infinitive}
                verb={verb}
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

      <View style={styles.dotsRow}>
        {verbs.map((verb, i) => (
          <Pressable key={verb.infinitive} onPress={() => goToIndex(i)} hitSlop={6}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.push(palaceHref)}
        style={({ pressed }) => [styles.palaceLink, pressed && styles.pressed]}>
        <Text style={styles.palaceLinkText}>🏛️ Practica en el Memory Palace →</Text>
      </Pressable>

      <Modal
        visible={quickRefOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setQuickRefOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Todos los verbos</Text>
              <Pressable onPress={() => setQuickRefOpen(false)} hitSlop={12}>
                <Text style={styles.modalClose}>Cerrar</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.quickGridHeader}>
                <Text style={[styles.quickCell, styles.quickVerbCol]}>Verbo</Text>
                <Text style={[styles.quickCell, styles.quickFormCol]}>yo</Text>
                <Text style={[styles.quickCell, styles.quickFormCol]}>tú</Text>
              </View>
              {verbs.map((verb, i) => {
                const rows = verb.tenses[0]?.forms ?? [];
                const yo = rows.find((r) => r.person === 'yo')?.form ?? '—';
                const tu = rows.find((r) => r.person === 'tú')?.form ?? '—';
                return (
                  <Pressable
                    key={verb.infinitive}
                    onPress={() => {
                      setQuickRefOpen(false);
                      goToIndex(i);
                    }}
                    style={({ pressed }) => [styles.quickRow, pressed && styles.pressed]}>
                    <Text style={[styles.quickCell, styles.quickVerbCol, styles.quickVerbName]}>
                      {verb.infinitive}
                      {!verb.regular ? ' ★' : ''}
                    </Text>
                    <Text style={[styles.quickCell, styles.quickFormCol]}>{yo}</Text>
                    <Text style={[styles.quickCell, styles.quickFormCol]}>{tu}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
  headerSubtitle: { fontSize: 12, fontWeight: '600', color: palette.muted },
  positionLabel: { fontSize: 13, fontWeight: '800', color: palette.accent },
  quickRefBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.surface,
  },
  quickRefText: { fontSize: 12, fontWeight: '800', color: palette.muted },
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
  memoryHook: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 15,
  },
  regionalFlags: { fontSize: 11, fontWeight: '700', color: palette.muted },
  table: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
    minHeight: 28,
  },
  tableHeader: { backgroundColor: palette.background },
  headerText: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cell: { paddingVertical: 4, paddingHorizontal: 6, justifyContent: 'center' },
  personCol: { width: '24%' },
  formCol: { flex: 1 },
  englishCol: { flex: 1.1 },
  personText: { fontSize: 11, fontWeight: '600', color: palette.muted },
  formPressable: { justifyContent: 'center' },
  formText: { fontSize: 13, fontWeight: '800', color: palette.text },
  irregularForm: { color: palette.accent },
  englishForm: {
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    color: 'rgba(139, 149, 165, 0.75)',
    lineHeight: 13,
  },
  argentinaNote: { fontSize: 9, fontWeight: '600', color: palette.muted },
  exampleBlock: { gap: 1, marginTop: 2 },
  exampleSpanish: {
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
    color: palette.muted,
  },
  exampleEnglish: {
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    color: 'rgba(139, 149, 165, 0.65)',
  },
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
  palaceLink: { alignSelf: 'center', paddingVertical: 4 },
  palaceLinkText: { fontSize: 13, fontWeight: '700', color: palette.accent },
  pressed: { opacity: 0.9 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    maxHeight: '70%',
    padding: 16,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: palette.text },
  modalClose: { fontSize: 14, fontWeight: '800', color: palette.accent },
  quickGridHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
    paddingBottom: 8,
    marginBottom: 4,
  },
  quickRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  quickCell: { fontSize: 13, fontWeight: '600', color: palette.muted },
  quickVerbCol: { flex: 1.2 },
  quickFormCol: { flex: 1 },
  quickVerbName: { fontWeight: '900', color: palette.text },
});
