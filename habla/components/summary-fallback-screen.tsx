import { buildFallbackScoreLines, type SafeSummaryPayload } from '@/lib/summary-safe-data';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
};

type Props = {
  payload: SafeSummaryPayload;
  onGoHome: () => void;
  showLaterNote?: boolean;
  title?: string;
};

export function SummaryFallbackScreen({
  payload,
  onGoHome,
  showLaterNote = true,
  title = 'Lesson Complete ✅',
}: Props) {
  const scores = buildFallbackScoreLines(payload);
  const strongAreas =
    payload.analysis.strongAreas?.length > 0
      ? payload.analysis.strongAreas
      : ['Good effort today'];
  const weakAreas =
    payload.analysis.weakAreas?.length > 0 ? payload.analysis.weakAreas : ['Keep practising'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Your scores have been saved.</Text>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLine}>{scores.overall}</Text>
          <Text style={styles.scoreLine}>{scores.grammar}</Text>
          <Text style={styles.scoreLine}>{scores.vocabulary}</Text>
          <Text style={styles.scoreLine}>{scores.fluency}</Text>
          <Text style={styles.scoreLine}>{scores.writing}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Strong areas</Text>
          {strongAreas.map((item, idx) => (
            <Text key={`s-${idx}`} style={styles.bullet}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Areas to practise</Text>
          {weakAreas.map((item, idx) => (
            <Text key={`w-${idx}`} style={styles.bullet}>
              • {item}
            </Text>
          ))}
        </View>

        {showLaterNote ? (
          <Text style={styles.laterNote}>
            View full summary later from Home or Progress → View last summary.
          </Text>
        ) : null}

        <Pressable
          onPress={onGoHome}
          style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to home">
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  scoreCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 8,
  },
  scoreLine: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 20,
  },
  laterNote: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  homeButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  homeButtonPressed: { backgroundColor: palette.accentPressed },
  homeButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B0F14',
  },
});
