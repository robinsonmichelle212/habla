import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { VocabLookupJson } from '@/lib/claude';

const palette = {
  background: '#0B0F14',
  surface: '#1A2230',
  surfaceBorder: '#2E3A4D',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  green: '#34D399',
};

export type WordLookupPopupData = {
  spanish: string;
  lookup?: VocabLookupJson;
  loading: boolean;
  error?: string;
  anchorX: number;
  anchorY: number;
  anchorWidth: number;
  isPhrase: boolean;
  savedConfirmation?: boolean;
};

type Props = {
  visible: boolean;
  data: WordLookupPopupData | null;
  onClose: () => void;
  onSave: () => void;
};

const SCREEN = Dimensions.get('window');
const MAX_POPUP_HEIGHT = SCREEN.height * 0.3;

export function WordLookupPopup({ visible, data, onClose, onSave }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, opacity]);

  if (!data) return null;

  const popupWidth = Math.min(SCREEN.width - 32, 300);
  const left = Math.max(16, Math.min(data.anchorX + data.anchorWidth / 2 - popupWidth / 2, SCREEN.width - popupWidth - 16));
  const top = Math.max(80, data.anchorY - MAX_POPUP_HEIGHT - 16);
  const arrowLeft = Math.min(
    popupWidth - 20,
    Math.max(12, data.anchorX + data.anchorWidth / 2 - left - 6),
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdropInner, { opacity }]} />
      </Pressable>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.popupWrap, { opacity, top, left, width: popupWidth, maxHeight: MAX_POPUP_HEIGHT }]}>
        <View style={[styles.arrow, { left: arrowLeft }]} />
        <View style={styles.popup}>
          {data.loading ? (
            <ActivityIndicator color={palette.accent} style={{ marginVertical: 12 }} />
          ) : data.error ? (
            <Text style={styles.error}>{data.error}</Text>
          ) : data.lookup ? (
            <>
              <Text style={styles.spanish}>{data.lookup.spanish}</Text>
              <Text style={styles.english}>{data.lookup.english}</Text>
              {data.lookup.partOfSpeech ? (
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Part of speech: </Text>
                  {data.lookup.partOfSpeech}
                </Text>
              ) : null}
              {data.lookup.usageNote ? (
                <Text style={styles.usageNote}>{data.lookup.usageNote}</Text>
              ) : null}
            </>
          ) : null}

          {data.savedConfirmation ? (
            <Text style={styles.savedToast}>💾 Saved</Text>
          ) : null}

          {!data.loading && !data.savedConfirmation ? (
            <View style={styles.actions}>
              <Pressable
                onPress={onSave}
                disabled={!data.lookup || data.loading}
                style={({ pressed }) => [styles.saveBtn, pressed && styles.btnPressed]}>
                <Text style={styles.saveBtnText}>💾 Save</Text>
              </Pressable>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}>
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropInner: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  popupWrap: {
    position: 'absolute',
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: palette.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.surfaceBorder,
    transform: [{ rotate: '45deg' }],
  },
  popup: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  spanish: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
  },
  english: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
    color: palette.muted,
    lineHeight: 18,
  },
  metaLabel: {
    fontWeight: '800',
    color: palette.text,
  },
  usageNote: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
    fontStyle: 'italic',
  },
  error: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.accent,
    textAlign: 'center',
  },
  savedToast: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.green,
    textAlign: 'center',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.background,
  },
  closeBtn: {
    flex: 1,
    backgroundColor: palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.muted,
  },
  btnPressed: { opacity: 0.88 },
});
