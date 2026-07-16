import { clearCrashLog, getCrashLog, type CrashBreadcrumb } from '@/lib/crash-breadcrumb';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  red: '#F87171',
};

export default function CrashLogScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CrashBreadcrumb[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await getCrashLog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Crash breadcrumbs</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Last step before a crash is the likely failure point. Newest entries at the bottom.
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>No breadcrumbs yet. Complete a lesson to populate.</Text>
          ) : (
            entries.map((entry, idx) => (
              <View
                key={`${entry.timestamp}-${idx}`}
                style={[styles.row, idx === entries.length - 1 && styles.rowLast]}>
                <Text style={styles.step}>{entry.step}</Text>
                <Text style={styles.time}>{entry.timestamp}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable onPress={() => void reload()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Refresh</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void clearCrashLog().then(reload);
          }}
          style={styles.dangerBtn}>
          <Text style={styles.dangerText}>Clear log</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  title: { fontSize: 18, fontWeight: '900', color: palette.text },
  close: { fontSize: 22, fontWeight: '700', color: palette.muted, padding: 4 },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    lineHeight: 18,
  },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  empty: { fontSize: 14, fontWeight: '600', color: palette.muted, marginTop: 12 },
  row: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
  },
  rowLast: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.1)',
  },
  step: { fontSize: 14, fontWeight: '800', color: palette.text },
  time: { fontSize: 11, fontWeight: '600', color: palette.muted, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 14, fontWeight: '800', color: palette.text },
  dangerBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerText: { fontSize: 14, fontWeight: '800', color: palette.red },
});
