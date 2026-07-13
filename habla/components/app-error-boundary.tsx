import ErrorBoundary from '@/components/ErrorBoundary';
import { resetLessonSession } from '@/lib/lesson-session';
import { stopJaviSpeech } from '@/lib/javi-speech';
import { useRouter, type Href } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();

  const onGoHome = useCallback(() => {
    stopJaviSpeech();
    resetLessonSession();
    router.replace('/' as Href);
  }, [router]);

  return <ErrorBoundary onGoHome={onGoHome}>{children}</ErrorBoundary>;
}
