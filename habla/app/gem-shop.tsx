import { JewelCard, JEWEL_PALETTE, type CardOrigin } from '@/components/gem-shop-jewel-card';
import {
  BONUS_ROUNDS,
  getRoundDef,
  getRoundShopState,
  purchaseLevel,
  takeExpiredNotices,
  dismissShopBadge,
  getAffordableNextLevels,
  getGemShopProgress,
  LEVEL_QUALIFY_SCORE,
  type BonusRoundId,
  type ExpiredUnlockNotice,
  type GemShopProgress,
  type RoundLevel,
  type RoundShopState,
} from '@/lib/gem-shop';
import {
  formatExpiryCountdown,
  getActivePendingUnlock,
} from '@/lib/gem-shop-expiry';
import { getShopRecommendation, type ShopRecommendation } from '@/lib/gem-shop-recommendations';
import { clearDemoUnlocks } from '@/lib/gem-shop-demo-session';
import { getTotalGems } from '@/lib/gems';
import { useDemoMode } from '@/contexts/demo-mode-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const GRID_PAD = 16;
const GRID_GAP = 12;

type PurchasingKey = `${BonusRoundId}-${RoundLevel}`;

type ExpandedRound = {
  roundId: BonusRoundId;
  origin: CardOrigin;
};

function completedLevelCount(progress: GemShopProgress, roundId: BonusRoundId): number {
  return progress[roundId].unlocks.filter((u) => u.completed).length;
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function GemShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { enabled: demoMode } = useDemoMode();
  const overlayHostRef = useRef<View>(null);

  const cardSize = Math.floor((windowWidth - GRID_PAD * 2 - GRID_GAP) / 2);
  const rows = useMemo(() => chunkRows(BONUS_ROUNDS, 2), []);

  const [gems, setGems] = useState(0);
  const [progress, setProgress] = useState<GemShopProgress | null>(null);
  const [recommendation, setRecommendation] = useState<ShopRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<PurchasingKey | null>(null);
  const [expiredNotices, setExpiredNotices] = useState<ExpiredUnlockNotice[]>([]);
  const [tick, setTick] = useState(() => Date.now());
  const [revealedId, setRevealedId] = useState<BonusRoundId | null>(null);
  const [expanded, setExpanded] = useState<ExpandedRound | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [liteEffects, setLiteEffects] = useState(false);
  const [enteredRows, setEnteredRows] = useState<boolean[]>(() =>
    rows.map((_, i) => i === 0),
  );

  const rowYs = useRef<number[]>([]);
  const gridOffsetY = useRef(0);
  const scrollY = useRef(0);
  const viewportH = useRef(windowHeight);

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([getTotalGems(), getGemShopProgress()]);
    const rec = await getShopRecommendation(g);
    const expired = takeExpiredNotices();
    if (expired.length) {
      setExpiredNotices((prev) => [...prev, ...expired]);
    }
    setGems(g);
    setProgress(p);
    setRecommendation(rec);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    const started = Date.now();
    const task = InteractionManager.runAfterInteractions(() => {
      if (Date.now() - started > 480) setLiteEffects(true);
    });

    return () => {
      mounted = false;
      sub.remove();
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) setEnteredRows(rows.map(() => true));
  }, [reduceMotion, rows]);

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
      if (anyJustExpired) void load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load, progress]);

  useFocusEffect(
    useCallback(() => {
      if (demoMode) clearDemoUnlocks();
      void (async () => {
        const g = await getTotalGems();
        const affordable = await getAffordableNextLevels(g);
        dismissShopBadge(affordable);
        await load();
      })();
    }, [demoMode, load]),
  );

  const launchRound = (roundId: BonusRoundId, level: RoundLevel) => {
    router.push({ pathname: '/bonus-round', params: { round: roundId, level: String(level) } });
  };

  const markRowsVisible = useCallback((y: number, height: number) => {
    scrollY.current = y;
    viewportH.current = height;
    setEnteredRows((prev) => {
      let changed = false;
      const next = [...prev];
      for (let i = 0; i < rows.length; i += 1) {
        if (next[i]) continue;
        const rowY = (gridOffsetY.current || 0) + (rowYs.current[i] ?? 0);
        if (rowY < y + height - 24) {
          next[i] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows.length]);

  const openExpanded = (roundId: BonusRoundId, origin: CardOrigin) => {
    overlayHostRef.current?.measureInWindow((hx, hy) => {
      setExpanded({
        roundId,
        origin: {
          x: origin.x - hx,
          y: origin.y - hy,
          width: origin.width,
          height: origin.height,
        },
      });
    });
  };

  const expandedRound = expanded ? getRoundDef(expanded.roundId) : null;
  const expandedState =
    expanded && progress ? getRoundShopState(progress, expanded.roundId, tick) : null;
  const expandedBusy =
    expanded && expandedState?.kind === 'unlock'
      ? purchasing === `${expanded.roundId}-${expandedState.level}`
      : false;

  const handlePurchaseAndPlay = async (roundId: BonusRoundId, level: RoundLevel) => {
    setPurchasing(`${roundId}-${level}`);
    const result = await purchaseLevel(roundId, level);
    setPurchasing(null);
    if (!result.success) return false;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setGems(result.gemsRemaining ?? 0);
    return true;
  };

  return (
    <View ref={overlayHostRef} style={styles.root} collapsable={false}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {loading || !progress ? (
            <ActivityIndicator color={JEWEL_PALETTE.accent} style={{ marginTop: 48 }} />
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.scroll,
                { paddingBottom: Math.max(insets.bottom, 24) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(e) => {
                const { contentOffset, layoutMeasurement } = e.nativeEvent;
                markRowsVisible(contentOffset.y, layoutMeasurement.height);
              }}
              onLayout={(e) => {
                markRowsVisible(scrollY.current, e.nativeEvent.layout.height);
              }}>
              <View>
                <Pressable onPress={() => setRevealedId(null)} style={styles.headerBlock}>
                <View style={styles.hero}>
                  <Text style={styles.heroCount}>💎 {gems}</Text>
                  <Text style={styles.heroEs}>Tus gemas · úsalas con intención</Text>
                  <Text style={styles.heroEn}>Your gems · spend them with intention</Text>
                </View>

                {recommendation ? (
                  <View style={styles.recCard}>
                    <Text style={styles.recText}>
                      🎯 Javi recomienda: {recommendation.roundName} — {recommendation.reason}
                    </Text>
                  </View>
                ) : null}

                {expiredNotices.map((notice) => {
                  const def = getRoundDef(notice.roundId);
                  return (
                    <View key={`${notice.roundId}-${notice.level}`} style={styles.expiredBanner}>
                      <Text style={styles.expiredText}>
                        {def.name} Level {notice.level} expired.
                      </Text>
                      <Pressable
                        onPress={() =>
                          setExpiredNotices((prev) =>
                            prev.filter(
                              (n) => !(n.roundId === notice.roundId && n.level === notice.level),
                            ),
                          )
                        }
                        hitSlop={8}>
                        <Text style={styles.expiredDismiss}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Pressable>

              <View
                pointerEvents="box-none"
                style={styles.grid}
                onLayout={(e) => {
                  gridOffsetY.current = e.nativeEvent.layout.y;
                  markRowsVisible(scrollY.current, viewportH.current);
                }}>
                {rows.map((row, rowIndex) => (
                  <JewelRow
                    key={`row-${rowIndex}`}
                    rowIndex={rowIndex}
                    entered={enteredRows[rowIndex] ?? rowIndex === 0}
                    reduceMotion={reduceMotion}
                    onLayoutY={(y) => {
                      rowYs.current[rowIndex] = y;
                      markRowsVisible(scrollY.current, viewportH.current);
                    }}>
                    {row.map((round) => {
                      const shopState = getRoundShopState(progress, round.id, tick);
                      const pending = getActivePendingUnlock(progress[round.id].unlocks, tick);
                      return (
                        <JewelCard
                          key={round.id}
                          round={round}
                          shopState={shopState}
                          gems={gems}
                          demoMode={demoMode}
                          completedLevels={completedLevelCount(progress, round.id)}
                          revealed={revealedId === round.id}
                          reduceMotion={reduceMotion}
                          liteEffects={liteEffects}
                          size={cardSize}
                          hidden={expanded?.roundId === round.id}
                          expiryLabel={
                            pending
                              ? `Expires in ${formatExpiryCountdown(pending.expiresAt, tick)}`
                              : null
                          }
                          onReveal={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                            setRevealedId(round.id);
                          }}
                          onOpen={(origin) => openExpanded(round.id, origin)}
                        />
                      );
                    })}
                  </JewelRow>
                ))}
              </View>
              </View>
            </ScrollView>
          )}
      </SafeAreaView>

      {expanded && expandedRound && expandedState ? (
        <JewelExpandOverlay
          origin={expanded.origin}
          round={expandedRound}
          shopState={expandedState}
          gems={gems}
          demoMode={demoMode}
          busy={expandedBusy}
          reduceMotion={reduceMotion}
          windowWidth={windowWidth}
          windowHeight={windowHeight}
          onClose={() => setExpanded(null)}
          onPlay={(level) => {
            const id = expanded.roundId;
            setExpanded(null);
            setRevealedId(null);
            launchRound(id, level);
          }}
          onPurchase={(level) => handlePurchaseAndPlay(expanded.roundId, level)}
        />
      ) : null}
    </View>
  );
}

function JewelRow({
  rowIndex,
  entered,
  reduceMotion,
  onLayoutY,
  children,
}: {
  rowIndex: number;
  entered: boolean;
  reduceMotion: boolean;
  onLayoutY: (y: number) => void;
  children: ReactNode;
}) {
  const anim = useRef(new Animated.Value(rowIndex === 0 || reduceMotion ? 1 : 0)).current;
  const started = useRef(rowIndex === 0 || reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      started.current = true;
    }
  }, [reduceMotion, anim]);

  useEffect(() => {
    if (started.current || !entered) return;
    started.current = true;
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      delay: rowIndex * 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [entered, anim, rowIndex]);

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
      style={[
        styles.row,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

function JewelExpandOverlay({
  origin,
  round,
  shopState,
  gems,
  demoMode,
  busy,
  reduceMotion,
  windowWidth,
  windowHeight,
  onClose,
  onPlay,
  onPurchase,
}: {
  origin: CardOrigin;
  round: ReturnType<typeof getRoundDef>;
  shopState: RoundShopState;
  gems: number;
  demoMode: boolean;
  busy: boolean;
  reduceMotion: boolean;
  windowWidth: number;
  windowHeight: number;
  onClose: () => void;
  onPlay: (level: RoundLevel) => void;
  onPurchase: (level: RoundLevel) => Promise<boolean>;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  const targetW = Math.min(windowWidth - 32, 400);
  const targetH = Math.min(windowHeight * 0.74, 540);
  const targetX = (windowWidth - targetW) / 2;
  const targetY = Math.max(insets.top + 16, (windowHeight - targetH) / 2);

  const originCx = origin.x + origin.width / 2;
  const originCy = origin.y + origin.height / 2;
  const targetCx = targetX + targetW / 2;
  const targetCy = targetY + targetH / 2;
  const startTx = originCx - targetCx;
  const startTy = originCy - targetCy;
  const startScaleX = origin.width / Math.max(1, targetW);
  const startScaleY = origin.height / Math.max(1, targetH);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.spring(progress, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion]);

  const close = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.spring(progress, {
      toValue: 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const pulseThen = (fn: () => void) => {
    if (reduceMotion) {
      fn();
      return;
    }
    Animated.sequence([
      Animated.spring(pulse, {
        toValue: 1.05,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.spring(pulse, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) fn();
    });
  };

  const canAffordUnlock =
    shopState.kind === 'unlock' && (demoMode || gems >= shopState.cost);
  const showLetsGo =
    shopState.kind === 'play' || (shopState.kind === 'unlock' && canAffordUnlock);

  const spendLabel = (() => {
    if (shopState.kind === 'play') return `Play Level ${shopState.level}`;
    if (shopState.kind === 'mastered') return 'Mastered 🏆';
    if (shopState.kind === 'locked') {
      return `Score ${LEVEL_QUALIFY_SCORE}+ on Level ${shopState.level} to unlock Level ${shopState.blockedLevel}`;
    }
    if (demoMode) return 'Try for free 🎭';
    return `Spend ${shopState.cost} 💎`;
  })();

  const cost = shopState.kind === 'unlock' ? shopState.cost : 0;
  const after = Math.max(0, gems - (demoMode ? 0 : cost));

  const handleLetsGo = () => {
    if (busy || !showLetsGo) return;
    if (shopState.kind === 'play') {
      pulseThen(() => onPlay(shopState.level));
      return;
    }
    if (shopState.kind !== 'unlock') return;
    const level = shopState.level;
    void (async () => {
      const ok = await onPurchase(level);
      if (!ok) return;
      pulseThen(() => onPlay(level));
    })();
  };

  return (
    <View style={styles.overlayHost} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close">
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.72],
              }),
            },
          ]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.expandCard,
          {
            left: targetX,
            top: targetY,
            width: targetW,
            height: targetH,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [startTx, 0],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [startTy, 0],
                }),
              },
              {
                scaleX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [startScaleX, 1],
                }),
              },
              {
                scaleY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [startScaleY, 1],
                }),
              },
              { scale: pulse },
            ],
          },
        ]}>
        <Animated.View
          style={[
            styles.expandInner,
            {
              opacity: progress.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Text style={styles.expandEmoji}>{round.emoji}</Text>
          <Text style={styles.expandName}>{round.name}</Text>
          {shopState.kind === 'unlock' || shopState.kind === 'play' ? (
            <Text style={styles.expandLevel}>Level {shopState.level}</Text>
          ) : null}
          <Text style={styles.expandSpend}>{spendLabel}</Text>

          {shopState.kind === 'unlock' ? (
            <View style={styles.balanceBox}>
              {demoMode ? (
                <Text style={styles.balanceLine}>Your gems stay at {gems} 💎</Text>
              ) : (
                <>
                  <Text style={styles.balanceLine}>Balance now: {gems} 💎</Text>
                  <Text style={styles.balanceLine}>Balance after: {after} 💎</Text>
                </>
              )}
            </View>
          ) : null}

          {showLetsGo ? (
            <Pressable
              onPress={handleLetsGo}
              disabled={busy}
              style={({ pressed }) => [
                styles.letsGoBtn,
                pressed && styles.btnPressed,
                busy && styles.btnDisabled,
              ]}>
              {busy ? (
                <ActivityIndicator color="#0B0B14" />
              ) : (
                <Text style={styles.letsGoText}>Let&apos;s go</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={close}
            disabled={busy}
            style={({ pressed }) => [styles.notYetBtn, pressed && styles.btnPressed]}>
            <Text style={styles.notYetText}>Not yet</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JEWEL_PALETTE.background },
  safeArea: { flex: 1, backgroundColor: JEWEL_PALETTE.background },
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: GRID_PAD,
    paddingTop: 4,
    paddingBottom: 2,
  },
  close: {
    fontSize: 18,
    fontWeight: '700',
    color: JEWEL_PALETTE.muted,
    width: 32,
  },
  scroll: {
    paddingHorizontal: GRID_PAD,
    gap: 16,
  },
  headerBlock: { gap: 16 },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
  },
  heroCount: {
    fontSize: 48,
    fontWeight: '900',
    color: JEWEL_PALETTE.text,
    letterSpacing: -1,
    lineHeight: 56,
  },
  heroEs: {
    fontSize: 13,
    fontWeight: '600',
    color: JEWEL_PALETTE.muted,
    marginTop: 6,
  },
  heroEn: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5F6678',
  },
  recCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 122, 89, 0.28)',
    backgroundColor: 'rgba(255, 122, 89, 0.06)',
  },
  recText: {
    fontSize: 13,
    fontWeight: '700',
    color: JEWEL_PALETTE.accent,
    textAlign: 'center',
    lineHeight: 18,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expiredText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: JEWEL_PALETTE.red,
  },
  expiredDismiss: { fontSize: 14, fontWeight: '800', color: JEWEL_PALETTE.muted },
  grid: { gap: GRID_GAP },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  expandCard: {
    position: 'absolute',
    backgroundColor: JEWEL_PALETTE.cardRevealed,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.45)',
    overflow: 'hidden',
    shadowColor: JEWEL_PALETTE.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  expandInner: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  expandEmoji: { fontSize: 56, marginBottom: 4 },
  expandName: {
    fontSize: 24,
    fontWeight: '900',
    color: JEWEL_PALETTE.text,
    textAlign: 'center',
  },
  expandLevel: {
    fontSize: 14,
    fontWeight: '700',
    color: JEWEL_PALETTE.muted,
  },
  expandSpend: {
    fontSize: 16,
    fontWeight: '800',
    color: JEWEL_PALETTE.accent,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  balanceBox: {
    width: '100%',
    backgroundColor: 'rgba(11, 11, 20, 0.65)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
    marginVertical: 8,
  },
  balanceLine: {
    fontSize: 14,
    fontWeight: '700',
    color: JEWEL_PALETTE.muted,
    textAlign: 'center',
  },
  letsGoBtn: {
    width: '100%',
    backgroundColor: JEWEL_PALETTE.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  letsGoText: { fontSize: 16, fontWeight: '900', color: '#0B0B14' },
  notYetBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: JEWEL_PALETTE.cardBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  notYetText: { fontSize: 15, fontWeight: '800', color: JEWEL_PALETTE.muted },
  btnPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.55 },
});
