import type { ErrorDNAItem } from '@/lib/error-dna';
import type { LessonHistoryEntry, PriorityWeakArea } from '@/lib/practice-storage';

export type PracticeDrillKind = 'grammar' | 'vocabulary' | 'fluency' | 'word-order';

export type DrillSelection = {
  drill: PracticeDrillKind;
  topicLabel: string;
  reason: string;
};

export const DRILL_OVERRIDE_OPTIONS: {
  id: PracticeDrillKind;
  label: string;
  emoji: string;
}[] = [
  { id: 'grammar', label: 'Grammar', emoji: '📐' },
  { id: 'vocabulary', label: 'Vocabulary', emoji: '📚' },
  { id: 'fluency', label: 'Fluency', emoji: '🗣️' },
  { id: 'word-order', label: 'Word Order', emoji: '🔀' },
];

const ROTATION_ORDER: PracticeDrillKind[] = ['grammar', 'vocabulary', 'fluency', 'word-order'];

function classifyWeakArea(label: string): 'grammar' | 'vocabulary' | 'fluency' | 'structure' {
  const lower = label.toLowerCase();
  if (/vocab|word choice|lexical|words?\b|theme/i.test(lower)) return 'vocabulary';
  if (/fluency|flow|natural|rhythm|speaking/i.test(lower)) return 'fluency';
  if (/word order|structure|syntax|sentence order|clause/i.test(lower)) return 'structure';
  return 'grammar';
}

function averageSkillScores(lessons: LessonHistoryEntry[]): Record<string, number> | null {
  if (!lessons.length) return null;
  let grammar = 0;
  let vocabulary = 0;
  let fluency = 0;
  let writing = 0;
  for (const lesson of lessons) {
    grammar += lesson.breakdown.grammar.score;
    vocabulary += lesson.breakdown.vocabulary.score;
    fluency += lesson.breakdown.fluency.score;
    writing += lesson.breakdown.writing.score;
  }
  const n = lessons.length;
  return {
    grammar: grammar / n,
    vocabulary: vocabulary / n,
    fluency: fluency / n,
    writing: writing / n,
  };
}

function scoresAreSimilar(scores: Record<string, number>, threshold = 5): boolean {
  const values = Object.values(scores);
  return Math.max(...values) - Math.min(...values) <= threshold;
}

function rotateDrill(rotateIndex: number): PracticeDrillKind {
  return ROTATION_ORDER[((rotateIndex % ROTATION_ORDER.length) + ROTATION_ORDER.length) % ROTATION_ORDER.length];
}

function formatWeakAreaReason(label: string, kind: 'grammar' | 'vocabulary'): string {
  const area = label.toLowerCase();
  if (kind === 'grammar') {
    return `Your ${area} need work based on your last 3 lessons.`;
  }
  return `Your vocabulary in ${area} needs practice based on your last 3 lessons.`;
}

export function selectPracticeDrill(input: {
  weakAreas: PriorityWeakArea[];
  recentLessons: LessonHistoryEntry[];
  wordOrderErrors: ErrorDNAItem[];
  rotateIndex?: number;
  grammarTopicHint?: string;
}): DrillSelection {
  const { weakAreas, recentLessons, wordOrderErrors, rotateIndex = 0, grammarTopicHint } = input;
  const topWeak = weakAreas[0];
  const scores = averageSkillScores(recentLessons);

  if (wordOrderErrors.length > 0) {
    const pattern = wordOrderErrors[0]?.error;
    return {
      drill: 'word-order',
      topicLabel: 'Word order drill',
      reason: pattern
        ? `Your "${pattern.toLowerCase()}" patterns need work based on your recurring errors.`
        : 'Your word order patterns need work based on your recurring errors.',
    };
  }

  if (topWeak) {
    const kind = classifyWeakArea(topWeak.label);
    if (kind === 'structure') {
      return {
        drill: 'word-order',
        topicLabel: 'Word order drill',
        reason: `Your ${topWeak.label.toLowerCase()} need work based on your last 3 lessons.`,
      };
    }
    if (kind === 'grammar') {
      const detail = grammarTopicHint ?? topWeak.label;
      return {
        drill: 'grammar',
        topicLabel: `Grammar drill · ${detail}`,
        reason: formatWeakAreaReason(topWeak.label, 'grammar'),
      };
    }
    if (kind === 'vocabulary') {
      return {
        drill: 'vocabulary',
        topicLabel: 'Vocabulary drill',
        reason: formatWeakAreaReason(topWeak.label, 'vocabulary'),
      };
    }
    if (kind === 'fluency') {
      return {
        drill: 'fluency',
        topicLabel: 'Fluency drill',
        reason: `Your ${topWeak.label.toLowerCase()} needs work based on your last 3 lessons.`,
      };
    }
  }

  if (scores && !scoresAreSimilar(scores)) {
    const fluency = scores.fluency;
    const others = [scores.grammar, scores.vocabulary, scores.writing];
    if (fluency < Math.min(...others)) {
      return {
        drill: 'fluency',
        topicLabel: 'Fluency drill',
        reason: 'Your fluency score is your lowest skill in recent lessons — let\'s build natural flow.',
      };
    }
  }

  if (scores && scoresAreSimilar(scores)) {
    const drill = rotateDrill(rotateIndex);
    const labels: Record<PracticeDrillKind, string> = {
      grammar: grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill',
      vocabulary: 'Vocabulary drill',
      fluency: 'Fluency drill',
      'word-order': 'Word order drill',
    };
    return {
      drill,
      topicLabel: labels[drill],
      reason: 'Your recent scores are balanced — rotating drills to keep every skill sharp.',
    };
  }

  if (!weakAreas.length) {
    return {
      drill: 'grammar',
      topicLabel: grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill',
      reason: 'Complete more lessons for targeted practice — starting with grammar fundamentals.',
    };
  }

  const drill = rotateDrill(rotateIndex);
  const topicLabels: Record<PracticeDrillKind, string> = {
    grammar: grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill',
    vocabulary: 'Vocabulary drill',
    fluency: 'Fluency drill',
    'word-order': 'Word order drill',
  };
  return {
    drill,
    topicLabel: topicLabels[drill],
    reason: `Javi picked a ${drill.replace('-', ' ')} drill based on your recent lessons.`,
  };
}

export function drillSelectionForOverride(
  drill: PracticeDrillKind,
  grammarTopicHint?: string,
): Pick<DrillSelection, 'topicLabel' | 'reason'> {
  switch (drill) {
    case 'grammar':
      return {
        topicLabel: grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill',
        reason: 'You chose to focus on grammar today.',
      };
    case 'vocabulary':
      return { topicLabel: 'Vocabulary drill', reason: 'You chose to focus on vocabulary today.' };
    case 'fluency':
      return { topicLabel: 'Fluency drill', reason: 'You chose to focus on fluency today.' };
    case 'word-order':
      return { topicLabel: 'Word order drill', reason: 'You chose to focus on word order today.' };
  }
}
