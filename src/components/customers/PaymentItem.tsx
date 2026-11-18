/**
 * One payment on the customer detail screen (docs/DESIGN.md 13.6.7): tonal
 * receipt icon, amount in the paid colour, "date · method · month", who
 * received it (premium staff) and the note. Tapping the row opens the receipt;
 * the trailing labelled buttons open the receipt and, when allowed, delete.
 */
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { PaymentRow } from '../../db/repo';
import { proofUri } from '../../lib/proofs';
import { useApp } from '../../state/app';
import { colors, radius, size, space } from '../../theme';
import { METHOD_LABEL } from '../RecordPaymentSheet';
import { Amount, IconButton, Row, TonalIcon, Txt } from '../ui';
import { ProofViewer } from './ProofViewer';
import { useA11yJoin } from './text';

function PaymentItemView({
  payment: p,
  onDelete,
  onAttachProof,
  onRemoveProof,
}: {
  payment: PaymentRow;
  /** Shown only when the user may delete payments; the caller asks for confirmation. */
  onDelete?: (p: PaymentRow) => void;
  /** Shown (when there is no screenshot yet) only when the user may add payments. */
  onAttachProof?: (p: PaymentRow) => void;
  /** Offered in the viewer only when the user may add payments; the caller asks for confirmation. */
  onRemoveProof?: (p: PaymentRow) => void;
}) {
  const { t, money, dateLabel, monthLabel, premium, staffLabel, rowDir } = useApp();
  const join = useA11yJoin();
  const method = t(METHOD_LABEL[p.method]);
  const receivedBy =
    premium.active && p.received_by
      ? t('receivedByName', { name: staffLabel({ name: p.received_by_name, role: p.received_by_role }) })
      : null;
  const openReceipt = () => router.push(`/receipt/${p.id}`);
  const [viewing, setViewing] = useState(false);
  const proof = p.proof_file ? proofUri(p.proof_file) : null;

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
            proof ? t('customersProofAttached') : null,
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
      {proof ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={t('customersProofView')}
          onPress={() => setViewing(true)}
          style={styles.thumbButton}
        >
          <Image source={{ uri: proof }} style={styles.thumb} />
        </Pressable>
      ) : onAttachProof ? (
        <IconButton
          name="image-outline"
          label={t('customersProofAttach')}
          color={colors.textSecondary}
          onPress={() => onAttachProof(p)}
        />
      ) : null}
      <IconButton name="receipt-outline" label={t('receipt')} onPress={openReceipt} />
      {onDelete ? (
        <IconButton
          name="trash-outline"
          label={t('deletePayment')}
          color={colors.textSecondary}
          onPress={() => onDelete(p)}
        />
      ) : null}
      <ProofViewer
        uri={viewing ? proof : null}
        title={`${money(p.amount)} · ${dateLabel(p.paid_on)}`}
        onClose={() => setViewing(false)}
        onRemove={
          onRemoveProof
            ? () => {
                setViewing(false);
                onRemoveProof(p);
              }
            : undefined
        }
      />
    </Row>
  );
}

export const PaymentItem = memo(PaymentItemView);

const styles = StyleSheet.create({
  row: { minHeight: 72 },
  mainClip: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  main: { alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: size.touch },
  text: { flex: 1, gap: space.xxs },
  thumbButton: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceContainer },
});
