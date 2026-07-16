import {
  BONUS_ROUNDS,
  canAffordRoundNextLevel,
  dismissShopBadge,
  getAffordableNextLevels,
  getGemShopProgress,
  getGemShopStats,
  LEVEL_QUALIFY_SCORE,
  getLevelCost,
  getRoundDef,
  getRoundShopState,
  purchaseLevel,
  takeExpiredNotices,
  type BonusRoundId,
  type ExpiredUnlockNotice,
  type GemShopProgress,
  type RoundLevel,
  type RoundShopState,
} from '@/lib/gem-shop';
import {
  formatExpiryCountdown,
  getActivePendingUnlock,
  getExpiryUrgency,
} from '@/lib/gem-shop-expiry';
import { getShopRecommendation, type ShopRecommendation } from '@/lib/gem-shop-recommendations';
import { getTotalGems } from '@/lib/gems';
import { useDemoMode } from '@/contexts/demo-mode-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  red: '#F87171',
};

type PurchasingKey = `${BonusRoundId}-${RoundLevel}`;

type PendingUnlock = {
  roundId: BonusRoundId;
  level: RoundLevel;
};

type SuccessUnlock = PendingUnlock;

export default function GemShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: demoMode } = useDemoMode();
  const [gems, setGems] = useState(0);
  const [progress, setProgress] = useState<GemShopProgress | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getGemShopStats>> | null>(null);
  const [recommendation, setRecommendation] = useState<ShopRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<PurchasingKey | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<PendingUnlock | null>(null);
  const [successUnlock, setSuccessUnlock] = useState<SuccessUnlock | null>(null);
  const [expiredNotices, setExpiredNotices] = useState<ExpiredUnlockNotice[]>([]);
  const [tick, setTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [g, p, s] = await Promise.all([
      getTotalGems(),
      getGemShopProgress(),
      getGemShopStats(),
    ]);
    const rec = await getShopRecommendation(g);
    const expired = takeExpiredNotices();
    if (expired.length) {
      setExpiredNotices((prev) => [...prev, ...expired]);
    }
    setGems(g);
    setProgress(p);
    setStats(s);
    setRecommendation(rec);
    setLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (!progress) return;
      const hasPending = BONUS_ROUNDS.some((round) =>
        getActivePendingUnlock(progress[round.id].unlocks, now),
      );
      if (!hasPending) return;
      const anyJustExpired = BONUS_ROUNDS.some((round) =>
        progress[round.id].unlocks.some((u) => !u.completed && u.expiresAt <= now),
      );
      if (anyJustExpired) {
        void load();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [load, progress]);

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

  const requestUnlock = (roundId: BonusRoundId, level: RoundLevel) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPendingUnlock({ roundId, level });
  };

  const cancelUnlock = () => {
    setPendingUnlock(null);
  };

  const confirmUnlock = () => {
    if (!pendingUnlock) return;
    const { roundId, level } = pendingUnlock;
    const cost = getLevelCost(roundId, level);

    void (async () => {
      setPurchasing(`${roundId}-${level}`);
      const result = await purchaseLevel(roundId, level);
      setPurchasing(null);

      if (!result.success) {
        setPendingUnlock(null);
        return;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setGems(result.gemsRemaining ?? 0);
      setPendingUnlock(null);
      setSuccessUnlock({ roundId, level });
      await load();
    })();
  };

  const handlePlayLater = () => {
    setSuccessUnlock(null);
  };

  const handlePlayNow = () => {
    if (!successUnlock) return;
    const { roundId, level } = successUnlock;
    setSuccessUnlock(null);
    launchRound(roundId, level);
  };

  const handlePlay = (roundId: BonusRoundId, level: RoundLevel) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    launchRound(roundId, level);
  };

  const renderRoundAction = (roundId: BonusRoundId, shopState: RoundShopState) => {
    const busy =
      shopState.kind === 'unlock' && purchasing === `${roundId}-${shopState.level}`;
    const unlockCost = shopState.kind === 'unlock' ? shopState.cost : 0;
    const canAfford =
      shopState.kind === 'unlock' ? demoMode || gems >= unlockCost : false;
    const costLabel = demoMode ? 'FREE in demo 🎭' : `${unlockCost} 💎`;
    const showAffordBadge = canAffordRoundNextLevel(progress!, roundId, gems, tick);

    if (shopState.kind === 'mastered') {
      return (
        <View style={styles.masteredBadge}>
          <Text style={styles.masteredText}>Mastered 🏆</Text>
        </View>
      );
    }

    if (shopState.kind === 'play') {
      const nextLevel =
        shopState.level < 5 ? ((shopState.level + 1) as RoundLevel) : null;
      return (
        <View style={styles.unlockBlock}>
          <Pressable
            onPress={() => handlePlay(roundId, shopState.level)}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonPlay,
              pressed && styles.actionButtonPressed,
            ]}>
            <Text style={styles.actionButtonText}>Play Level {shopState.level} ▶</Text>
          </Pressable>
          {shopState.highestScore > 0 ? (
            <Text style={styles.bestScoreText}>Your best: {shopState.highestScore}/10</Text>
          ) : null}
          {nextLevel && !shopState.qualified ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Level locked 🔒',
                  `Score 7 or more on Level ${shopState.level} to unlock Level ${nextLevel}`,
                )
              }
              style={styles.lockedNextBtn}>
              <Text style={styles.lockedNextText}>🔒 Level {nextLevel} locked</Text>
              <Text style={styles.lockedHintText}>
                Score {LEVEL_QUALIFY_SCORE}+ on Level {shopState.level} to unlock
              </Text>
              {shopState.highestScore > 0 ? (
                <Text style={styles.bestScoreText}>Your best: {shopState.highestScore}/10</Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (shopState.kind === 'locked') {
      return (
        <View style={styles.unlockBlock}>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Level locked 🔒',
                `Score 7 or more on Level ${shopState.level} to unlock Level ${shopState.blockedLevel}`,
              )
            }
            style={styles.lockedNextBtn}>
            <Text style={styles.lockedNextText}>🔒 Level {shopState.blockedLevel} locked</Text>
            <Text style={styles.lockedHintText}>
              Score {LEVEL_QUALIFY_SCORE}+ on Level {shopState.level} to unlock Level{' '}
              {shopState.blockedLevel}
            </Text>
            <Text style={styles.bestScoreText}>Your best: {shopState.highestScore}/10</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.unlockBlock}>
        {shopState.previousCompletedLevel ? (
          <Text style={styles.completedNote}>
            You completed Level {shopState.previousCompletedLevel} ✅
            {shopState.previousHighestScore > 0
              ? ` · Best ${shopState.previousHighestScore}/10`
              : ''}
          </Text>
        ) : null}
        <Pressable
          onPress={() => (canAfford ? requestUnlock(roundId, shopState.level) : undefined)}
          disabled={busy || !canAfford}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonUnlock,
            showAffordBadge && styles.actionButtonAffordable,
            !canAfford && styles.actionButtonDisabled,
            busy && styles.actionButtonBusy,
            pressed && canAfford && styles.actionButtonPressed,
          ]}>
          {busy ? (
            <ActivityIndicator color="#0B0F14" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              Unlock Level {shopState.level} — {costLabel}
            </Text>
          )}
        </Pressable>
        {!canAfford && !demoMode ? (
          <Text style={styles.needGemsText}>
            Need {shopState.cost - gems} more gem{shopState.cost - gems === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
    );
  };

  const pendingDef = pendingUnlock ? getRoundDef(pendingUnlock.roundId) : null;
  const pendingCost = pendingUnlock
    ? getLevelCost(pendingUnlock.roundId, pendingUnlock.level)
    : 0;
  const successDef = successUnlock ? getRoundDef(successUnlock.roundId) : null;
  const confirmBusy = pendingUnlock
    ? purchasing === `${pendingUnlock.roundId}-${pendingUnlock.level}`
    : false;

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
          <Text style={styles.statsLine}>
            💎 {gems} gems · {stats.roundsMastered} round{stats.roundsMastered === 1 ? '' : 's'} mastered 🏆
          </Text>

          {recommendation ? (
            <View style={styles.recCard}>
              <Text style={styles.recLabel}>Javi recommends</Text>
              <Text style={styles.recText}>
                {recommendation.roundEmoji} {recommendation.roundName} Level {recommendation.level} —{' '}
                {recommendation.reason}
              </Text>
              {recommendation.canAfford || demoMode ? (
                <Pressable
                  onPress={() => requestUnlock(recommendation.roundId, recommendation.level)}
                  style={styles.recBtn}>
                  <Text style={styles.recBtnText}>
                    {demoMode
                      ? `Unlock for FREE in demo 🎭`
                      : recommendation.cost > 0
                        ? `Unlock for ${recommendation.cost} 💎`
                        : `Play Level ${recommendation.level} ▶`}
                  </Text>
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

          <Text style={styles.subtitle}>Unlock in order — complete within 24 hours.</Text>

          {expiredNotices.map((notice) => {
            const def = getRoundDef(notice.roundId);
            return (
              <View key={`${notice.roundId}-${notice.level}`} style={styles.expiredBanner}>
                <Text style={styles.expiredBannerText}>
                  ⏰ {def.name} Level {notice.level} expired. Unlock again to play.
                </Text>
                <Pressable
                  onPress={() =>
                    setExpiredNotices((prev) =>
                      prev.filter((n) => !(n.roundId === notice.roundId && n.level === notice.level)),
                    )
                  }
                  hitSlop={8}>
                  <Text style={styles.expiredDismiss}>✕</Text>
                </Pressable>
              </View>
            );
          })}

          {BONUS_ROUNDS.map((round) => {
            const roundProgress = progress[round.id];
            const pending = getActivePendingUnlock(roundProgress.unlocks, tick);
            const expiryUrgency = pending ? getExpiryUrgency(pending.expiresAt, tick) : null;
            const shopState = getRoundShopState(progress, round.id, tick);
            const isQuizGateway = round.id === 'quiz';
            const showAffordBadge = canAffordRoundNextLevel(progress, round.id, gems, tick);
            return (
              <View key={round.id} style={styles.card}>
                {isQuizGateway ? (
                  <Text style={styles.gatewayLabel}>Start here 👆 — your first unlock</Text>
                ) : null}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{round.emoji}</Text>
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardName}>{round.name}</Text>
                  </View>
                  {showAffordBadge ? (
                    <View style={styles.affordBadge}>
                      <Text style={styles.affordBadgeText}>!</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {round.description}
                </Text>
                {pending ? (
                  <Pressable onPress={() => handlePlay(round.id, pending.level)}>
                    <Text
                      style={[
                        styles.expiryBanner,
                        expiryUrgency === 'amber' && styles.expiryBannerAmber,
                        expiryUrgency === 'red' && styles.expiryBannerRed,
                      ]}>
                      ⏰ Expires in {formatExpiryCountdown(pending.expiresAt, tick)} — Play now
                    </Text>
                  </Pressable>
                ) : null}
                {isQuizGateway && shopState.kind === 'unlock' ? (
                  <Text style={styles.gatewayHint}>
                    The perfect first round. Unlock with just {shopState.cost} gems.
                  </Text>
                ) : null}
                {renderRoundAction(round.id, shopState)}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={pendingUnlock != null && successUnlock == null}
        transparent
        animationType="fade"
        onRequestClose={cancelUnlock}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelUnlock} accessibilityLabel="Cancel unlock" />
          <View style={[styles.modalCard, styles.modalCardElevated]}>
            {pendingUnlock && pendingDef ? (
              <>
                <Text style={styles.modalEmoji}>{pendingDef.emoji}</Text>
                <Text style={styles.modalTitle}>Are you sure?</Text>
                <Text style={styles.modalRoundName}>
                  {pendingDef.name} · Level {pendingUnlock.level}
                </Text>
                <Text style={styles.modalSpend}>
                  This will spend {pendingCost} 💎 gems
                </Text>
                <View style={styles.modalBalanceBox}>
                  <Text style={styles.modalBalanceLine}>
                    Your current gem balance: {gems} 💎
                  </Text>
                  <Text style={styles.modalBalanceLine}>
                    Your balance after: {Math.max(0, gems - pendingCost)} 💎
                  </Text>
                </View>
                <Pressable
                  onPress={confirmUnlock}
                  disabled={confirmBusy || gems < pendingCost}
                  style={({ pressed }) => [
                    styles.modalConfirmBtn,
                    pressed && styles.modalBtnPressed,
                    (confirmBusy || gems < pendingCost) && styles.modalBtnDisabled,
                  ]}>
                  {confirmBusy ? (
                    <ActivityIndicator color="#0B0F14" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Yes, unlock it 🔓</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={cancelUnlock}
                  disabled={confirmBusy}
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    pressed && styles.modalBtnPressed,
                  ]}>
                  <Text style={styles.modalCancelText}>Not yet</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={successUnlock != null}
        transparent
        animationType="fade"
        onRequestClose={handlePlayLater}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.successCard, styles.modalCardElevated]}>
            {successUnlock && successDef ? (
              <>
                <Text style={styles.successEmoji}>{successDef.emoji}</Text>
                <Text style={styles.successCelebration}>Unlocked! 🎉</Text>
                <Text style={styles.successTitle}>
                  🎉 {successDef.name} Level {successUnlock.level} Unlocked!
                </Text>
                <Text style={styles.successDeadline}>
                  You have 24 hours to complete this round.
                </Text>
                <Pressable
                  onPress={handlePlayNow}
                  style={({ pressed }) => [styles.successPrimaryBtn, pressed && styles.modalBtnPressed]}>
                  <Text style={styles.successPrimaryText}>Play Now ▶️</Text>
                </Pressable>
                <Pressable
                  onPress={handlePlayLater}
                  style={({ pressed }) => [styles.successSecondaryBtn, pressed && styles.modalBtnPressed]}>
                  <Text style={styles.successSecondaryText}>Play Later ⏰</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  statsLine: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 4,
  },
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
  affordBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affordBadgeText: { fontSize: 13, fontWeight: '900', color: '#0B0F14' },
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
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expiredBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.red,
    lineHeight: 20,
  },
  expiredDismiss: { fontSize: 16, fontWeight: '900', color: palette.muted },
  expiryBanner: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.muted,
    lineHeight: 18,
  },
  expiryBannerAmber: { color: palette.amber },
  expiryBannerRed: { color: palette.red },
  unlockBlock: { gap: 8, marginTop: 4 },
  completedNote: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
  },
  bestScoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
  lockedNextBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: 'rgba(61, 70, 84, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
    alignItems: 'center',
  },
  lockedNextText: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.muted,
    textAlign: 'center',
  },
  lockedHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonPlay: {
    backgroundColor: palette.green,
  },
  actionButtonUnlock: {
    backgroundColor: palette.accent,
  },
  actionButtonAffordable: {
    borderWidth: 2,
    borderColor: palette.gem,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonBusy: {
    opacity: 0.75,
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0B0F14',
    textAlign: 'center',
  },
  needGemsText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
  masteredBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  masteredText: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.amber,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  modalCardElevated: { zIndex: 1 },
  modalEmoji: { fontSize: 44, marginBottom: 4 },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
  },
  modalRoundName: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.accent,
    textAlign: 'center',
  },
  modalSpend: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    marginTop: 4,
  },
  modalBalanceBox: {
    width: '100%',
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginVertical: 8,
  },
  modalBalanceLine: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'center',
  },
  modalConfirmBtn: {
    width: '100%',
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalConfirmText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  modalCancelBtn: {
    width: '100%',
    backgroundColor: palette.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '800', color: palette.muted },
  modalBtnPressed: { opacity: 0.9 },
  modalBtnDisabled: { opacity: 0.55 },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  successCelebration: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.green,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  successEmoji: { fontSize: 48 },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  successDeadline: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  successPrimaryBtn: {
    width: '100%',
    backgroundColor: palette.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successPrimaryText: { fontSize: 16, fontWeight: '900', color: '#0B0F14' },
  successSecondaryBtn: {
    width: '100%',
    backgroundColor: palette.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  successSecondaryText: { fontSize: 15, fontWeight: '800', color: palette.text },
});
