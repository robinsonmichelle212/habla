import { GrammarCurriculumSection } from '@/components/grammar-curriculum-section';
import {
  getArchivedErrorDNA,
  getErrorDNA,
} from '@/lib/error-dna';
import {
  resolveGrammarCurriculum,
  resetGrammarCurriculum,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import { getLessonHistory } from '@/lib/practice-storage';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ResetCurriculumModal } from '@/components/reset-curriculum-modal';

const palette = {
  background: '#0B0F14',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

export default function GrammarCurriculumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [curriculum, setCurriculum] = useState<GrammarCurriculumState | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [errors, setErrors] = useState<Awaited<ReturnType<typeof getErrorDNA>>>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const [lessonHistory, curriculumState, activeErrors] = await Promise.all([
            getLessonHistory(),
            resolveGrammarCurriculum(),
            getErrorDNA(),
          ]);
          if (cancelled) return;
          setHistory(lessonHistory);
          setCurriculum(curriculumState);
          setErrors(activeErrors);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleReset = () => setShowResetModal(true);

  const confirmReset = () => {
    setShowResetModal(false);
    void resetGrammarCurriculum().then((state) => {
      setCurriculum(state);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2500);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Grammar Curriculum 📚</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}>
          {resetSuccess ? (
            <View style={styles.resetSuccessBanner}>
              <Text style={styles.resetSuccessText}>Curriculum reset to Week 1 ✅</Text>
            </View>
          ) : null}

          {curriculum ? (
            <GrammarCurriculumSection
              curriculum={curriculum}
              history={history}
              errors={errors}
              onReset={handleReset}
              hideOuterTitle
            />
          ) : null}
        </ScrollView>
      )}

      <ResetCurriculumModal
        visible={showResetModal}
        onConfirm={confirmReset}
        onCancel={() => setShowResetModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  backBtn: { width: 72 },
  backText: { fontSize: 16, fontWeight: '700', color: palette.accent },
  headerTitle: { fontSize: 17, fontWeight: '900', color: palette.text },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  resetSuccessBanner: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  resetSuccessText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.green,
  },
});
