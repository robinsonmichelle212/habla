import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useNetworkStatus } from '@/contexts/network-context';

export function SyncIndicator() {
  const { isSyncing } = useNetworkStatus();
  if (!isSyncing) return null;

  return (
    <View style={styles.wrap} accessibilityLabel="Syncing offline work">
      <ActivityIndicator size="small" color="#FF7A59" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
