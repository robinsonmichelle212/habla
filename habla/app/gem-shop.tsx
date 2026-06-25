import {
  BONUS_ROUNDS,
  dismissShopBadge,
  getAffordableNextLevels,
  getGemShopProgress,
  getGemShopStats,
  getLevelCost,
  getNextUnlockLevel,
  getRoundDef,
  isLevelCompleted,
  isLevelUnlocked,
  purchaseLevel,
  ROUND_LEVELS,
  TOTAL_LEVEL_SLOTS,
  type BonusRoundId,
  type GemShopProgress,
  type RoundLevel,
} from '@/lib/gem-shop';
import { getShopRecommendation, type ShopRecommendation } from '@/lib/gem-shop-recommendations';
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
  gem: '#A78BFA',
  green: '#34D399',
  amber: '#FBBF24',
};

type PurchasingKey = `${BonusRoundId}-${RoundLevel}`;

export default function GemShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gems, setGems] = useState(0);
  const [progress, setProgress] = useState<GemShopProgress | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getGemShopStats>> | null>(null);
  const [recommendation, setRecommendation] = useState<ShopRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<PurchasingKey | null>(null);

  const load = useCallback(async () => {
    const [g, p, s] = await Promise.all([
      getTotalGems(),
      getGemShopProgress(),
      getGemShopStats(),
    ]);
    const rec = await getShopRecommendation(g);
    setGems(g);
    setProgress(p);
    setStats(s);
    setRecommendation(rec);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const g = await getTotalGems();
      const affordable = await getAffordableNextLevels(g);
      dismissShopBadge(affordable);
      await load();
    })();
  }, [load]);

  const launchRound = (roundId: BonusRoundId, level: RoundLevel) => {
    router.push({ pathname: '/bonus-round', params: { round: roundId, level: String(level) } });
  };

  const handleUnlock = (roundId: BonusRoundId, level: RoundLevel) => {
    const def = getRoundDef(roundId);
    const cost = getLevelCost(roundId, level);
    Alert.alert(
      `Spend ${cost} 💎 gems on ${def.name} Level ${level}?`,
      'You can replay this level for free anytime with fresh content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setPurchasing(`${roundId}-${level}`);
              const result = await purchaseLevel(roundId, level);
              setPurchasing(null);
              if (!result.success) {
                Alert.alert('Not enough gems', `You need ${cost - gems} more gems.`);
                return;
              }
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              setGems(result.gemsRemaining ?? 0);
              await load();
              launchRound(roundId, level);
            })();
          },
        },
      ],
    );
  };

  const handlePlay = (roundId: BonusRoundId, level: RoundLevel) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    launchRound(roundId, level);
  };

  const renderLevelButton = (roundId: BonusRoundId, level: RoundLevel, roundProgress: GemShopProgress[BonusRoundId]) => {
    const unlocked = isLevelUnlocked(progress!, roundId, level);
    const completed = isLevelCompleted(progress!, roundId, level);
    const nextUnlock = getNextUnlockLevel(progress!, roundId);
    const isNext = nextUnlock === level;
    const isCurrent =
      unlocked &&
      level === roundProgress.highestLevel &&
      !completed;
    const cost = getLevelCost(roundId, level);
    const busy = purchasing === `${roundId}-${level}`;
    const canAfford = gems >= cost;

    if (unlocked) {
      return (
        <Pressable
          key={level}
          onPress={() => handlePlay(roundId, level)}
          style={[
            styles.levelPill,
            isCurrent && styles.levelPillCurrent,
            completed && styles.levelPillCompleted,
          ]}>
          <Text style={styles.levelPillIcon}>{completed ? '⭐' : '▶️'}</Text>
          <Text style={styles.levelPillLabel}>L{level}</Text>
        </Pressable>
      );
    }

    if (isNext) {
      return (
        <Pressable
          key={level}
          onPress={() => (canAfford ? handleUnlock(roundId, level) : undefined)}
          disabled={busy || !canAfford}
          style={[
            styles.levelPill,
            styles.levelPillNext,
            !canAfford && styles.levelPillLocked,
            busy && styles.levelPillBusy,
          ]}>
          {busy ? (
            <ActivityIndicator color={palette.accent} size="small" />
          ) : (
            <>
              <Text style={styles.levelPillIcon}>🔒</Text>
              <Text style={styles.levelPillLabel}>L{level}</Text>
              <Text style={styles.levelPillCost}>{cost}💎</Text>
            </>
          )}
        </Pressable>
      );
    }

    return (
      <View key={level} style={[styles.levelPill, styles.levelPillLocked]}>
        <Text style={styles.levelPillIcon}>🔒</Text>
        <Text style={styles.levelPillLabel}>L{level}</Text>
        <Text style={styles.levelPillCostMuted}>{cost}💎</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>✕ Close</Text>
        </Pressable>
        <Text style={styles.title}>Gem Shop 💎</Text>
        <View style={styles.gemPill}>
          <Text style={styles.gemPillText}>💎 {gems}</Text>
        </View>
      </View>

      {loading || !progress || !stats ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Your shop stats</Text>
            <View style={styles.statsGrid}>
              <Text style={styles.statLine}>Total gems spent: 💎 {stats.totalGemsSpent}</Text>
              <Text style={styles.statLine}>
                Rounds unlocked: {stats.roundsUnlocked} of {TOTAL_LEVEL_SLOTS}
              </Text>
              <Text style={styles.statLine}>Elite badges earned: {stats.eliteBadgesEarned} 🏆</Text>
              <Text style={styles.statLine}>
                Most played: {stats.mostPlayedRound ? `${stats.mostPlayedRound.emoji} ${stats.mostPlayedRound.name}` : '—'}
              </Text>
            </View>
          </View>

          {recommendation ? (
            <View style={styles.recCard}>
              <Text style={styles.recLabel}>Javi recommends</Text>
              <Text style={styles.recText}>
                {recommendation.roundEmoji} {recommendation.roundName} Level {recommendation.level} —{' '}
                {recommendation.reason}
              </Text>
              {recommendation.canAfford && recommendation.cost > 0 ? (
                <Pressable
                  onPress={() => handleUnlock(recommendation.roundId, recommendation.level)}
                  style={styles.recBtn}>
                  <Text style={styles.recBtnText}>Unlock for {recommendation.cost} 💎</Text>
                </Pressable>
              ) : recommendation.cost === 0 ? (
                <Pressable
                  onPress={() => handlePlay(recommendation.roundId, recommendation.level)}
                  style={styles.recBtn}>
                  <Text style={styles.recBtnText}>Play Level {recommendation.level} ▶</Text>
                </Pressable>
              ) : (
                <Text style={styles.recNeed}>Need {recommendation.cost - gems} more gems</Text>
              )}
            </View>
          ) : null}

          <Text style={styles.subtitle}>
            Each round has 5 levels. Unlock in order — replay any unlocked level for free.
          </Text>

          {BONUS_ROUNDS.map((round) => {
            const roundProgress = progress[round.id];
            const isQuizGateway = round.id === 'quiz';
            return (
              <View key={round.id} style={styles.card}>
                {isQuizGateway ? (
                  <Text style={styles.gatewayLabel}>Start here 👆 — your first unlock</Text>
                ) : null}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{round.emoji}</Text>
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardName}>{round.name}</Text>
                    {roundProgress.totalPlays > 0 ? (
                      <Text style={styles.playedMeta}>
                        Played {roundProgress.totalPlays} time{roundProgress.totalPlays === 1 ? '' : 's'}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {round.description}
                </Text>
                {isQuizGateway ? (
                  <Text style={styles.gatewayHint}>
                    The perfect first round. Unlock with just 5 gems.
                  </Text>
                ) : null}
                <View style={styles.levelRow}>
                  {ROUND_LEVELS.map((level) => renderLevelButton(round.id, level, roundProgress))}
                </View>
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
  statsCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 16,
    gap: 8,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statsGrid: { gap: 6 },
  statLine: { fontSize: 14, fontWeight: '700', color: palette.text },
  recCard: {
    backgroundColor: 'rgba(255, 122, 89, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.35)',
    padding: 16,
    gap: 8,
  },
  recLabel: { fontSize: 12, fontWeight: '900', color: palette.accent, textTransform: 'uppercase' },
  recText: { fontSize: 15, fontWeight: '700', color: palette.text, lineHeight: 22 },
  recBtn: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  recBtnText: { fontSize: 14, fontWeight: '900', color: '#0B0F14' },
  recNeed: { fontSize: 13, fontWeight: '700', color: palette.muted },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 20,
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
  cardDesc: { fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 },
  gatewayLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gatewayHint: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gem,
    lineHeight: 18,
  },
  playedMeta: { fontSize: 12, fontWeight: '700', color: palette.green, marginTop: 2 },
  levelRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  levelPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 2,
    minHeight: 64,
    gap: 2,
  },
  levelPillCurrent: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.1)',
  },
  levelPillCompleted: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  levelPillNext: {
    borderColor: palette.accent,
  },
  levelPillLocked: {
    opacity: 0.55,
  },
  levelPillBusy: {
    opacity: 0.7,
  },
  levelPillIcon: { fontSize: 14 },
  levelPillLabel: { fontSize: 11, fontWeight: '900', color: palette.text },
  levelPillCost: { fontSize: 9, fontWeight: '800', color: palette.gem },
  levelPillCostMuted: { fontSize: 9, fontWeight: '700', color: palette.muted },
});
