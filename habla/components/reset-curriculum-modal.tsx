import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  red: '#F87171',
};

type Props = {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ResetCurriculumModal({ visible, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>⚠️ Reset Grammar Curriculum?</Text>
          <Text style={styles.body}>
            This will restart from Week 1 — Present Tense.{'\n'}
            All your curriculum progress will be lost.{'\n'}
            Your scores and lesson history are not affected.
          </Text>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.btnPressed]}
            accessibilityRole="button">
            <Text style={styles.confirmBtnText}>Yes, start again from Week 1</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.text,
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 22,
  },
  confirmBtn: {
    backgroundColor: palette.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelBtn: {
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  btnPressed: { opacity: 0.9 },
});
