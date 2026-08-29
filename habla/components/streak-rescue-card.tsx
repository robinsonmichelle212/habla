import { formatLocalDate } from '@/lib/streak';
import {
  STREAK_RESCUE_COST_GEMS,
  getCurrentRescueState,
  purchaseRescue,
  type RescueEligibility,
  type RescueState,
} from '@/lib/streak-rescue';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  accentPressed: '#E86242',
  amber: '#FBBF24',
  red: '#F87171',
};

type Props = {
  hydrated: boolean;
  rescueState: RescueState;
  rescueOffer: RescueEligibility | null;
  dayMissed: boolean;
  missedDate: string | null;
  now: number;
  onPurchased: (state: RescueState) => void;
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => Number(p));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  const ms = db.getTime() - da.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function endOfLocalDay(dateStr: string): Date {
  const d = parseLocalDate(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

function deadlinePhrase(deadline: string, today: string): string {
  const gap = daysBetween(today, deadline);
  if (gap <= 0) return 'tonight';
  if (gap === 1) return 'tomorrow';
  return deadline;
}

function countdownLabel(deadline: string, now: number): string {
  const ms = Math.max(0, endOfLocalDay(deadline).getTime() - now);
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'} left`;
  return `${mins} min${mins === 1 ? '' : 's'} left`;
}

export function StreakRescueCard({
  hydrated,
  rescueState,
  rescueOffer,
  dayMissed,
  missedDate,
  now,
  onPurchased,
}: Props) {
  const [purchasing, setPurchasing] = useState(false);
  const [gemsError, setGemsError] = useState(false);

  if (!hydrated) return null;

  if (rescueState.status === 'pending' && rescueState.deadline) {
    const today = formatLocalDate();
    const byWhen = deadlinePhrase(rescueState.deadline, today);
    const remaining = countdownLabel(rescueState.deadline, now);
    const urgent = endOfLocalDay(rescueState.deadline).getTime() - now < 60 * 60 * 1000;

    return (
      <View
        style={styles.card}
        accessibilityRole="summary"
        accessibilityLabel={`Streak rescue active. Complete a lesson by ${byWhen}. ${remaining}.`}>
        <Text style={styles.title}>
          Streak rescue active — complete a lesson by {byWhen} to save your streak
        </Text>
        <Text style={[styles.countdown, urgent && styles.countdownUrgent]}>{remaining}</Text>
      </View>
    );
  }

  if (rescueState.status !== 'none' || !dayMissed) return null;

  if (rescueOffer?.eligible === true) {
    const handleRescue = async () => {
      if (!missedDate || purchasing) return;
      setGemsError(false);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setPurchasing(true);
      try {
        const result = await purchaseRescue(missedDate);
        if (!result.success) {
          if (result.error === 'insufficient_gems') setGemsError(true);
          return;
        }
        const next = await getCurrentRescueState();
        onPurchased(next);
      } finally {
        setPurchasing(false);
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.offerRow}>
          <View style={styles.offerTextCol}>
            <Text style={styles.title}>
              Missed a day? Rescue your streak for {STREAK_RESCUE_COST_GEMS} gems
            </Text>
            {gemsError ? <Text style={styles.errorText}>Not enough gems</Text> : null}
          </View>
          <Pressable
            onPress={() => void handleRescue()}
            disabled={purchasing}
            style={({ pressed }) => [
              styles.rescueButton,
              pressed && styles.rescueButtonPressed,
              purchasing && styles.rescueButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Rescue streak for ${STREAK_RESCUE_COST_GEMS} gems`}>
            {purchasing ? (
              <ActivityIndicator color="#0B0F14" size="small" />
            ) : (
              <Text style={styles.rescueButtonText}>Rescue Streak</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (rescueOffer?.eligible === false) {
    const message = rescueOffer.onCooldown
      ? `Streak rescue used recently — available again in ${rescueOffer.cooldownDaysRemaining} day${
          rescueOffer.cooldownDaysRemaining === 1 ? '' : 's'
        }`
      : `Complete ${rescueOffer.daysNeeded} more day${
          rescueOffer.daysNeeded === 1 ? '' : 's'
        } of lessons or practice in the next 30 days to unlock streak rescue`;

    return (
      <View style={styles.card} accessibilityRole="text">
        <Text style={styles.mutedMessage}>{message}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 18,
  },
  countdown: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.amber,
  },
  countdownUrgent: {
    color: palette.red,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rescueButton: {
    flexShrink: 0,
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  rescueButtonPressed: { backgroundColor: palette.accentPressed },
  rescueButtonDisabled: { opacity: 0.5 },
  rescueButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B0F14',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.red,
  },
  mutedMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
    lineHeight: 18,
  },
});
