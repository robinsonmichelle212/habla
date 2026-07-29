import type { ErrorDNAItem } from '@/lib/error-dna';
import type { LessonHistoryEntry, PriorityWeakArea } from '@/lib/practice-storage';

export type PracticeDrillKind = 'grammar' | 'writing' | 'fluency' | 'word-order';

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
  { id: 'grammar', label: 'Grammar', emoji: '📚' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'fluency', label: 'Fluency', emoji: '🗣️' },
  { id: 'word-order', label: 'Word Order', emoji: '🔀' },
];

export const DRILL_KIND_EMOJI: Record<PracticeDrillKind, string> = {
  grammar: '📚',
  writing: '✍️',
  fluency: '🗣️',
  'word-order': '🔀',
};

export function drillDisplayTitle(drill: PracticeDrillKind, grammarTopicHint?: string): string {
  switch (drill) {
    case 'grammar':
      return grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill';
    case 'writing':
      return 'Writing drill ✍️';
    case 'fluency':
      return 'Fluency drill';
    case 'word-order':
      return 'Word order drill';
  }
}

const ROTATION_ORDER: PracticeDrillKind[] = ['grammar', 'writing', 'fluency', 'word-order'];

function classifyWeakArea(label: string): 'grammar' | 'writing' | 'fluency' | 'structure' {
  const lower = label.toLowerCase();
  if (/writ|rewrite|compose|producti|vocab|word choice|lexical|words?\b|theme/i.test(lower)) {
    return 'writing';
  }
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

function formatWeakAreaReason(label: string, kind: 'grammar' | 'writing'): string {
  const area = label.toLowerCase();
  if (kind === 'grammar') {
    return `Your ${area} need work based on your last 3 lessons.`;
  }
  return `Your writing in ${area} needs practice based on your last 3 lessons.`;
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
    if (kind === 'writing') {
      return {
        drill: 'writing',
        topicLabel: 'Writing drill ✍️',
        reason: formatWeakAreaReason(topWeak.label, 'writing'),
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
    const writingCombined = Math.min(scores.writing, scores.vocabulary);
    const fluency = scores.fluency;
    const others = [scores.grammar, writingCombined];
    if (fluency < Math.min(...others, writingCombined)) {
      return {
        drill: 'fluency',
        topicLabel: 'Fluency drill',
        reason: 'Your fluency score is your lowest skill in recent lessons — let\'s build natural flow.',
      };
    }
    if (writingCombined < scores.grammar && writingCombined < fluency) {
      return {
        drill: 'writing',
        topicLabel: 'Writing drill ✍️',
        reason: 'Your writing score needs practice based on recent lessons — time pressure builds fluency.',
      };
    }
  }

  if (scores && scoresAreSimilar(scores)) {
    const drill = rotateDrill(rotateIndex);
    const labels: Record<PracticeDrillKind, string> = {
      grammar: grammarTopicHint ? `Grammar drill · ${grammarTopicHint}` : 'Grammar drill',
      writing: 'Writing drill ✍️',
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
    writing: 'Writing drill ✍️',
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
        topicLabel: drillDisplayTitle('grammar', grammarTopicHint),
        reason: 'Javi will target your grammar patterns.',
      };
    case 'writing':
      return {
        topicLabel: drillDisplayTitle('writing'),
        reason: 'Javi will target your writing under time pressure.',
      };
    case 'fluency':
      return {
        topicLabel: drillDisplayTitle('fluency'),
        reason: 'Javi will target your fluency patterns.',
      };
    case 'word-order':
      return {
        topicLabel: drillDisplayTitle('word-order'),
        reason: 'Javi will target your word order patterns.',
      };
  }
}
