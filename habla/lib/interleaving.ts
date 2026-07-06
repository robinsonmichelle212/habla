import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getWeekDefinition,
  resolveGrammarCurriculum,
  TOTAL_CURRICULUM_WEEKS,
  type GrammarCurriculumState,
} from '@/lib/grammar-curriculum';
import {
  getCoveredVocabThemesFromStorage,
  VOCAB_THEMES,
  type VocabTheme,
} from '@/lib/lesson-focus';
import type { LessonHistoryEntry } from '@/lib/practice-storage';

const KEY_LAST_VOCAB_THEME = 'lastVocabTheme';

export type InterleavingContext = {
  currentVocabTheme: string | null;
  writingVocabTheme: string;
  previousVocabTheme: string | null;
  nextGrammarPreview: { weekNumber: number; topic: string } | null;
};

function isVocabTheme(value: string | null): value is VocabTheme {
  return !!value && (VOCAB_THEMES as readonly string[]).includes(value);
}

export async function getLastVocabTheme(): Promise<VocabTheme | null> {
  const raw = await AsyncStorage.getItem(KEY_LAST_VOCAB_THEME);
  return isVocabTheme(raw) ? raw : null;
}

function pickDifferentVocabTheme(current: VocabTheme | null): VocabTheme {
  const pool = current ? VOCAB_THEMES.filter((t) => t !== current) : [...VOCAB_THEMES];
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? VOCAB_THEMES[1];
}

export async function buildInterleavingContext(): Promise<InterleavingContext> {
  const [currentTheme, covered, curriculum] = await Promise.all([
    getLastVocabTheme(),
    getCoveredVocabThemesFromStorage(),
    resolveGrammarCurriculum(),
  ]);

  const writingTheme = pickDifferentVocabTheme(currentTheme);
  const previousTheme =
    covered.length >= 2
      ? covered[covered.length - 2]
      : covered.length === 1 && covered[0] !== currentTheme
        ? covered[0]
        : currentTheme
          ? VOCAB_THEMES[
              (VOCAB_THEMES.indexOf(currentTheme) - 1 + VOCAB_THEMES.length) % VOCAB_THEMES.length
            ]
          : null;

  const nextWeek = curriculum.currentWeek + 1;
  const nextGrammarPreview =
    nextWeek <= TOTAL_CURRICULUM_WEEKS
      ? { weekNumber: nextWeek, topic: getWeekDefinition(nextWeek).topic }
      : null;

  return {
    currentVocabTheme: currentTheme,
    writingVocabTheme: writingTheme,
    previousVocabTheme: previousTheme,
    nextGrammarPreview,
  };
}

export function buildMasteredPracticeArea(
  lessons: LessonHistoryEntry[],
  curriculum: GrammarCurriculumState,
): string {
  if (curriculum.completedWeeks.length > 0) {
    const lastCompleted = Math.max(...curriculum.completedWeeks);
    return getWeekDefinition(lastCompleted).topic;
  }

  const recent = lessons.slice(-8);
  for (const lesson of recent) {
    if (lesson.overallScore >= 75 && lesson.focusAreas[0]) {
      return lesson.focusAreas[0];
    }
  }

  for (const lesson of recent) {
    if (lesson.breakdown.grammar.score >= 75) {
      return lesson.breakdown.grammar.topic || 'Present tense';
    }
  }

  return 'Present tense';
}

export function buildInterleavedDrillPlan(
  weakAreas: { label: string }[],
  curriculum: GrammarCurriculumState,
  lessons: LessonHistoryEntry[],
  grammarTopicHint?: string,
): {
  primary: string;
  secondary: string;
  mastered: string;
  preview: string;
} {
  const primary = weakAreas[0]?.label ?? grammarTopicHint ?? curriculum.currentTopic;
  const secondary = weakAreas[1]?.label ?? weakAreas[0]?.label ?? 'General vocabulary';
  const mastered = buildMasteredPracticeArea(lessons, curriculum);
  const preview =
    curriculum.currentWeek < TOTAL_CURRICULUM_WEEKS
      ? getWeekDefinition(curriculum.currentWeek + 1).topic
      : curriculum.currentTopic;

  return { primary, secondary, mastered, preview };
}
