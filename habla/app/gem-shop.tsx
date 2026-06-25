import {
  BONUS_ROUNDS,
  dismissShopBadgeForSession,
  getGemShopHistory,
  getRoundDef,
  purchaseRound,
  type BonusRoundId,
} from '@/lib/gem-shop';
import { getTotalGems } from '@/lib/gems';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  gem: '#A78BFA',
  green: '#34D399',
};

export default function GemShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gems, setGems] = useState(0);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getGemShopHistory>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<BonusRoundId | null>(null);

  const load = useCallback(async () => {
    const [g, h] = await Promise.all([getTotalGems(), getGemShopHistory()]);
    setGems(g);
    setHistory(h);
    setLoading(false);
  }, []);

  useEffect(() => {
    dismissShopBadgeForSession();
    void load();
  }, [load]);

  const handleUnlock = (roundId: BonusRoundId) => {
    const def = getRoundDef(roundId);
    Alert.alert(
      `Spend ${def.cost} 💎 gems on ${def.name}?`,
      'You can replay for free anytime with fresh content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setPurchasing(roundId);
              const result = await purchaseRound(roundId);
              setPurchasing(null);
              if (!result.success) {
                Alert.alert('Not enough gems', `You need ${def.cost - gems} more gems.`);
                return;
              }
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              setGems(result.gemsRemaining ?? 0);
              await load();
              router.push({ pathname: '/bonus-round', params: { round: roundId } });
            })();
          },
        },
      ],
    );
  };

  const handlePlay = (roundId: BonusRoundId) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: '/bonus-round', params: { round: roundId } });
  };

  const getPlayCount = (roundId: BonusRoundId) =>
    history?.unlocks.find((u) => u.roundId === roundId)?.playCount ?? 0;

  const isUnlocked = (roundId: BonusRoundId) =>
    history?.unlocks.some((u) => u.roundId === roundId) ?? false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <Text style={styles.title}>Gem Shop 💎</Text>
        <View style={styles.gemPill}>
          <Text style={styles.gemPillText}>💎 {gems}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Spend gems to unlock bonus rounds. Replay anytime for free — fresh content every time.
          </Text>
          {history && history.totalGemsSpent > 0 ? (
            <Text style={styles.spentNote}>Total spent in shop: 💎 {history.totalGemsSpent}</Text>
          ) : null}

          {BONUS_ROUNDS.map((round) => {
            const unlocked = isUnlocked(round.id);
            const plays = getPlayCount(round.id);
            const canAfford = gems >= round.cost;
            const busy = purchasing === round.id;

            return (
              <View key={round.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{round.emoji}</Text>
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardName}>{round.name}</Text>
                    <Text style={styles.cardCost}>💎 {round.cost}</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {round.description}
                </Text>
                {plays > 0 ? (
                  <Text style={styles.playedMeta}>Played {plays} time{plays === 1 ? '' : 's'}</Text>
                ) : null}

                {unlocked ? (
                  <Pressable
                    onPress={() => handlePlay(round.id)}
                    style={({ pressed }) => [styles.playBtn, pressed && styles.btnPressed]}>
                    <Text style={styles.playBtnText}>Play again ▶</Text>
                  </Pressable>
                ) : canAfford ? (
                  <Pressable
                    onPress={() => handleUnlock(round.id)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.unlockBtn,
                      pressed && styles.btnPressed,
                      busy && styles.btnDisabled,
                    ]}>
                    {busy ? (
                      <ActivityIndicator color="#0B0F14" />
                    ) : (
                      <Text style={styles.unlockBtnText}>Unlock 💎{round.cost}</Text>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.needGems}>
                    <Text style={styles.needGemsText}>
                      Need {round.cost - gems} more gems
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceBorder,
  },
  back: { fontSize: 16, fontWeight: '700', color: palette.accent, minWidth: 72 },
  title: { fontSize: 18, fontWeight: '900', color: palette.text },
  gemPill: {
    backgroundColor: palette.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    minWidth: 72,
    alignItems: 'center',
  },
  gemPillText: { fontSize: 14, fontWeight: '900', color: palette.gem },
  scroll: { padding: 20, gap: 14 },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
    marginBottom: 4,
  },
  spentNote: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 8,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 32 },
  cardTitles: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '900', color: palette.text },
  cardCost: { fontSize: 14, fontWeight: '800', color: palette.gem, marginTop: 2 },
  cardDesc: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
  playedMeta: { fontSize: 12, fontWeight: '700', color: palette.green },
  unlockBtn: {
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtn: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: { fontSize: 15, fontWeight: '900', color: palette.green },
  unlockBtnText: { fontSize: 15, fontWeight: '900', color: '#0B0F14' },
  needGems: {
    backgroundColor: palette.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  needGemsText: { fontSize: 14, fontWeight: '700', color: palette.muted },
  btnPressed: { opacity: 0.88 },
  btnDisabled: { opacity: 0.6 },
});
