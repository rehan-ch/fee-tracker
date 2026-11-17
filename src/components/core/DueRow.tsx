/**
 * One customer's due for the month in the Collection list (docs/DESIGN.md
 * 13.2): status circle, name, area · phone · reminded on, an optional notes
 * line, then the amount and its word at the end and a chevron. A white
 * level-1 card with ripple, read by TalkBack as one sentence. Memoised: pass
 * a stable `onPress` (it receives the row).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DueListRow } from '../../db/types';
import { toDayKey } from '../../lib/date';
import { remainingOf } from '../../lib/dues';
import { useApp } from '../../state/app';
import { colors, radius, shadow, size, space } from '../../theme';
import { Amount, bidiIsolate, Icon, shadowFallback, StatusIcon, Txt } from '../ui';

function DueRowImpl({ row, onPress }: { row: DueListRow; onPress: (row: DueListRow) => void }) {
  const { t, money, dateLabel, rowDir, isRTL, can } = useApp();
  const iso = (s: string) => (isRTL ? bidiIsolate(s) : s);
  const status = row.status;
  const remaining = remainingOf(row);

  const remindedAt = status !== 'paid' && row.last_reminded_at ? new Date(row.last_reminded_at) : null;
  const reminded =
    remindedAt && !Number.isNaN(remindedAt.getTime())
      ? t('remindedOn', { date: dateLabel(toDayKey(remindedAt)) })
      : null;
  const phone = row.customer_phone ? iso(row.customer_phone) : null;
  const sub = [row.area_name, phone, reminded].filter(Boolean).join(' · ');

  // Paid rows show what was paid and when; others show what is still due.
  const amount = status === 'paid' ? row.paid_amount : remaining;
  const word =
    status === 'paid'
      ? row.last_paid_on
        ? dateLabel(row.last_paid_on)
        : t('paid')
      : status === 'partial'
        ? `${t('paid')} ${iso(money(row.paid_amount))}`
        : t('due');

  const sep = isRTL ? '، ' : ', ';
  const amountPhrase =
    status === 'paid'
      ? `${money(amount)}${sep}${word}`
      : status === 'partial'
        ? `${money(amount)} ${t('due')}${sep}${word}`
        : `${money(amount)} ${t('due')}`;
  const label = [row.customer_name, t(status), amountPhrase, row.area_name, row.customer_phone, reminded, row.customer_notes]
    .filter(Boolean)
    .join(sep);
  // Same rule as the screen's onPress: unpaid / partial rows open the payment sheet.
  const hint = status !== 'paid' && can('payments.add') ? t('recordPayment') : undefined;

  return (
    <View style={[styles.card, shadowFallback]}>
      <View style={styles.clip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={hint}
          onPress={() => onPress(row)}
          android_ripple={{ color: colors.rippleNeutral }}
          style={[styles.row, { flexDirection: rowDir }]}
        >
          <StatusIcon status={status} />
          <View style={styles.main}>
            <Txt variant="h2" numberOfLines={1}>
              {row.customer_name}
            </Txt>
            {sub ? (
              <Txt variant="small" numberOfLines={1}>
                {sub}
              </Txt>
            ) : null}
            {row.customer_notes ? (
              <View style={[styles.note, { flexDirection: rowDir }]}>
                <Icon name="document-text-outline" size={size.iconSm} color={colors.onWarningContainer} />
                <View style={styles.flex}>
                  <Txt variant="small" numberOfLines={1} color={colors.onWarningContainer}>
                    {row.customer_notes}
                  </Txt>
                </View>
              </View>
            ) : null}
          </View>
          <View style={[styles.end, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
            <Amount value={amount} variant="h2" tone={status} weight={700} tabular align="end" numberOfLines={1} />
            <Txt variant="small" align="end" numberOfLines={1}>
              {word}
            </Txt>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL />
        </Pressable>
      </View>
    </View>
  );
}

export const DueRow = memo(DueRowImpl);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow.level1 },
  clip: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: 72,
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    // 16dp like the Customers and Reminders rows.
    paddingHorizontal: space.lg,
  },
  main: { flex: 1, gap: space.xxs },
  note: { alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
  end: { maxWidth: '45%', gap: space.xxs },
});
