import { InteractiveSpanishText } from '@/components/interactive-spanish-text';
import type { DailyVocabWord } from '@/lib/daily-vocab-intro';
import { saveVocabularyWord } from '@/lib/saved-vocabulary';
import { normalizeSpanishKey } from '@/lib/themed-vocabulary';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

type Props = {
  message: string;
  words: DailyVocabWord[];
  theme: string;
  loading?: boolean;
  onReady: () => void;
};

export function DailyVocabIntroCard({ message, words, theme, loading, onReady }: Props) {
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const saveWord = useCallback(
    async (word: DailyVocabWord) => {
      const key = normalizeSpanishKey(word.spanish);
      if (savedKeys.has(key)) return;
      setSavingKey(key);
      try {
        await saveVocabularyWord(word.spanish, {
          source: 'lesson',
          needsReview: true,
          english: word.english,
          exampleSpanish: word.exampleSpanish,
          exampleEnglish: word.exampleEnglish,
          partOfSpeech: word.partOfSpeech,
          vocabThemeTag: theme,
          introducedDate: new Date().toISOString().slice(0, 10),
        });
        setSavedKeys((prev) => new Set(prev).add(key));
      } finally {
        setSavingKey(null);
      }
    },
    [savedKeys, theme],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <InteractiveSpanishText
          text={message}
          source="conversation"
          style={styles.message}
          contextSentence={message}
        />
        <View style={styles.saveRow}>
          {words.map((word) => {
            const key = normalizeSpanishKey(word.spanish);
            const saved = savedKeys.has(key);
            return (
              <Pressable
                key={key}
                onPress={() => void saveWord(word)}
                disabled={saved || savingKey === key}
                style={({ pressed }) => [styles.saveChip, pressed && styles.pressed]}>
                <Text style={styles.saveChipText}>
                  {saved ? '💾 Guardada' : savingKey === key ? '…' : `💾 ${stripArticle(word.spanish)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        onPress={onReady}
        disabled={loading}
        style={({ pressed }) => [styles.readyBtn, pressed && styles.pressed, loading && styles.disabled]}>
        {loading ? (
          <ActivityIndicator color="#0B0F14" size="small" />
        ) : (
          <Text style={styles.readyText}>Listo →</Text>
        )}
      </Pressable>
    </View>
  );
}

function stripArticle(value: string): string {
  return value.replace(/^(el|la|los|las)\s+/i, '').trim();
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: 12, gap: 10 },
  bubble: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderBottomLeftRadius: 6,
    padding: 16,
    gap: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: palette.text,
    fontWeight: '600',
  },
  saveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
  },
  saveChipText: { fontSize: 12, fontWeight: '800', color: palette.accent },
  readyBtn: {
    alignSelf: 'center',
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  readyText: { fontSize: 15, fontWeight: '900', color: '#0B0F14' },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
});
