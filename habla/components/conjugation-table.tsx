import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { speakJavi } from '@/lib/javi-speech';
import type { ConjugationTenseTable, VerbConjugationEntry } from '@/lib/conjugation-data';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

type Props = {
  verb: VerbConjugationEntry;
  compact?: boolean;
};

function speakForm(form: string) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  void speakJavi(form);
}

function TenseGrid({ table }: { table: ConjugationTenseTable }) {
  return (
    <View style={styles.tenseBlock}>
      <Text style={styles.tenseTitle}>{table.tenseLabel}</Text>
      <View style={styles.grid}>
        <View style={[styles.gridRow, styles.gridHeader]}>
          <Text style={[styles.cell, styles.headerCell, styles.personCol]}>Person</Text>
          <Text style={[styles.cell, styles.headerCell, styles.formCol]}>Form</Text>
        </View>
        {table.forms.map((row) => (
          <View key={`${table.tenseKey}-${row.person}`} style={styles.gridRow}>
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
          </View>
        ))}
      </View>
    </View>
  );
}

export function ConjugationTableCard({ verb, compact = false }: Props) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.verbName}>{verb.infinitive}</Text>
          <Text style={styles.english}>{verb.english}</Text>
        </View>
        <View style={[styles.badge, verb.regular ? styles.badgeRegular : styles.badgeIrregular]}>
          <Text style={styles.badgeText}>{verb.regular ? 'Regular' : 'Irregular'}</Text>
        </View>
      </View>
      {verb.regionNote ? <Text style={styles.regionNote}>{verb.regionNote}</Text> : null}
      <Text style={styles.regionHint}>
        Spain: vosotros forms · Argentina: vos forms shown in brackets on tú row
      </Text>
      {verb.tenses.map((table) => (
        <TenseGrid key={`${verb.infinitive}-${table.tenseKey}`} table={table} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 12,
  },
  cardCompact: { padding: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, gap: 4 },
  verbName: { fontSize: 22, fontWeight: '900', color: palette.text },
  english: { fontSize: 15, fontWeight: '600', color: palette.muted },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeRegular: { backgroundColor: 'rgba(52, 211, 153, 0.15)' },
  badgeIrregular: { backgroundColor: 'rgba(255, 122, 89, 0.15)' },
  badgeText: { fontSize: 11, fontWeight: '900', color: palette.text },
  regionNote: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.accent,
    lineHeight: 18,
  },
  regionHint: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 17,
  },
  tenseBlock: { gap: 8 },
  tenseTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.accent,
    marginTop: 4,
  },
  grid: {
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  gridHeader: { backgroundColor: palette.background },
  cell: { paddingVertical: 12, paddingHorizontal: 10 },
  headerCell: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  personCol: { width: '34%' },
  formCol: { flex: 1 },
  personText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.muted,
  },
  formPressable: { justifyContent: 'center' },
  formText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  irregularForm: { color: palette.accent },
  argentinaNote: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 2,
  },
});
