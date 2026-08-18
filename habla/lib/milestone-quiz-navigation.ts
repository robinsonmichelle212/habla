import type { Href, Router } from 'expo-router';

import {
  getNextPendingMilestoneQuiz,
  queueMilestoneQuizzesFromCelebrations,
} from '@/lib/milestone-celebration-quiz';
import type { MilestoneCelebration } from '@/lib/milestones';
import { formatLocalDate } from '@/lib/streak';

const QUIZ_ELIGIBLE_MILESTONES = new Set<MilestoneCelebration['id']>([
  'streak-21',
  'streak-63',
  'streak-100',
  'grammar-complete',
]);

export async function offerMilestoneCelebrationQuiz(
  router: Router,
  celebrations: MilestoneCelebration[],
): Promise<void> {
  const quizEligible = celebrations.filter((c) => QUIZ_ELIGIBLE_MILESTONES.has(c.id));
  if (!quizEligible.length) return;

  await queueMilestoneQuizzesFromCelebrations(quizEligible, {
    achievedDate: formatLocalDate(),
  });
  const next = await getNextPendingMilestoneQuiz();
  if (!next) return;
  router.push(`/milestone-quiz?id=${encodeURIComponent(next.id)}` as Href);
}
