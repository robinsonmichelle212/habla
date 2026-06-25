import { WordLookupPopup, type WordLookupPopupData } from '@/components/word-lookup-popup';
import { lookupVocabularyWord } from '@/lib/claude';
import { saveVocabularyWord, type VocabSource } from '@/lib/saved-vocabulary';
import {
  cleanSpanishToken,
  tokenizeSpanishText,
  tokensToPhrase,
  type SpanishToken,
} from '@/lib/spanish-tokenizer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

const palette = {
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  selectBg: 'rgba(96, 165, 250, 0.22)',
};

export type InteractiveSpanishSource = 'conversation' | 'reading';

type WordMark = 'none' | 'looked-up' | 'saved';

type Props = {
  text: string;
  source: InteractiveSpanishSource;
  style?: TextStyle;
  contextSentence?: string;
  textColor?: string;
};

function tokenKey(token: SpanishToken): string {
  return `${token.index}:${token.value.toLowerCase()}`;
}

function saveSource(source: InteractiveSpanishSource, isPhrase: boolean): VocabSource {
  if (isPhrase) return 'phrase';
  return source === 'reading' ? 'reading' : 'conversation';
}

export function InteractiveSpanishText({
  text,
  source,
  style,
  contextSentence,
  textColor,
}: Props) {
  const tokens = tokenizeSpanishText(text);
  const sentence = contextSentence ?? text;
  const wordRefs = useRef<Record<number, Text | null>>({});

  const [marks, setMarks] = useState<Record<string, WordMark>>({});
  const [phraseSelectAnchor, setPhraseSelectAnchor] = useState<number | null>(null);
  const [phraseSelectEnd, setPhraseSelectEnd] = useState<number | null>(null);
  const [popup, setPopup] = useState<
    (WordLookupPopupData & { phraseStart?: number; phraseEnd?: number }) | null
  >(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const measureWord = useCallback((wordIndex: number, callback: (x: number, y: number, w: number) => void) => {
    const ref = wordRefs.current[wordIndex];
    ref?.measureInWindow((x, y, width) => callback(x, y, width));
  }, []);

  const markRange = useCallback((start: number, end: number, mark: WordMark) => {
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    setMarks((prev) => {
      const next = { ...prev };
      for (const token of tokens) {
        if (token.type === 'word' && token.index >= lo && token.index <= hi) {
          next[tokenKey(token)] = mark;
        }
      }
      return next;
    });
  }, [tokens]);

  const openLookup = useCallback(
    async (
      spanish: string,
      wordIndex: number,
      isPhrase: boolean,
      phraseStart?: number,
      phraseEnd?: number,
    ) => {
      measureWord(wordIndex, (anchorX, anchorY, anchorWidth) => {
        setPopup({
          spanish,
          loading: true,
          anchorX,
          anchorY,
          anchorWidth,
          isPhrase,
          phraseStart,
          phraseEnd,
        });
        setPopupVisible(true);
      });

      try {
        const lookup = await lookupVocabularyWord(spanish, sentence);
        setPopup((prev) =>
          prev
            ? {
                ...prev,
                lookup,
                loading: false,
                spanish: lookup.spanish,
              }
            : null,
        );
      } catch {
        setPopup((prev) =>
          prev ? { ...prev, loading: false, error: 'Could not look up this word' } : null,
        );
      }
    },
    [measureWord, sentence],
  );

  const handleWordPress = useCallback(
    (token: SpanishToken) => {
      if (token.type !== 'word') return;
      const clean = cleanSpanishToken(token.value);
      if (!clean) return;

      if (phraseSelectAnchor != null) {
        const start = phraseSelectAnchor;
        const end = token.index;
        const phrase = tokensToPhrase(tokens, start, end);
        setPhraseSelectAnchor(null);
        setPhraseSelectEnd(null);
        void openLookup(phrase, token.index, true, start, end);
        return;
      }

      void openLookup(clean, token.index, false, token.index, token.index);
    },
    [openLookup, phraseSelectAnchor, tokens],
  );

  const handleWordLongPress = useCallback((token: SpanishToken) => {
    if (token.type !== 'word') return;
    if (phraseSelectAnchor != null) {
      setPhraseSelectAnchor(null);
      setPhraseSelectEnd(null);
      return;
    }
    setPhraseSelectAnchor(token.index);
    setPhraseSelectEnd(token.index);
  }, [phraseSelectAnchor]);

  const handleClose = useCallback(() => {
    if (popup && !popup.savedConfirmation && popup.lookup && !popup.loading) {
      const start = popup.phraseStart ?? 0;
      const end = popup.phraseEnd ?? start;
      markRange(start, end, 'looked-up');
    }

    setPopupVisible(false);
    setPopup(null);
    setPhraseSelectAnchor(null);
    setPhraseSelectEnd(null);
  }, [markRange, popup]);

  const handleSave = useCallback(async () => {
    if (!popup?.lookup) return;
    const isPhrase = popup.isPhrase;
    try {
      await saveVocabularyWord(popup.lookup.spanish, {
        source: saveSource(source, isPhrase),
        needsReview: true,
        english: popup.lookup.english,
        exampleSpanish: sentence,
        exampleEnglish: popup.lookup.exampleEnglish,
        partOfSpeech: popup.lookup.partOfSpeech,
        isPhrase,
      });

      const start = popup.phraseStart ?? 0;
      const end = popup.phraseEnd ?? start;
      markRange(start, end, 'saved');

      setPopup((prev) => (prev ? { ...prev, savedConfirmation: true } : null));
      closeTimerRef.current = setTimeout(() => {
        setPopupVisible(false);
        setPopup(null);
      }, 500);
    } catch {
      setPopup((prev) => (prev ? { ...prev, error: 'Could not save word' } : null));
    }
  }, [markRange, popup, sentence, source]);

  const isInPhraseSelection = (token: SpanishToken): boolean => {
    if (phraseSelectAnchor == null || token.type !== 'word') return false;
    const end = phraseSelectEnd ?? phraseSelectAnchor;
    const lo = Math.min(phraseSelectAnchor, end);
    const hi = Math.max(phraseSelectAnchor, end);
    return token.index >= lo && token.index <= hi;
  };

  const wordStyle = (token: SpanishToken): TextStyle => {
    if (token.type !== 'word') return {};
    const mark = marks[tokenKey(token)] ?? 'none';
    const selecting = isInPhraseSelection(token);
    const color = textColor ?? palette.text;
    if (selecting) {
      return {
        backgroundColor: palette.selectBg,
        borderRadius: 4,
        color,
      };
    }
    if (mark === 'saved') {
      return {
        color,
        textDecorationLine: 'underline',
        textDecorationColor: palette.accent,
      };
    }
    if (mark === 'looked-up') {
      return {
        color,
        textDecorationLine: 'underline',
        textDecorationColor: palette.muted,
      };
    }
    return { color };
  };

  return (
    <>
      <Text style={[styles.text, style]}>
        {tokens.map((token, i) =>
          token.type === 'word' ? (
            <Text
              key={`${token.value}-${i}`}
              ref={(r) => {
                wordRefs.current[token.index] = r;
              }}
              onPress={() => handleWordPress(token)}
              onLongPress={() => handleWordLongPress(token)}
              suppressHighlighting
              style={[styles.word, wordStyle(token)]}>
              {token.value}
            </Text>
          ) : (
            <Text key={`${token.value}-${i}`}>{token.value}</Text>
          ),
        )}
      </Text>

      {phraseSelectAnchor != null ? (
        <Text style={styles.phraseHint}>Tap another word to select a phrase</Text>
      ) : null}

      <WordLookupPopup
        visible={popupVisible}
        data={popup}
        onClose={handleClose}
        onSave={() => void handleSave()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: palette.text,
  },
  word: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: palette.text,
  },
  phraseHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    fontStyle: 'italic',
  },
});
