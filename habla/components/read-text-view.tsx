import { lookupVocabularyWord } from '@/lib/claude';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  blue: '#60A5FA',
  green: '#34D399',
};

type WordLookup = {
  spanish: string;
  english: string;
  saved: boolean;
};

type Props = {
  text: string;
  title?: string;
  textTypeLabel?: string;
};

function tokenizeSpanish(text: string): { type: 'word' | 'space'; value: string }[] {
  const parts: { type: 'word' | 'space'; value: string }[] = [];
  const re = /(\s+|[^\s\wáéíóúüñÁÉÍÓÚÜÑ]+|\w[\wáéíóúüñÁÉÍÓÚÜÑ]*)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const value = match[0];
    if (/^\s+$/.test(value)) {
      parts.push({ type: 'space', value });
    } else if (/^[\wáéíóúüñÁÉÍÓÚÜÑ]+$/iu.test(value)) {
      parts.push({ type: 'word', value });
    } else {
      parts.push({ type: 'space', value });
    }
  }
  return parts;
}

export function ReadTextView({ text, title, textTypeLabel }: Props) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokens = tokenizeSpanish(text);

  const handleWordPress = useCallback(async (word: string) => {
    const clean = word.replace(/^[^\wáéíóúüñÁÉÍÓÚÜÑ]+|[^\wáéíóúüñÁÉÍÓÚÜÑ]+$/giu, '');
    if (!clean) return;

    setSelectedWord(clean);
    setLoading(true);
    setError(null);
    setLookup(null);

    try {
      const result = await lookupVocabularyWord(clean);
      const saved = await saveVocabularyWord(result.spanish, {
        source: 'reading',
        needsReview: true,
        english: result.english,
        exampleSpanish: result.exampleSpanish,
      });
      setLookup({
        spanish: saved.word.spanish,
        english: saved.word.english || result.english,
        saved: !saved.alreadyExists || saved.word.source === 'reading',
      });
    } catch {
      setError('Could not look up this word');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {textTypeLabel ? <Text style={styles.typeLabel}>{textTypeLabel}</Text> : null}

      <View style={styles.textBlock}>
        <Text style={styles.textLine}>
          {tokens.map((token, i) =>
            token.type === 'word' ? (
              <Text
                key={`${token.value}-${i}`}
                style={[
                  styles.word,
                  selectedWord?.toLowerCase() === token.value.toLowerCase() && styles.wordSelected,
                ]}
                onPress={() => void handleWordPress(token.value)}>
                {token.value}
              </Text>
            ) : (
              <Text key={`${token.value}-${i}`}>{token.value}</Text>
            ),
          )}
        </Text>
      </View>

      <Text style={styles.hint}>Tap any word to see its meaning and save it 📖</Text>

      {loading ? (
        <View style={styles.lookupCard}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : null}

      {lookup ? (
        <View style={styles.lookupCard}>
          <Text style={styles.lookupSpanish}>{lookup.spanish}</Text>
          <Text style={styles.lookupEnglish}>{lookup.english}</Text>
          <Text style={styles.savedBadge}>✓ Saved to vocabulary · from reading</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 28,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textBlock: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 18,
  },
  textLine: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 30,
  },
  word: {
    color: palette.blue,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  wordSelected: {
    color: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  lookupCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  lookupSpanish: { fontSize: 20, fontWeight: '900', color: palette.text },
  lookupEnglish: { fontSize: 16, fontWeight: '700', color: palette.muted },
  savedBadge: { fontSize: 12, fontWeight: '800', color: palette.green, marginTop: 4 },
  errorText: { fontSize: 13, fontWeight: '700', color: palette.accent, textAlign: 'center' },
});
