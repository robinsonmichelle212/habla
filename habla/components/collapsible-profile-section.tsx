import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

const palette = {
  text: '#F4F6F8',
  muted: '#8B95A5',
  surfaceBorder: '#252D3A',
};

type Props = {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function CollapsibleProfileSection({
  title,
  summary,
  expanded,
  onToggle,
  children,
  style,
}: Props) {
  return (
    <View style={[styles.section, style]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <View style={styles.headerMain}>
          <Text style={styles.title}>{title}</Text>
          {!expanded ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text style={styles.chevron}>{expanded ? '▼' : '›'}</Text>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151B24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
  },
  headerPressed: { opacity: 0.92 },
  headerMain: { flex: 1, gap: 4 },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 22,
  },
  summary: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.muted,
    width: 20,
    textAlign: 'center',
  },
  body: { marginTop: 10 },
});
