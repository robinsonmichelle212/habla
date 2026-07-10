import { getPendingMilestoneQuizzes } from '@/lib/milestone-celebration-quiz';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
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

  if (!pending.length) {
    return (
      <Text style={styles.empty}>
        No celebration quizzes waiting — they appear after big milestones.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {pending.map((quiz) => (
        <Pressable
          key={quiz.id}
          onPress={() =>
            router.push(`/milestone-quiz?id=${encodeURIComponent(quiz.id)}` as Href)
          }
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{quiz.milestoneLabel}</Text>
            <Text style={styles.rowMeta}>
              {quiz.questionCount} questions · A celebration, not a test 🎉
            </Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 13, fontWeight: '600', color: palette.muted, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 12,
  },
  rowPressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: palette.text },
  rowMeta: { fontSize: 12, fontWeight: '600', color: palette.muted },
  chevron: { fontSize: 18, fontWeight: '800', color: palette.accent },
});
