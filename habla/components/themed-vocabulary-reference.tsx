import { AppTextInput } from '@/components/app-text-input';
import type { LessonHistoryEntry } from '@/lib/practice-storage';
import type { SavedVocabWord } from '@/lib/saved-vocabulary';
import {
  findThemeById,
  normalizeSpanishKey,
  THEMED_VOCABULARY,
  type ThemedPhrase,
  type ThemedVerb,
  type ThemedVocabWord,
  type ThemedVocabularyTheme,
} from '@/lib/themed-vocabulary';
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
  blue: '#60A5FA',
};

type Props = {
  savedWords: SavedVocabWord[];
  history: LessonHistoryEntry[];
};

type SavedMatch = {
  saved?: SavedVocabWord;
  mastered: boolean;
};

function countLessonsForTheme(history: LessonHistoryEntry[], themeId: string): number {
  const target = themeId.trim().toLowerCase();
  return history.filter((entry) => {
    const topic = entry.breakdown?.vocabulary?.topic?.trim().toLowerCase() ?? '';
    return topic === target || topic.includes(target) || target.includes(topic);
  }).length;
}

function matchSaved(
  spanish: string,
  byKey: Map<string, SavedVocabWord>,
): SavedMatch {
  const key = normalizeSpanishKey(spanish);
  const saved = byKey.get(key);
  if (saved) return { saved, mastered: saved.mastered };
  // Also try raw without article strip already done in normalize
  for (const [k, word] of byKey) {
    if (key.includes(k) || k.includes(key)) {
      return { saved: word, mastered: word.mastered };
    }
  }
  return { mastered: false };
}

export function ThemedVocabularyReference({ savedWords, history }: Props) {
  const [query, setQuery] = useState('');
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [expandedWordKey, setExpandedWordKey] = useState<string | null>(null);

  const savedByKey = useMemo(() => {
    const map = new Map<string, SavedVocabWord>();
    for (const word of savedWords) {
      map.set(normalizeSpanishKey(word.spanish), word);
    }
    return map;
  }, [savedWords]);

  const lessonCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const theme of THEMED_VOCABULARY) {
      map.set(theme.id, countLessonsForTheme(history, theme.id));
    }
    return map;
  }, [history]);

  const maxLessons = useMemo(
    () => Math.max(1, ...Array.from(lessonCounts.values())),
    [lessonCounts],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: {
      theme: ThemedVocabularyTheme;
      kind: 'word' | 'phrase' | 'verb';
      word?: ThemedVocabWord;
      phrase?: ThemedPhrase;
      verb?: ThemedVerb;
    }[] = [];

    for (const theme of THEMED_VOCABULARY) {
      for (const word of theme.words) {
        if (
          word.spanish.toLowerCase().includes(q) ||
          word.english.toLowerCase().includes(q) ||
          word.definition.toLowerCase().includes(q)
        ) {
          results.push({ theme, kind: 'word', word });
        }
      }
      for (const phrase of theme.phrases) {
        if (phrase.spanish.toLowerCase().includes(q) || phrase.english.toLowerCase().includes(q)) {
          results.push({ theme, kind: 'phrase', phrase });
        }
      }
      for (const verb of theme.verbs) {
        if (
          verb.infinitive.toLowerCase().includes(q) ||
          verb.english.toLowerCase().includes(q) ||
          verb.forms.some((f) => f.toLowerCase().includes(q))
        ) {
          results.push({ theme, kind: 'verb', verb });
        }
      }
    }
    return results.slice(0, 40);
  }, [query]);

  const mergedWordsForTheme = (theme: ThemedVocabularyTheme): Array<ThemedVocabWord & SavedMatch> => {
    const base = theme.words.map((w) => ({ ...w, ...matchSaved(w.spanish, savedByKey) }));
    const baseKeys = new Set(base.map((w) => normalizeSpanishKey(w.spanish)));

    // Append saved words that belong to this theme by topic match heuristics:
    // if the saved word's Spanish isn't already listed, skip auto-bucket unless
    // the user saved it during a lesson that covered this theme — we only tag
    // overlaps by string match against theme list (already done). Extra saved
    // words without theme membership stay searchable via the word list only.
    void baseKeys;
    return base;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.subtitle}>Key words and phrases by theme</Text>

      <AppTextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search any Spanish word…"
        placeholderTextColor={palette.muted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {query.trim().length >= 2 ? (
        <View style={styles.searchResults}>
          {searchResults.length === 0 ? (
            <Text style={styles.muted}>No matches for “{query.trim()}”.</Text>
          ) : (
            searchResults.map((result, idx) => {
              if (result.kind === 'word' && result.word) {
                const key = `s-word-${result.theme.id}-${result.word.spanish}-${idx}`;
                const match = matchSaved(result.word.spanish, savedByKey);
                return (
                  <WordCard
                    key={key}
                    word={result.word}
                    themeLabel={`${result.theme.emoji} ${result.theme.title}`}
                    match={match}
                    expanded={expandedWordKey === key}
                    onToggle={() => setExpandedWordKey((prev) => (prev === key ? null : key))}
                  />
                );
              }
              if (result.kind === 'phrase' && result.phrase) {
                return (
                  <View key={`s-phrase-${idx}`} style={styles.simpleRow}>
                    <Text style={styles.themeTag}>
                      {result.theme.emoji} {result.theme.title} · phrase
                    </Text>
                    <Text style={styles.spanishBold}>{result.phrase.spanish}</Text>
                    <Text style={styles.english}>{result.phrase.english}</Text>
                    {result.phrase.regional ? (
                      <RegionalFlag note={result.phrase.regional} />
                    ) : null}
                  </View>
                );
              }
              if (result.kind === 'verb' && result.verb) {
                return (
                  <View key={`s-verb-${idx}`} style={styles.simpleRow}>
                    <Text style={styles.themeTag}>
                      {result.theme.emoji} {result.theme.title} · verb
                    </Text>
                    <VerbRow verb={result.verb} />
                  </View>
                );
              }
              return null;
            })
          )}
        </View>
      ) : (
        THEMED_VOCABULARY.map((theme) => {
          const lessons = lessonCounts.get(theme.id) ?? 0;
          const expanded = expandedTheme === theme.id;
          const brightness = 0.08 + (lessons / maxLessons) * 0.12;
          const words = mergedWordsForTheme(theme);

          return (
            <View key={theme.id} style={styles.themeBlock}>
              <Pressable
                onPress={() => {
                  setExpandedTheme((prev) => (prev === theme.id ? null : theme.id));
                  setExpandedWordKey(null);
                }}
                style={({ pressed }) => [
                  styles.themeHeader,
                  { backgroundColor: `rgba(167, 139, 250, ${brightness})` },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ expanded }}>
                <View style={styles.themeHeaderMain}>
                  <Text style={styles.themeTitle}>
                    {theme.emoji} {theme.title}
                  </Text>
                  <Text style={styles.coverLabel}>
                    Covered in {lessons} lesson{lessons === 1 ? '' : 's'}
                  </Text>
                  <View style={styles.miniTrack}>
                    <View
                      style={[
                        styles.miniFill,
                        { width: `${Math.min(100, (lessons / Math.max(3, maxLessons)) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text>
              </Pressable>

              {expanded ? (
                <View style={styles.themeBody}>
                  <Text style={styles.sectionLabel}>Essential words</Text>
                  {words.map((word) => {
                    const key = `${theme.id}-${word.spanish}`;
                    return (
                      <WordCard
                        key={key}
                        word={word}
                        match={{ saved: word.saved, mastered: word.mastered }}
                        expanded={expandedWordKey === key}
                        onToggle={() => setExpandedWordKey((prev) => (prev === key ? null : key))}
                      />
                    );
                  })}

                  <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Key phrases</Text>
                  {theme.phrases.map((phrase) => (
                    <View key={phrase.spanish} style={styles.phraseRow}>
                      <Text style={styles.spanishBold}>{phrase.spanish}</Text>
                      <Text style={styles.english}>— {phrase.english}</Text>
                      {phrase.regional ? <RegionalFlag note={phrase.regional} /> : null}
                    </View>
                  ))}

                  <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Essential verbs</Text>
                  {theme.verbs.map((verb) => (
                    <VerbRow key={verb.infinitive} verb={verb} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function WordCard({
  word,
  match,
  expanded,
  onToggle,
  themeLabel,
}: {
  word: ThemedVocabWord;
  match: SavedMatch;
  expanded: boolean;
  onToggle: () => void;
  themeLabel?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.wordCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}>
      {themeLabel ? <Text style={styles.themeTag}>{themeLabel}</Text> : null}
      <View style={styles.wordTop}>
        <Text style={styles.spanishBold}>
          {word.spanish}
          {match.saved ? ' 💾' : ''}
          {match.mastered ? ' ⭐' : ''}
        </Text>
        <Text style={styles.chevronSmall}>{expanded ? '▼' : '›'}</Text>
      </View>
      <Text style={styles.english}>{word.english}</Text>
      {expanded ? (
        <View style={styles.wordDetail}>
          <Text style={styles.detailLabel}>Definition</Text>
          <Text style={styles.detailText}>{word.definition}</Text>
          <Text style={styles.detailLabel}>Example</Text>
          <Text style={styles.detailSpanish}>{word.exampleSpanish}</Text>
          <Text style={styles.detailText}>{word.exampleEnglish}</Text>
          {word.regional ? <RegionalFlag note={word.regional} /> : null}
          {match.saved?.exampleSpanish && match.saved.exampleSpanish !== word.exampleSpanish ? (
            <>
              <Text style={styles.detailLabel}>Your saved example</Text>
              <Text style={styles.detailSpanish}>{match.saved.exampleSpanish}</Text>
              {match.saved.exampleEnglish ? (
                <Text style={styles.detailText}>{match.saved.exampleEnglish}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function VerbRow({ verb }: { verb: ThemedVerb }) {
  return (
    <View style={styles.verbRow}>
      <Text style={styles.spanishBold}>
        {verb.infinitive} — <Text style={styles.englishInline}>{verb.english}</Text>
      </Text>
      <Text style={styles.forms}>{verb.forms.join(' · ')}</Text>
    </View>
  );
}

function RegionalFlag({ note }: { note: { spain: string; argentina: string } }) {
  return (
    <View style={styles.regionalBox}>
      <Text style={styles.regionalTitle}>🇪🇸 / 🇦🇷</Text>
      <Text style={styles.regionalLine}>🇪🇸 Spain: {note.spain}</Text>
      <Text style={styles.regionalLine}>🇦🇷 Argentina: {note.argentina}</Text>
    </View>
  );
}

/** Exported for Profile summary line. */
export function themedVocabularySummary(
  history: LessonHistoryEntry[],
  savedCount: number,
): string {
  const covered = THEMED_VOCABULARY.filter((t) => countLessonsForTheme(history, t.id) > 0).length;
  return `${covered} of ${THEMED_VOCABULARY.length} themes · ${savedCount} saved`;
}

export function resolveThemeTitle(topic: string): string | null {
  return findThemeById(topic)?.title ?? null;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: 4,
  },
  search: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 6,
  },
  searchResults: { gap: 8 },
  muted: { fontSize: 13, fontWeight: '600', color: palette.muted, paddingVertical: 8 },
  themeBlock: { marginBottom: 4 },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    padding: 14,
  },
  themeHeaderMain: { flex: 1, gap: 6 },
  themeTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
  coverLabel: { fontSize: 12, fontWeight: '600', color: palette.muted },
  miniTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  miniFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  chevron: { fontSize: 18, fontWeight: '700', color: palette.muted, width: 18, textAlign: 'center' },
  chevronSmall: { fontSize: 14, fontWeight: '700', color: palette.muted },
  pressed: { opacity: 0.92 },
  themeBody: {
    marginTop: 8,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  sectionSpacer: { marginTop: 10 },
  wordCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.background,
    padding: 12,
    gap: 4,
  },
  wordTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  spanishBold: { fontSize: 15, fontWeight: '900', color: palette.text, flexShrink: 1 },
  english: { fontSize: 13, fontWeight: '600', color: palette.muted },
  englishInline: { fontWeight: '600', color: palette.muted },
  wordDetail: { marginTop: 8, gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.surfaceBorder },
  detailLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.blue,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  detailText: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 18 },
  detailSpanish: { fontSize: 14, fontWeight: '700', color: palette.text, lineHeight: 20 },
  phraseRow: { gap: 2, paddingVertical: 4 },
  verbRow: { gap: 2, paddingVertical: 4 },
  forms: { fontSize: 12, fontWeight: '600', color: palette.amber },
  regionalBox: {
    marginTop: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    padding: 8,
    gap: 2,
  },
  regionalTitle: { fontSize: 12, fontWeight: '800', color: palette.text, marginBottom: 2 },
  regionalLine: { fontSize: 12, fontWeight: '600', color: palette.muted },
  simpleRow: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    gap: 4,
  },
  themeTag: { fontSize: 11, fontWeight: '800', color: palette.blue, marginBottom: 2 },
});
