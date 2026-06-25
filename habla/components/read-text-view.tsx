import { InteractiveSpanishText } from '@/components/interactive-spanish-text';
import { StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
};

type Props = {
  text: string;
  title?: string;
  textTypeLabel?: string;
};

export function ReadTextView({ text, title, textTypeLabel }: Props) {
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {textTypeLabel ? <Text style={styles.typeLabel}>{textTypeLabel}</Text> : null}

      <View style={styles.textBlock}>
        <InteractiveSpanishText text={text} source="reading" style={styles.textLine} contextSentence={text} />
      </View>

      <Text style={styles.hint}>Tap any word for its meaning · long press to select a phrase</Text>
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
    lineHeight: 30,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
});
