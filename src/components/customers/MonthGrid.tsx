/**
 * A customer's months, one block per year (docs/DESIGN.md 13.6.5): 4 columns
 * in reading order, each billed month in its status soft colour with the status
 * icon, short month and what is still owed (or a check when paid). Months with
 * no bill sit on surfaceContainer. Each cell reads as one sentence in TalkBack,
 * for example "March 2026, unpaid, Rs 2,000 due".
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MonthlyDue } from '../../db/types';
import type { MonthKey } from '../../lib/date';
import { remainingOf } from '../../lib/dues';
import { formatAmount } from '../../lib/money';
import { useApp } from '../../state/app';
import { colors, radius, space, statusColors } from '../../theme';
import { Icon, Row, StatusBadge, Txt } from '../ui';

/** Month indexes (0 = January) in rows of 4 columns. */
const GRID_ROWS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
];

function monthKeyOf(year: string, index: number): MonthKey {
  return `${year}-${String(index + 1).padStart(2, '0')}`;
}

function MonthGridView({
  dues,
  onPress,
}: {
  dues: MonthlyDue[];
  /** Called for a billed month; omit to show the grid read-only (no permission to add payments). */
  onPress?: (d: MonthlyDue) => void;
}) {
  const years = useMemo(() => {
    const byYear = new Map<string, Map<string, MonthlyDue>>();
    for (const d of dues) {
      const y = d.month.slice(0, 4);
      let months = byYear.get(y);
      if (!months) {
        months = new Map();
        byYear.set(y, months);
      }
      months.set(d.month, d);
    }
    // Newest year first.
    return [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [dues]);

  return (
    <View style={styles.wrap}>
      {years.map(([year, months]) => (
        <View key={year} style={styles.year}>
          <Txt variant="label" ltr header>
            {year}
          </Txt>
          {GRID_ROWS.map((row) => (
            <Row key={row[0]} gap={space.sm} align="stretch">
              {row.map((i) => {
                const key = monthKeyOf(year, i);
                return <MonthCell key={key} month={key} due={months.get(key)} onPress={onPress} />;
              })}
            </Row>
          ))}
        </View>
      ))}
      <Row gap={space.sm} wrap>
        <StatusBadge status="paid" />
        <StatusBadge status="partial" />
        <StatusBadge status="unpaid" />
      </Row>
    </View>
  );
}

function MonthCell({
  month,
  due,
  onPress,
}: {
  month: MonthKey;
  due: MonthlyDue | undefined;
  onPress?: (d: MonthlyDue) => void;
}) {
  const { t, money, monthLabel, shortMonthLabel, rowDir } = useApp();

  if (!due) {
    return (
      <View
        accessible
        accessibilityLabel={t('customersMonthEmptyA11y', { month: monthLabel(month) })}
        style={[styles.cell, styles.cellEmpty]}
      >
        <Txt variant="small" center numberOfLines={1}>
          {shortMonthLabel(month)}
        </Txt>
      </View>
    );
  }

  const c = statusColors[due.status];
  const owed = remainingOf(due);
  const amountA11y =
    due.status === 'paid'
      ? t('customersMonthPaidA11y', { amount: money(due.paid_amount) })
      : t('customersDueA11y', { amount: money(owed) });
  const label = t('customersMonthCellA11y', {
    month: monthLabel(month),
    status: t(due.status),
    amount: amountA11y,
  });

  const content = (
    <>
      <View style={[styles.cellHead, { flexDirection: rowDir }]}>
        <Icon name={c.icon} size={14} color={c.fg} />
        <View style={styles.shrink}>
          <Txt variant="small" weight={600} color={c.onSoft} center numberOfLines={1}>
            {shortMonthLabel(month)}
          </Txt>
        </View>
      </View>
      {due.status === 'paid' ? (
        <Icon name="checkmark" size={16} color={c.onSoft} />
      ) : (
        <Txt
          variant="small"
          ltr
          center
          color={c.onSoft}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={styles.tabular}
        >
          {formatAmount(owed)}
        </Txt>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.cell, { backgroundColor: c.bg }]}>
        {content}
      </View>
    );
  }
  return (
    <View style={[styles.cell, styles.clip, { backgroundColor: c.bg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => onPress(due)}
        android_ripple={{ color: colors.rippleNeutral }}
        style={styles.press}
      >
        {content}
      </Pressable>
    </View>
  );
}

/** Memoised: re-renders only when the dues list or the press handler changes. */
export const MonthGrid = memo(MonthGridView);

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  year: { gap: space.sm },
  cell: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
  clip: { overflow: 'hidden', padding: 0, paddingVertical: 0, paddingHorizontal: 0 },
  press: {
    flexGrow: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
  cellEmpty: { backgroundColor: colors.surfaceContainer },
  cellHead: { alignItems: 'center', justifyContent: 'center', gap: space.xxs, alignSelf: 'stretch' },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
