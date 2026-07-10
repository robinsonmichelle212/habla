import type { Href, Router } from 'expo-router';

import {
  getNextPendingMilestoneQuiz,
  queueMilestoneQuizzesFromCelebrations,
} from '@/lib/milestone-celebration-quiz';
import type { MilestoneCelebration } from '@/lib/milestones';
import { formatLocalDate } from '@/lib/streak';

export async function offerMilestoneCelebrationQuiz(
  router: Router,
  celebrations: MilestoneCelebration[],
  options?: { levelLabel?: string },
): Promise<void> {
  const quizEligible = celebrations.filter(
    (c) =>
      c.id === 'streak-14' ||
      c.id === 'streak-30' ||
      c.id === 'streak-100' ||
      c.id === 'level-up' ||
      c.id === 'grammar-complete',
  );
  if (!quizEligible.length) return;

  await queueMilestoneQuizzesFromCelebrations(quizEligible, {
    levelLabel: options?.levelLabel,
    achievedDate: formatLocalDate(),
  });
  const next = await getNextPendingMilestoneQuiz();
  if (!next) return;
  router.push(`/milestone-quiz?id=${encodeURIComponent(next.id)}` as Href);
}
