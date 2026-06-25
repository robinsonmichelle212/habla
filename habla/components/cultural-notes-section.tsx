import { getCulturalNotes, type CulturalNote } from '@/lib/cultural-notes';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  amber: '#FBBF24',
};

export function CulturalNotesSection() {
  const [notes, setNotes] = useState<CulturalNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCulturalNotes()
      .then((items) => {
        if (!cancelled) setNotes(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cultural Notes 🌍</Text>
        <ActivityIndicator color={palette.muted} />
      </View>
    );
  }

  if (!notes.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cultural Notes 🌍</Text>
        <Text style={styles.emptyText}>
          Complete Read with Javi lessons to build your personal encyclopedia of Spanish culture.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cultural Notes 🌍</Text>
      <Text style={styles.subtitle}>{notes.length} notes collected</Text>
      {notes.slice(0, 8).map((note) => (
        <View key={note.id} style={styles.noteRow}>
          <Text style={styles.noteMeta}>
            {note.textType} · {note.date}
          </Text>
          <Text style={styles.noteTopic}>{note.topic}</Text>
          <Text style={styles.noteText}>{note.text}</Text>
        </View>
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
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '900', color: palette.text },
  subtitle: { fontSize: 13, fontWeight: '700', color: palette.muted },
  emptyText: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
  noteRow: {
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    paddingTop: 12,
    gap: 4,
  },
  noteMeta: { fontSize: 11, fontWeight: '800', color: palette.amber, textTransform: 'uppercase' },
  noteTopic: { fontSize: 14, fontWeight: '800', color: palette.text },
  noteText: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
});
