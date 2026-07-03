import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

const palette = {
  bannerBg: 'rgba(96, 165, 250, 0.15)',
  bannerBorder: 'rgba(96, 165, 250, 0.35)',
  text: '#93C5FD',
};

type Props = {
  message: string;
  style?: ViewStyle;
};

export function OfflineBanner({ message, style }: Props) {
  return (
    <View style={[styles.banner, style]} accessibilityRole="text">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: palette.bannerBg,
    borderBottomWidth: 1,
    borderBottomColor: palette.bannerBorder,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
});
