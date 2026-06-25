import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { progressPalette } from '@/components/progress/chart-theme';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={styles.tabIcon}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: progressPalette.accent,
        tabBarInactiveTintColor: progressPalette.muted,
        tabBarStyle: {
          backgroundColor: progressPalette.surface,
          borderTopColor: progressPalette.surfaceBorder,
        },
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: () => <TabIcon emoji="📈" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22, lineHeight: 26 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});
