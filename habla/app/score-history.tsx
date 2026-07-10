import { AppTextInput } from '@/components/app-text-input';
import { ScoreHistoryChart } from '@/components/score-history-chart';
import { progressPalette } from '@/components/progress/chart-theme';
import { getLessonHistory } from '@/lib/practice-storage';
import {
  addDaysToDateKey,
  buildScoreHistory,
  formatScoreHistoryDate,
  type ScoreHistoryPeriod,
  type ScoreHistoryPeriodDays,
} from '@/lib/score-history';
import { formatLocalDate } from '@/lib/streak';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PERIOD_OPTIONS: { id: ScoreHistoryPeriodDays | 'custom'; label: string }[] = [
  { id: 7, label: '7 days' },
  { id: 14, label: '14 days' },
  { id: 30, label: '30 days' },
  { id: 'custom', label: 'Custom' },
];

function dateFromPickerValue(value: Date): string {
  return formatLocalDate(value);
}

function pickerValueFromDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export default function ScoreHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 40;

  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof getLessonHistory>>>([]);
  const [period, setPeriod] = useState<ScoreHistoryPeriod>(7);
  const today = formatLocalDate();
  const [customStart, setCustomStart] = useState(addDaysToDateKey(today, -13));
  const [customEnd, setCustomEnd] = useState(today);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getLessonHistory()
        .then((history) => {
          if (!cancelled) setLessons(history);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const data = useMemo(
    () =>
      buildScoreHistory(
        lessons,
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined,
      ),
    [lessons, period, customStart, customEnd],
  );

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (event.type === 'dismissed' || !selected || !pickerTarget) return;
    const key = dateFromPickerValue(selected);
    if (pickerTarget === 'start') setCustomStart(key);
    else setCustomEnd(key);
    if (Platform.OS === 'ios') setPickerTarget(null);
  };

  const changeColor =
    data.stats.changeDirection === 'up'
      ? progressPalette.accent
      : data.stats.changeDirection === 'down'
        ? '#FBBF24'
        : progressPalette.muted;

  const changeText = (() => {
    if (data.stats.change == null) return 'Change: —';
    if (data.stats.changeDirection === 'steady') return 'Change: steady →';
    const sign = data.stats.change > 0 ? '+' : '';
    const arrow = data.stats.changeDirection === 'up' ? ' ↗' : ' ↘';
    return `Change: ${sign}${data.stats.change}%${arrow}`;
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>Your Progress</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((opt) => {
            const selected = period === opt.id;
            return (
              <Pressable
                key={String(opt.id)}
                onPress={() => setPeriod(opt.id)}
                style={[styles.periodPill, selected && styles.periodPillSelected]}>
                <Text style={[styles.periodPillText, selected && styles.periodPillTextSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {period === 'custom' ? (
          <View style={styles.customRow}>
            <Pressable
              onPress={() => setPickerTarget('start')}
              style={styles.dateBtn}
              accessibilityRole="button">
              <Text style={styles.dateLabel}>Start</Text>
              <Text style={styles.dateValue}>{formatScoreHistoryDate(customStart)}</Text>
            </Pressable>
            <Text style={styles.dateSep}>→</Text>
            <Pressable
              onPress={() => setPickerTarget('end')}
              style={styles.dateBtn}
              accessibilityRole="button">
              <Text style={styles.dateLabel}>End</Text>
              <Text style={styles.dateValue}>{formatScoreHistoryDate(customEnd)}</Text>
            </Pressable>
          </View>
        ) : null}

        {pickerTarget && Platform.OS === 'ios' ? (
          <View style={styles.iosPickerCard}>
            <DateTimePicker
              value={pickerValueFromDate(pickerTarget === 'start' ? customStart : customEnd)}
              mode="date"
              display="spinner"
              onChange={onPickerChange}
              maximumDate={pickerValueFromDate(today)}
            />
            <Pressable onPress={() => setPickerTarget(null)} style={styles.pickerDone}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        {pickerTarget && Platform.OS === 'android' ? (
          <DateTimePicker
            value={pickerValueFromDate(pickerTarget === 'start' ? customStart : customEnd)}
            mode="date"
            display="default"
            onChange={onPickerChange}
            maximumDate={pickerValueFromDate(today)}
          />
        ) : null}

        {pickerTarget && Platform.OS === 'web' ? (
          <View style={styles.webDateRow}>
            <AppTextInput
              style={styles.webDateInput}
              value={pickerTarget === 'start' ? customStart : customEnd}
              onChangeText={(text) => {
                if (pickerTarget === 'start') setCustomStart(text);
                else setCustomEnd(text);
              }}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Pressable onPress={() => setPickerTarget(null)} style={styles.pickerDone}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={progressPalette.accent} />
          </View>
        ) : (
          <View style={styles.body}>
            {data.points.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No scored lessons in this period yet.</Text>
              </View>
            ) : (
              <ScoreHistoryChart
                width={chartWidth}
                points={data.points}
                threshold={data.threshold}
                trendLabel={data.stats.trendLabel}
                periodStart={data.periodStart}
                periodEnd={data.periodEnd}
              />
            )}

            <View style={styles.statsGrid}>
              <Text style={styles.statLine}>
                Average score in period: {data.stats.average != null ? `${data.stats.average}%` : '—'}
              </Text>
              <Text style={styles.statLine}>
                Highest score in period:{' '}
                {data.stats.highest
                  ? `${data.stats.highest.score}% (${formatScoreHistoryDate(data.stats.highest.date)})`
                  : '—'}
              </Text>
              <Text style={styles.statLine}>
                Lowest score in period:{' '}
                {data.stats.lowest
                  ? `${data.stats.lowest.score}% (${formatScoreHistoryDate(data.stats.lowest.date)})`
                  : '—'}
              </Text>
              <Text style={styles.statLine}>
                Sessions completed in period: {data.stats.sessionsCompleted}
              </Text>
            </View>

            <View style={styles.compareCard}>
              {period === 'custom' ? (
                <>
                  <Text style={styles.compareLine}>
                    {formatScoreHistoryDate(data.periodStart)}:{' '}
                    {data.stats.startScore != null ? `${data.stats.startScore}%` : '—'}
                  </Text>
                  <Text style={styles.compareLine}>
                    {formatScoreHistoryDate(data.periodEnd)}:{' '}
                    {data.stats.endScore != null ? `${data.stats.endScore}%` : '—'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.compareLine}>
                    Start of period: {data.stats.startScore != null ? `${data.stats.startScore}%` : '—'}
                  </Text>
                  <Text style={styles.compareLine}>
                    End of period: {data.stats.endScore != null ? `${data.stats.endScore}%` : '—'}
                  </Text>
                </>
              )}
              <Text style={[styles.compareChange, { color: changeColor }]}>{changeText}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: progressPalette.background },
  container: { flex: 1, paddingHorizontal: 20, gap: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  back: { fontSize: 24, fontWeight: '600', color: progressPalette.accent, width: 32 },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: progressPalette.text,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: { width: 32 },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    backgroundColor: progressPalette.surface,
  },
  periodPillSelected: {
    borderColor: progressPalette.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.14)',
  },
  periodPillText: { fontSize: 12, fontWeight: '700', color: progressPalette.muted },
  periodPillTextSelected: { color: progressPalette.accent },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: progressPalette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  dateLabel: { fontSize: 10, fontWeight: '800', color: progressPalette.muted, textTransform: 'uppercase' },
  dateValue: { fontSize: 13, fontWeight: '800', color: progressPalette.text, marginTop: 2 },
  dateSep: { fontSize: 14, color: progressPalette.muted, fontWeight: '700' },
  iosPickerCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    overflow: 'hidden',
  },
  pickerDone: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: progressPalette.surfaceBorder,
  },
  pickerDoneText: { fontSize: 14, fontWeight: '800', color: progressPalette.accent },
  webDateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  webDateInput: {
    flex: 1,
    backgroundColor: progressPalette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: progressPalette.text,
    fontWeight: '700',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 12, justifyContent: 'flex-start' },
  emptyCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: progressPalette.muted, textAlign: 'center' },
  statsGrid: { gap: 6 },
  statLine: { fontSize: 13, fontWeight: '600', color: progressPalette.text, lineHeight: 18 },
  compareCard: {
    backgroundColor: progressPalette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: progressPalette.surfaceBorder,
    padding: 12,
    gap: 4,
  },
  compareLine: { fontSize: 13, fontWeight: '700', color: progressPalette.text },
  compareChange: { fontSize: 14, fontWeight: '800', marginTop: 4 },
});
