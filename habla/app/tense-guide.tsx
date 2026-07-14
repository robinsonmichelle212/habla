import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GRAMMAR_WEEK_DEFINITIONS,
  TOTAL_CURRICULUM_WEEKS,
  getWeekDefinition,
  type GrammarTopic,
} from '@/lib/grammar-curriculum';
import { getErrorDNA } from '@/lib/error-dna';
import { getErrorsForGrammarTopic, getTenseGuide } from '@/lib/tense-guide-content';
import { speakJavi } from '@/lib/javi-speech';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

function parseTopic(value: string | undefined): GrammarTopic | null {
  if (!value) return null;
  const week = parseInt(value, 10);
  if (Number.isFinite(week) && week >= 1 && week <= TOTAL_CURRICULUM_WEEKS) {
    return getWeekDefinition(week).topic;
  }
  const topics = GRAMMAR_WEEK_DEFINITIONS.map((w) => w.topic);
  return topics.includes(value as GrammarTopic) ? (value as GrammarTopic) : null;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TenseGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ week?: string; topic?: string }>();

  const topic = useMemo(
    () => parseTopic(params.topic) ?? parseTopic(params.week) ?? 'Present tense',
    [params.topic, params.week],
  );

  const weekNum = useMemo(() => {
    const w = parseInt(params.week ?? '', 10);
    return Number.isFinite(w) ? w : null;
  }, [params.week]);

  const guide = getTenseGuide(topic);
  const [personalErrors, setPersonalErrors] = useState<ReturnType<typeof getErrorsForGrammarTopic>>([]);
  const [loadingErrors, setLoadingErrors] = useState(true);

  useEffect(() => {
    void (async () => {
      const errors = await getErrorDNA();
      setPersonalErrors(getErrorsForGrammarTopic(errors, topic));
      setLoadingErrors(false);
    })();
  }, [topic]);

  const speakExample = (spanish: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void speakJavi(spanish);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Tense Guide 📖</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.topicTitle}>{topic}</Text>
        {weekNum ? <Text style={styles.weekMeta}>Week {weekNum}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When to use it</Text>
          <BulletList items={guide.whenToUse} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to form it</Text>
          <BulletList items={guide.howToForm} />
          <Text style={styles.subheading}>Most common irregular verbs</Text>
          <Text style={styles.chipRow}>{guide.irregularVerbs.join(' · ')}</Text>
          {guide.memoryTips.length ? (
            <>
              <Text style={styles.subheading}>Memory tips</Text>
              <BulletList items={guide.memoryTips} />
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common mistakes</Text>
          {loadingErrors ? (
            <ActivityIndicator color={palette.accent} />
          ) : personalErrors.length ? (
            personalErrors.slice(0, 5).map((err) => (
              <View key={err.error} style={styles.mistakeCard}>
                <Text style={styles.mistakePattern}>{err.error}</Text>
                {err.example ? <Text style={styles.mistakeExample}>You: {err.example}</Text> : null}
                {err.correction ? (
                  <Text style={styles.mistakeFix}>Better: {err.correction}</Text>
                ) : null}
                <Text style={styles.mistakeCount}>Seen {err.occurrences}×</Text>
              </View>
            ))
          ) : (
            <BulletList items={guide.commonMistakesGeneral} />
          )}
        </View>

        {guide.contrast ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{guide.contrast.title}</Text>
            <View style={styles.contrastGrid}>
              <View style={styles.contrastCol}>
                <Text style={styles.contrastHeading}>Preterite</Text>
                <BulletList items={guide.contrast.preterite} />
              </View>
              <View style={styles.contrastCol}>
                <Text style={styles.contrastHeading}>Imperfect</Text>
                <BulletList items={guide.contrast.imperfect} />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real examples</Text>
          <Text style={styles.sectionHint}>Tap any sentence to hear Javi speak it</Text>
          {guide.examples.map((ex) => (
            <Pressable
              key={ex.spanish}
              onPress={() => speakExample(ex.spanish)}
              style={({ pressed }) => [styles.exampleCard, pressed && styles.examplePressed]}
              accessibilityRole="button">
              <Text style={styles.exampleSpanish}>{ex.spanish}</Text>
              <Text style={styles.exampleEnglish}>{ex.english}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  back: { fontSize: 16, fontWeight: '700', color: palette.accent, minWidth: 72 },
  title: { fontSize: 17, fontWeight: '900', color: palette.text },
  headerSpacer: { minWidth: 72 },
  scroll: { padding: 20, gap: 18 },
  topicTitle: { fontSize: 24, fontWeight: '900', color: palette.text, lineHeight: 30 },
  weekMeta: { fontSize: 14, fontWeight: '600', color: palette.muted, marginTop: -10 },
  section: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHint: { fontSize: 12, fontWeight: '600', color: palette.muted },
  subheading: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    marginTop: 6,
  },
  chipRow: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
  },
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 16, fontWeight: '900', color: palette.accent, lineHeight: 22 },
  bulletText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 24,
  },
  mistakeCard: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 12,
    gap: 4,
  },
  mistakePattern: { fontSize: 15, fontWeight: '900', color: palette.text },
  mistakeExample: { fontSize: 14, fontWeight: '600', color: palette.muted },
  mistakeFix: { fontSize: 14, fontWeight: '700', color: palette.green },
  mistakeCount: { fontSize: 11, fontWeight: '700', color: palette.muted, marginTop: 2 },
  contrastGrid: { gap: 12 },
  contrastCol: {
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  contrastHeading: { fontSize: 14, fontWeight: '900', color: palette.text },
  exampleCard: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 6,
  },
  examplePressed: { opacity: 0.9 },
  exampleSpanish: { fontSize: 17, fontWeight: '800', color: palette.text, lineHeight: 24 },
  exampleEnglish: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
});
