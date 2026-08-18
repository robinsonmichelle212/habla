import {
  CELEBRATION_QUIZ_CATALOG,
  getPendingMilestoneQuizzes,
} from '@/lib/milestone-celebration-quiz';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
};

export function MilestoneQuizPendingSection() {
  const router = useRouter();
  const [pending, setPending] = useState<Awaited<ReturnType<typeof getPendingMilestoneQuizzes>>>([]);

  useFocusEffect(
    useCallback(() => {
      void getPendingMilestoneQuizzes().then(setPending);
    }, []),
  );

  const pendingByTrigger = useMemo(() => {
    const map = new Map<string, (typeof pending)[number]>();
    for (const quiz of pending) {
      map.set(quiz.triggerId, quiz);
    }
    return map;
  }, [pending]);

  return (
    <View style={styles.wrap}>
      {CELEBRATION_QUIZ_CATALOG.map((item) => {
        const ready = pendingByTrigger.get(item.triggerId);
        return (
          <Pressable
            key={item.triggerId}
            disabled={!ready}
            onPress={() => {
              if (!ready) return;
              router.push(`/milestone-quiz?id=${encodeURIComponent(ready.id)}` as Href);
            }}
            style={({ pressed }) => [
              styles.row,
              ready && styles.rowReady,
              pressed && ready && styles.rowPressed,
            ]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {item.emoji} {item.label}
              </Text>
              <Text style={styles.rowMeta}>{item.description}</Text>
              {ready ? (
                <Text style={styles.readyText}>
                  Ready now · {ready.questionCount} questions 🎉
                </Text>
              ) : (
                <Text style={styles.waitText}>Unlocks at the matching milestone</Text>
              )}
            </View>
            {ready ? <Text style={styles.chevron}>→</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 12,
    opacity: 0.88,
  },
  rowReady: {
    opacity: 1,
    borderColor: 'rgba(255, 122, 89, 0.35)',
  },
  rowPressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: palette.text },
  rowMeta: { fontSize: 12, fontWeight: '600', color: palette.muted, lineHeight: 17 },
  readyText: { fontSize: 12, fontWeight: '800', color: palette.accent, marginTop: 2 },
  waitText: { fontSize: 12, fontWeight: '600', color: palette.muted, marginTop: 2 },
  chevron: { fontSize: 18, fontWeight: '800', color: palette.accent },
});
