import { useDemoMode } from '@/contexts/demo-mode-context';
import { StyleSheet, Text, View } from 'react-native';

export function DemoModeBadge() {
  const { enabled, hydrated } = useDemoMode();
  if (!hydrated || !enabled) return null;

  return (
    <View style={styles.badge} accessibilityLabel="Demo mode active">
      <Text style={styles.text}>DEMO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FB923C',
    letterSpacing: 1,
  },
});
