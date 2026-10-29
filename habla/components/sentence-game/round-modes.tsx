import { AppTextInput } from '@/components/app-text-input';
import { BLANK_MARKER, type GameRound } from '@/components/sentence-game/types';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  bubbleAi: '#1E2633',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
  ink: '#0B0F14',
};

type Feedback = 'correct' | 'incorrect' | null;

type SharedProps = {
  round: GameRound;
  locked: boolean;
  feedback: Feedback;
  onSubmit: (answer: string) => void;
};

function splitTemplate(template: string): { before: string; after: string } {
  const parts = template.split(BLANK_MARKER);
  return { before: parts[0] ?? '', after: parts.slice(1).join(BLANK_MARKER) };
}

function OptionChips({
  options,
  selected,
  locked,
  feedback,
  correctAnswer,
  onSelect,
}: {
  options: string[];
  selected: string | null;
  locked: boolean;
  feedback: Feedback;
  correctAnswer: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const isSelected = selected === option;
        const isCorrectOption = option === correctAnswer;
        const showCorrect = feedback === 'incorrect' && isCorrectOption;
        const showWrongPick = feedback === 'incorrect' && isSelected && !isCorrectOption;
        const showRightPick = feedback === 'correct' && isSelected;

        return (
          <Pressable
            key={option}
            disabled={locked}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && !feedback && styles.chipSelected,
              showRightPick && styles.chipCorrect,
              showCorrect && styles.chipCorrect,
              showWrongPick && styles.chipWrong,
              pressed && !locked && styles.pressed,
            ]}>
            <Text
              style={[
                styles.chipText,
                (isSelected || showCorrect || showRightPick) && styles.chipTextActive,
              ]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SentenceBlank({
  template,
  filled,
  highlight,
}: {
  template: string;
  filled: string | null;
  highlight: boolean;
}) {
  const { before, after } = splitTemplate(template);
  return (
    <Text style={styles.sentence}>
      {before}
      <Text style={[styles.blank, highlight && styles.blankHighlight, filled && styles.blankFilled]}>
        {filled ?? '_____'}
      </Text>
      {after}
    </Text>
  );
}

export function SlotRound({ round, locked, feedback, onSubmit }: SharedProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = round.options ?? [];
  const template = round.sentenceTemplate ?? `{{blank}}`;

  return (
    <View style={styles.card}>
      <SentenceBlank template={template} filled={selected} highlight />
      <OptionChips
        options={options}
        selected={selected}
        locked={locked}
        feedback={feedback}
        correctAnswer={round.correctAnswer}
        onSelect={(value) => {
          setSelected(value);
          onSubmit(value);
        }}
      />
    </View>
  );
}

export function SwapRound({ round, locked, feedback, onSubmit }: SharedProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const options = round.options ?? [];
  const template = round.sentenceTemplate ?? `{{blank}}`;
  const filled = selected ?? (typed.trim() ? typed.trim() : null);

  const submitTyped = () => {
    const value = typed.trim();
    if (!value || locked) return;
    setSelected(value);
    onSubmit(value);
  };

  return (
    <View style={styles.card}>
      <SentenceBlank template={template} filled={filled} highlight />
      {options.length > 0 ? (
        <OptionChips
          options={options}
          selected={selected}
          locked={locked}
          feedback={feedback}
          correctAnswer={round.correctAnswer}
          onSelect={(value) => {
            setSelected(value);
            setTyped(value);
            onSubmit(value);
          }}
        />
      ) : null}
      <View style={styles.typeRow}>
        <AppTextInput
          value={typed}
          onChangeText={setTyped}
          editable={!locked}
          placeholder="Type the verb…"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submitTyped}
          style={styles.typeInput}
        />
        <Pressable
          disabled={locked || !typed.trim()}
          onPress={submitTyped}
          style={({ pressed }) => [
            styles.typeBtn,
            (!typed.trim() || locked) && styles.disabled,
            pressed && !locked && styles.pressed,
          ]}>
          <Text style={styles.typeBtnText}>Listo</Text>
        </Pressable>
      </View>
    </View>
  );
}

type TileToken = { key: string; text: string };

export function TilesRound({ round, locked, feedback, onSubmit }: SharedProps) {
  const initial = useMemo<TileToken[]>(
    () => (round.tiles ?? []).map((text, index) => ({ key: `${index}-${text}`, text })),
    [round.tiles],
  );
  const [bank, setBank] = useState<TileToken[]>(initial);
  const [built, setBuilt] = useState<TileToken[]>([]);

  const place = (token: TileToken) => {
    if (locked) return;
    const nextBank = bank.filter((t) => t.key !== token.key);
    const nextBuilt = [...built, token];
    setBank(nextBank);
    setBuilt(nextBuilt);
    if (nextBank.length === 0) {
      onSubmit(nextBuilt.map((t) => t.text).join(' '));
    }
  };

  const unplace = (token: TileToken) => {
    if (locked) return;
    setBuilt((prev) => prev.filter((t) => t.key !== token.key));
    setBank((prev) => [...prev, token]);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.buildRow, feedback === 'correct' && styles.buildCorrect, feedback === 'incorrect' && styles.buildWrong]}>
        {built.length === 0 ? (
          <Text style={styles.buildPlaceholder}>Tap tiles to build the sentence</Text>
        ) : (
          built.map((token) => (
            <Pressable
              key={token.key}
              disabled={locked}
              onPress={() => unplace(token)}
              style={styles.placedTile}>
              <Text style={styles.placedTileText}>{token.text}</Text>
            </Pressable>
          ))
        )}
      </View>
      <View style={styles.chipRow}>
        {bank.map((token) => (
          <Pressable
            key={token.key}
            disabled={locked}
            onPress={() => place(token)}
            style={({ pressed }) => [styles.chip, pressed && !locked && styles.pressed]}>
            <Text style={styles.chipText}>{token.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 16,
  },
  sentence: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    color: palette.text,
  },
  blank: {
    color: palette.muted,
    fontWeight: '800',
  },
  blankHighlight: {
    color: palette.accent,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 122, 89, 0.55)',
  },
  blankFilled: {
    color: palette.text,
    textDecorationLine: 'none',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 122, 89, 0.08)',
  },
  chipSelected: {
    backgroundColor: 'rgba(255, 122, 89, 0.22)',
    borderColor: palette.accent,
  },
  chipCorrect: {
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    borderColor: palette.green,
  },
  chipWrong: {
    backgroundColor: 'rgba(248, 113, 113, 0.14)',
    borderColor: 'rgba(248, 113, 113, 0.7)',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.accent,
  },
  chipTextActive: {
    color: palette.text,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  typeInput: {
    flex: 1,
    backgroundColor: palette.bubbleAi,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
    fontWeight: '600',
  },
  typeBtn: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.ink,
  },
  buildRow: {
    minHeight: 72,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    backgroundColor: palette.bubbleAi,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
  },
  buildCorrect: {
    borderColor: palette.green,
  },
  buildWrong: {
    borderColor: 'rgba(248, 113, 113, 0.7)',
  },
  buildPlaceholder: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  placedTile: {
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placedTileText: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
});
