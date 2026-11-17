/**
 * One payment on the customer detail screen (docs/DESIGN.md 13.6.7): tonal
 * receipt icon, amount in the paid colour, "date · method · month", who
 * received it (premium staff) and the note. Tapping the row opens the receipt;
 * the trailing labelled buttons open the receipt and, when allowed, delete.
 */
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PaymentRow } from '../../db/repo';
import { useApp } from '../../state/app';
import { colors, radius, size, space } from '../../theme';
import { METHOD_LABEL } from '../RecordPaymentSheet';
import { Amount, IconButton, Row, TonalIcon, Txt } from '../ui';
import { useA11yJoin } from './text';

function PaymentItemView({
  payment: p,
  onDelete,
}: {
  payment: PaymentRow;
  /** Shown only when the user may delete payments; the caller asks for confirmation. */
  onDelete?: (p: PaymentRow) => void;
}) {
  const { t, money, dateLabel, monthLabel, premium, staffLabel, rowDir } = useApp();
  const join = useA11yJoin();
  const method = t(METHOD_LABEL[p.method]);
  const receivedBy =
    premium.active && p.received_by
      ? t('receivedByName', { name: staffLabel({ name: p.received_by_name, role: p.received_by_role }) })
      : null;
  const openReceipt = () => router.push(`/receipt/${p.id}`);

  return (
    <Row gap={space.xs} style={styles.row}>
      <View style={styles.mainClip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={join([
            t('customersPaymentA11y', {
              amount: money(p.amount),
              date: dateLabel(p.paid_on),
              method,
              month: monthLabel(p.month),
            }),
            receivedBy,
            p.note,
          ])}
          accessibilityHint={t('receipt')}
          onPress={openReceipt}
          android_ripple={{ color: colors.rippleNeutral }}
          style={[styles.main, { flexDirection: rowDir }]}
        >
          <TonalIcon name="receipt-outline" />
          <View style={styles.text}>
            <Amount value={p.amount} tone="paid" weight={600} tabular />
            <Txt variant="small">{[dateLabel(p.paid_on), method, monthLabel(p.month)].join(' · ')}</Txt>
            {receivedBy ? <Txt variant="small">{receivedBy}</Txt> : null}
            {p.note ? <Txt variant="small">{p.note}</Txt> : null}
          </View>
        </Pressable>
      </View>
      <IconButton name="receipt-outline" label={t('receipt')} onPress={openReceipt} />
      {onDelete ? (
        <IconButton
          name="trash-outline"
          label={t('deletePayment')}
          color={colors.textSecondary}
          onPress={() => onDelete(p)}
        />
      ) : null}
    </Row>
  );
}

export const PaymentItem = memo(PaymentItemView);

const styles = StyleSheet.create({
  row: { minHeight: 72 },
  mainClip: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  main: { alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: size.touch },
  text: { flex: 1, gap: space.xxs },
});
