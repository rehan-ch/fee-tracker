import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Area } from '../db/types';
import { addMonths, currentMonthKey, dayKeyToDate, toDayKey, type DayKey, type MonthKey } from '../lib/date';
import { useApp } from '../state/app';
import { colors, radius, shadow, size, space } from '../theme';
import { useFontsLoaded } from './ds/fonts';
import { BottomSheet } from './ds/Sheet';
import { Button, Chip, ChipRow, Icon, IconButton, Row, scriptTextStyle, shadowFallback, Txt } from './ui';

/**
 * "‹ November 2026 ›" in a white pill. Tapping the label (or the "This month"
 * button shown when another month is open) jumps back to the current month.
 * By default it can't go past the current month; `max` and `min` change the range.
 */
export function MonthPicker({
  value,
  onChange,
  min,
  max,
}: {
  value: MonthKey;
  onChange: (m: MonthKey) => void;
  min?: MonthKey;
  max?: MonthKey;
}) {
  const { monthLabel, t, isRTL } = useApp();
  const loaded = useFontsLoaded();
  const current = currentMonthKey();
  const atCurrent = value >= (max ?? current);
  const atMin = min !== undefined && value <= min;
  const currentInRange = (min === undefined || current >= min) && current <= (max ?? current);
  const showThisMonth = value !== current && currentInRange;
  const prev = addMonths(value, -1);
  const next = addMonths(value, 1);
  return (
    <Row justify="space-between" gap={space.xs} style={styles.monthPicker}>
      <IconButton
        name="chevron-back"
        label={t('designPreviousMonth', { month: monthLabel(prev) })}
        onPress={() => !atMin && onChange(prev)}
        disabled={atMin}
        color={colors.text}
        flipForRTL
      />
      <View style={styles.monthCenter}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('thisMonth')}
          onPress={() => onChange(current)}
          style={styles.monthLabel}
        >
          <Txt variant="h2" center>
            {monthLabel(value)}
          </Txt>
        </Pressable>
        {showThisMonth ? (
          <View hitSlop={8} style={styles.thisMonthClip}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(current)}
              hitSlop={8}
              android_ripple={{ color: colors.ripple }}
              style={styles.thisMonth}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  scriptTextStyle('labelSmall', isRTL, loaded, { naturalLine: true }),
                  styles.thisMonthText,
                ]}
              >
                {t('thisMonth')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <IconButton
        name="chevron-forward"
        label={t('designNextMonth', { month: monthLabel(next) })}
        onPress={() => !atCurrent && onChange(next)}
        disabled={atCurrent}
        color={colors.text}
        flipForRTL
      />
    </Row>
  );
}

export interface PickerRequest {
  mode: 'date' | 'time';
  value: Date;
  maximumDate?: Date;
  /** Sheet title on iOS (Android's dialog has none). */
  title?: string;
  onPick: (picked: Date) => void;
}

/**
 * The system date or time picker. Android opens its picker dialog. iOS has
 * no dialog, only a picker view, so there it opens in a bottom sheet: render
 * `picker` somewhere in the calling screen (it's null on Android).
 */
export function useSystemPicker(): { open: (request: PickerRequest) => void; picker: ReactNode } {
  const [request, setRequest] = useState<PickerRequest | null>(null);
  const open = useCallback((r: PickerRequest) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: r.value,
        mode: r.mode,
        maximumDate: r.maximumDate,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) r.onPick(picked);
        },
      });
      return;
    }
    setRequest(r);
  }, []);
  const picker = request ? <PickerSheet request={request} onClose={() => setRequest(null)} /> : null;
  return { open, picker };
}

/** iOS: the native calendar (dates) or wheel (times) in a sheet with Cancel and Done. */
function PickerSheet({ request, onClose }: { request: PickerRequest; onClose: () => void }) {
  const { t } = useApp();
  const [draft, setDraft] = useState(request.value);
  const done = () => {
    onClose();
    request.onPick(draft);
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={request.title}
      footer={
        <Row gap={space.sm}>
          <Button title={t('cancel')} variant="text" onPress={onClose} style={styles.flex} />
          <Button title={t('done')} variant="filled" onPress={done} style={styles.flex} />
        </Row>
      }
    >
      <DateTimePicker
        value={draft}
        mode={request.mode}
        display={request.mode === 'date' ? 'inline' : 'spinner'}
        maximumDate={request.maximumDate}
        onChange={(_, picked) => {
          if (picked) setDraft(picked);
        }}
        themeVariant="light"
        accentColor={colors.primary}
        textColor={colors.text}
        style={styles.nativePicker}
      />
    </BottomSheet>
  );
}

/** Opens the date picker for a day key; see `useSystemPicker`. */
export function pickDay(
  open: (request: PickerRequest) => void,
  value: DayKey,
  onChange: (d: DayKey) => void,
  opts: { maximumDate?: Date; title?: string } = {},
): void {
  open({ mode: 'date', value: dayKeyToDate(value), ...opts, onPick: (d) => onChange(toDayKey(d)) });
}

/** A form row showing a date in a Field-style outlined box; tapping opens the date picker. */
export function DateField({
  label,
  value,
  onChange,
  hint,
  maxToday,
}: {
  label: string;
  value: DayKey;
  onChange: (d: DayKey) => void;
  hint?: string;
  maxToday?: boolean;
}) {
  const { dateLabel, rowDir } = useApp();
  const { open, picker } = useSystemPicker();
  return (
    <View style={styles.dateWrap}>
      <Txt variant="label">{label}</Txt>
      <View style={styles.dateClip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${dateLabel(value)}`}
          onPress={() => pickDay(open, value, onChange, { maximumDate: maxToday ? new Date() : undefined, title: label })}
          android_ripple={{ color: colors.ripple }}
          style={[styles.dateField, { flexDirection: rowDir }]}
        >
          <View style={styles.flex}>
            <Txt variant="bodyLarge">{dateLabel(value)}</Txt>
          </View>
          <Icon name="calendar-outline" size={size.icon} color={colors.primary} />
        </Pressable>
      </View>
      {hint ? <Txt variant="small">{hint}</Txt> : null}
      {picker}
    </View>
  );
}

/** Horizontal chips: All areas, each area, No area. Value: null | area id | 'none'. */
export function AreaFilter({
  areas,
  value,
  onChange,
}: {
  areas: Pick<Area, 'id' | 'name'>[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { t } = useApp();
  if (areas.length === 0) return null;
  return (
    <ChipRow>
      <Chip label={t('allAreas')} selected={value === null} onPress={() => onChange(null)} />
      {areas.map((a) => (
        <Chip key={a.id} label={a.name} selected={value === a.id} onPress={() => onChange(a.id)} />
      ))}
      <Chip label={t('noArea')} selected={value === 'none'} onPress={() => onChange('none')} />
    </ChipRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nativePicker: { alignSelf: 'center' },
  monthPicker: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    minHeight: 52,
    ...shadow.level1,
    ...shadowFallback,
  },
  monthCenter: { flex: 1, alignItems: 'center', gap: 2 },
  // 48dp touch target; the pill stays 52dp high.
  monthLabel: { alignSelf: 'stretch', minHeight: size.touch, justifyContent: 'center' },
  thisMonthClip: { borderRadius: radius.pill, overflow: 'hidden', marginBottom: 2 },
  thisMonth: {
    minHeight: 32,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  thisMonthText: { color: colors.onPrimaryContainer, textAlign: 'center' },
  dateWrap: { gap: 6 },
  dateClip: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  dateField: {
    alignItems: 'center',
    minHeight: size.field - 2,
    paddingHorizontal: space.lg - 1,
    paddingVertical: space.xs,
    gap: space.sm,
  },
});
