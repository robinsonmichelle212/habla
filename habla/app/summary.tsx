import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.12)',
  amber: '#FBBF24',
  amberBg: 'rgba(251, 191, 36, 0.12)',
  blue: '#60A5FA',
  blueBg: 'rgba(96, 165, 250, 0.12)',
};

/** Placeholder score out of 100 */
const TODAYS_SCORE_PERCENT = 87;

export default function SummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Lesson Complete</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strong Areas ✅</Text>
          <View style={[styles.item, styles.itemGreen]}>
            <Text style={[styles.itemText, styles.textGreen]}>Present tense conjugations</Text>
          </View>
          <View style={[styles.item, styles.itemGreen]}>
            <Text style={[styles.itemText, styles.textGreen]}>Basic greetings & introductions</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weak Areas ⚠️</Text>
          <View style={[styles.item, styles.itemAmber]}>
            <Text style={[styles.itemText, styles.textAmber]}>Subjunctive mood in conversation</Text>
          </View>
          <View style={[styles.item, styles.itemAmber]}>
            <Text style={[styles.itemText, styles.textAmber]}>Por vs. para in context</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Tomorrow 🎯</Text>
          <View style={[styles.item, styles.itemBlue]}>
            <Text style={[styles.itemText, styles.textBlue]}>Review irregular verb patterns</Text>
          </View>
        </View>

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>{"Today's score"}</Text>
          <Text style={styles.scoreValue}>{TODAYS_SCORE_PERCENT}%</Text>
          <Text style={styles.scoreHint}>out of 100</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={goHome}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to home">
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreBlock: {
    alignItems: 'center',
    marginBottom: 28,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -1,
  },
  scoreHint: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.muted,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 10,
  },
  item: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  itemGreen: {
    backgroundColor: palette.greenBg,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  itemAmber: {
    backgroundColor: palette.amberBg,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  itemBlue: {
    backgroundColor: palette.blueBg,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  textGreen: {
    color: palette.green,
  },
  textAmber: {
    color: palette.amber,
  },
  textBlue: {
    color: palette.blue,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceBorder,
    backgroundColor: palette.background,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  primaryButtonPressed: {
    backgroundColor: palette.accentPressed,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0F14',
    letterSpacing: 0.2,
  },
});
