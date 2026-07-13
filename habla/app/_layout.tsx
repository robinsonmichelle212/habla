import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/app-error-boundary';
import { MilestoneProvider } from '@/contexts/milestone-context';
import { DemoModeProvider } from '@/contexts/demo-mode-context';
import { NetworkProvider, useNetworkStatus } from '@/contexts/network-context';
import { OfflineBanner } from '@/components/offline-banner';
import { DemoModeBadge } from '@/components/demo-mode-badge';
import { SyncIndicator } from '@/components/sync-indicator';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initStreakNotifications } from '@/lib/streak-notifications';
import { parseRoundLevel, type BonusRoundId } from '@/lib/gem-shop';
import { runOneTimeGemRestoration } from '@/lib/gem-restoration';
import { recoverUnregisteredSessions } from '@/lib/session-recovery';
import { setupGlobalErrorHandlers } from '@/lib/setup-global-error-handlers';
import { preloadJaviVoice } from '@/lib/javi-speech';
import { ensurePreviousMonthWrapped } from '@/lib/wrapped-storage';
import { notifyWrappedReadyNow, scheduleWrappedMonthlyNotification } from '@/lib/wrapped-notifications';

setupGlobalErrorHandlers();
preloadJaviVoice();

export const unstable_settings = {
  anchor: '(tabs)',
};

function GlobalOfflineBanner() {
  const { isOnline, hydrated } = useNetworkStatus();
  if (!hydrated || isOnline) return null;
  return <OfflineBanner message="📡 Offline — your work is being saved locally" />;
}

function WrappedBootstrap() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await runOneTimeGemRestoration();
      await recoverUnregisteredSessions();
      await initStreakNotifications();
      await scheduleWrappedMonthlyNotification();
      const created = await ensurePreviousMonthWrapped();
      if (created) {
        await notifyWrappedReadyNow();
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'wrapped') {
        const monthKey = response.notification.request.content.data?.monthKey;
        if (typeof monthKey === 'string') {
          router.push({ pathname: '/wrapped', params: { month: monthKey } });
        } else {
          router.push('/wrapped');
        }
      }
      if (type === 'speaking-evaluated' || type === 'writing-evaluated' || type === 'writing-evaluated-batch') {
        router.push('/progress');
      }
      if (type === 'gem-unlock-expiry') {
        const roundId = response.notification.request.content.data?.roundId;
        const levelRaw = response.notification.request.content.data?.level;
        const level = parseRoundLevel(levelRaw as string | number | undefined);
        if (typeof roundId === 'string' && level) {
          router.push({
            pathname: '/bonus-round',
            params: { round: roundId as BonusRoundId, level: String(level) },
          });
        } else {
          router.push('/gem-shop');
        }
      }
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppErrorBoundary>
      <NetworkProvider>
        <DemoModeProvider>
        <View style={{ flex: 1 }}>
          <GlobalOfflineBanner />
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 14,
              zIndex: 50,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
            <DemoModeBadge />
            <SyncIndicator />
          </View>
          <MilestoneProvider>
            <WrappedBootstrap />
            <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="lesson" options={{ headerShown: false }} />
          <Stack.Screen name="practice" options={{ headerShown: false }} />
          <Stack.Screen name="writing" options={{ headerShown: false }} />
          <Stack.Screen name="level" options={{ headerShown: false }} />
          <Stack.Screen name="progress" options={{ headerShown: false }} />
          <Stack.Screen name="read-lesson" options={{ headerShown: false }} />
          <Stack.Screen name="score-history" options={{ headerShown: false }} />
          <Stack.Screen name="memory-palace" options={{ headerShown: false }} />
          <Stack.Screen name="milestone-quiz" options={{ headerShown: false }} />
          <Stack.Screen
            name="summary"
            options={{ headerShown: false, gestureEnabled: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen name="last-summary" options={{ headerShown: false }} />
          <Stack.Screen name="wrapped" options={{ headerShown: false }} />
          <Stack.Screen name="gem-shop" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="bonus-round" options={{ headerShown: false }} />
          <Stack.Screen name="grammar-curriculum" options={{ headerShown: false }} />
          <Stack.Screen name="conjugation-tables" options={{ headerShown: false }} />
          <Stack.Screen name="tense-guide" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
          </MilestoneProvider>
        </View>
        </DemoModeProvider>
      </NetworkProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
