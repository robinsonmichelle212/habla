import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  filterOutLockedGrammar,
  isLockedGrammarLabel,
  unlockedTopicsForWeek,
} from '@/lib/curriculum-drill-gate';
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
  const week = curriculum.currentWeek || 1;
  const unlocked = unlockedTopicsForWeek(week);
  const fallback =
    unlocked.length > 1 ? unlocked[unlocked.length - 2] : curriculum.currentTopic || 'Present tense';

  if (curriculum.completedWeeks.length > 0) {
    const completedUnlocked = curriculum.completedWeeks
      .filter((w) => w <= week)
      .sort((a, b) => b - a);
    for (const completedWeek of completedUnlocked) {
      const topic = getWeekDefinition(completedWeek).topic;
      if (!isLockedGrammarLabel(topic, week)) return topic;
    }
  }

  const recent = lessons.slice(-8);
  for (const lesson of recent) {
    if (!lesson.placeholder && (lesson.overallScore ?? 0) >= 75 && lesson.focusAreas[0]) {
      if (!isLockedGrammarLabel(lesson.focusAreas[0], week)) {
        return lesson.focusAreas[0];
      }
    }
  }

  for (const lesson of recent) {
    if (lesson.breakdown.grammar.score >= 75) {
      const topic = lesson.breakdown.grammar.topic || fallback;
      if (!isLockedGrammarLabel(topic, week)) return topic;
    }
  }

  return fallback;
}

export function buildInterleavedDrillPlan(
  weakAreas: { label: string }[],
  curriculum: GrammarCurriculumState,
  lessons: LessonHistoryEntry[],
  grammarTopicHint?: string,
  coveredVocabThemes: string[] = [],
): {
  primary: string;
  secondary: string;
  mastered: string;
  preview: string;
} {
  const week = curriculum.currentWeek || 1;
  const currentTopic = curriculum.currentTopic || getWeekDefinition(week).topic;
  const unlocked = unlockedTopicsForWeek(week);
  const safeWeak = filterOutLockedGrammar(
    weakAreas.map((w) => w.label).filter(Boolean),
    week,
    currentTopic,
  );

  const primary =
    filterOutLockedGrammar(
      [safeWeak[0], grammarTopicHint, currentTopic].filter(Boolean) as string[],
      week,
      currentTopic,
    )[0] ?? currentTopic;

  const previousUnlocked =
    unlocked.length > 1 ? unlocked[unlocked.length - 2] : unlocked[0] ?? currentTopic;

  const secondary =
    filterOutLockedGrammar(
      [safeWeak[1], safeWeak[0], previousUnlocked].filter(Boolean) as string[],
      week,
      previousUnlocked,
    ).find((label) => label !== primary) ?? previousUnlocked;

  const mastered = filterOutLockedGrammar(
    [buildMasteredPracticeArea(lessons, curriculum)],
    week,
    previousUnlocked,
  )[0];

  // Never preview next week's (possibly locked) grammar — use covered vocab for the 20% slot.
  const vocabTheme =
    coveredVocabThemes[coveredVocabThemes.length - 1] ??
    coveredVocabThemes[0] ??
    VOCAB_THEMES[0];
  const preview = `Vocabulary: ${vocabTheme}`;

  return { primary, secondary, mastered, preview };
}
