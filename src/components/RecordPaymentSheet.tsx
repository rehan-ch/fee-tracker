/**
 * Screen 4: Record payment bottom sheet (docs/DESIGN.md 13.3). Amount is
 * pre-filled with what is still due, date defaults to today, and one tap
 * saves. The Save buttons sit in the sheet's sticky footer.
 */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { addPayment } from '../db/repo';
import { PAYMENT_METHODS, type MonthlyDue, type PaymentMethod } from '../db/types';
import type { StringKey } from '../i18n/strings';
import { todayKey, type DayKey } from '../lib/date';
import { deleteCacheCopy } from '../lib/exportFiles';
import { attachProof, pickProofImage, ProofError } from '../lib/proofs';
import { remainingOf } from '../lib/dues';
import { parseAmount } from '../lib/money';
import { useApp } from '../state/app';
import { colors, radius, size, space } from '../theme';
import { BottomSheet } from './ds/Sheet';
import { DateField } from './pickers';
import {
  Amount,
  Avatar,
  Banner,
  bidiIsolate,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  Icon,
  IconButton,
  Row,
  Txt,
  useCurrencyPrefix,
  type IconName,
  type TextTone,
} from './ui';
import { showToast } from '../lib/toast';

export const METHOD_LABEL: Record<PaymentMethod, StringKey> = {
  cash: 'methodCash',
  jazzcash: 'methodJazzcash',
  easypaisa: 'methodEasypaisa',
  bank: 'methodBank',
};

/** Fixed icon per payment method (docs/DESIGN.md 9). No brand logos or colours. */
export const METHOD_ICON: Record<PaymentMethod, IconName> = {
  cash: 'cash-outline',
  jazzcash: 'phone-portrait-outline',
  easypaisa: 'wallet-outline',
  bank: 'business-outline',
};

export type SheetDue = MonthlyDue & { customer_name: string };

export function RecordPaymentSheet({
  due,
  onClose,
}: {
  due: SheetDue | null;
  onClose: () => void;
}) {
  if (!due) return null;
  // Keyed by due, so the form starts fresh every time a row is opened.
  return <PaymentForm key={due.id} due={due} onClose={onClose} />;
}

function PaymentForm({ due, onClose }: { due: SheetDue; onClose: () => void }) {
  const db = useSQLiteContext();
  const { t, money, monthLabel, staff, isRTL, rowDir, can } = useApp();
  const remaining = remainingOf(due);
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '');
  const [paidOn, setPaidOn] = useState<DayKey>(todayKey);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [withReceipt, setWithReceipt] = useState(false);
  // A picked screenshot waits in the cache until the payment is saved.
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  // Blocks a second save from a fast double tap before `saving` re-renders the buttons.
  const busy = useRef(false);

  const parsed = parseAmount(amount);
  const extra = parsed !== null && parsed > remaining ? parsed - remaining : 0;
  const iso = (s: string) => (isRTL ? bidiIsolate(s) : s);
  const prefix = useCurrencyPrefix();

  const changeAmount = (v: string) => {
    setAmount(v);
    setError(null);
    setSaveError(null);
  };

  const pickProof = async () => {
    setProofError(null);
    try {
      const uri = await pickProofImage();
      if (!uri) return;
      if (proofUri) deleteCacheCopy(proofUri);
      setProofUri(uri);
    } catch (e) {
      setProofError(t(e instanceof ProofError && e.kind === 'tooLarge' ? 'customersProofTooLarge' : 'customersProofPickFailed'));
    }
  };

  const clearProof = () => {
    if (proofUri) deleteCacheCopy(proofUri);
    setProofUri(null);
  };

  const save = async (receipt: boolean) => {
    if (busy.current) return;
    // Callers only open the sheet with this permission; check again in case the role changed meanwhile.
    if (!can('payments.add')) {
      setSaveError(t('noAccess'));
      return;
    }
    if (parsed === null || parsed <= 0) {
      setError(t('amountInvalid'));
      return;
    }
    busy.current = true;
    setSaveError(null);
    setSaving(true);
    setWithReceipt(receipt);
    try {
      const paymentId = await addPayment(db, {
        monthly_due_id: due.id,
        amount: parsed,
        paid_on: paidOn,
        method,
        note: note.trim() || null,
        received_by: staff?.id ?? null,
      });
      if (proofUri) {
        try {
          await attachProof(db, paymentId, proofUri);
        } catch {
          // The payment is saved; only the picture is missing.
          if (__DEV__) console.warn('Attaching the screenshot failed');
          showToast(t('customersProofPickFailed'), true);
        }
      }
      showToast(t('paymentSaved'));
      onClose();
      if (receipt) router.push(`/receipt/${paymentId}`);
    } catch {
      // Never log the error object: it can hold customer data.
      if (__DEV__) console.warn('Saving payment failed');
      setSaveError(t('somethingWrong'));
      setSaving(false);
      busy.current = false;
    }
  };

  const footer = (
    <>
      {saveError ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('designErrorLabel', { message: saveError })}
          style={[styles.errorRow, { flexDirection: rowDir }]}
        >
          <Icon name="alert-circle" size={size.iconSm} color={colors.danger} />
          <View style={styles.flex}>
            <Txt variant="small" tone="danger">
              {saveError}
            </Txt>
          </View>
        </View>
      ) : null}
      <Button
        title={t('savePayment')}
        icon="checkmark"
        size="lg"
        onPress={() => save(false)}
        loading={saving && !withReceipt}
        disabled={saving}
      />
      <Button
        title={t('saveAndReceipt')}
        icon="receipt-outline"
        variant="tonal"
        onPress={() => save(true)}
        loading={saving && withReceipt}
        disabled={saving}
      />
    </>
  );

  return (
    <BottomSheet visible onClose={onClose} footer={footer}>
      {/* In the scroll area (not the fixed header) so small phones keep room for the form above the keyboard. */}
      <Row gap={space.md}>
        <Avatar name={due.customer_name} />
        <View style={styles.flex}>
          <Txt variant="title" numberOfLines={1} header>
            {due.customer_name}
          </Txt>
          <Txt variant="muted">{`${t('recordPayment')} · ${monthLabel(due.month)}`}</Txt>
        </View>
      </Row>

      <Card variant="outlined" style={styles.summary}>
        <SummaryRow label={t('totalDue')} value={Math.max(due.total_due, 0)} />
        <SummaryRow label={t('alreadyPaid')} value={due.paid_amount} tone="paid" />
        <Divider />
        <SummaryRow
          label={t('remaining')}
          value={remaining}
          tone={remaining > 0 ? 'unpaid' : 'paid'}
          strong
        />
        {due.carried_forward !== 0 ? (
          <Row gap={space.xs} align="flex-start" style={styles.carried}>
            <Icon name="information-circle" size={size.iconSm} color={colors.info} />
            <View style={styles.flex}>
              <Txt variant="small">
                {due.carried_forward > 0
                  ? t('includesPrevious', { amount: iso(money(due.carried_forward)) })
                  : t('creditFromPrevious', { amount: iso(money(-due.carried_forward)) })}
              </Txt>
            </View>
          </Row>
        ) : null}
      </Card>

      <View style={styles.group}>
        <Field
          label={t('amountReceived')}
          value={amount}
          onChangeText={changeAmount}
          size="amount"
          prefix={prefix}
          error={error}
          maxLength={10}
        />
        {remaining > 0 ? (
          <Row>
            <Chip
              variant="assist"
              icon="cash-outline"
              label={t('coreFullAmount', { amount: iso(money(remaining)) })}
              onPress={() => changeAmount(String(remaining))}
            />
          </Row>
        ) : null}
        {extra > 0 ? <Banner tone="info" live body={t('overpayNote', { amount: iso(money(extra)) })} /> : null}
      </View>

      <View style={styles.group}>
        <Txt variant="label">{t('paymentMethod')}</Txt>
        <Row wrap gap={space.sm}>
          {PAYMENT_METHODS.map((m) => (
            <Chip
              key={m}
              icon={METHOD_ICON[m]}
              label={t(METHOD_LABEL[m])}
              selected={method === m}
              onPress={() => setMethod(m)}
            />
          ))}
        </Row>
      </View>

      <DateField label={t('paymentDate')} value={paidOn} onChange={setPaidOn} maxToday />

      <Field
        label={`${t('note')} (${t('optional')})`}
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />

      <View style={styles.group}>
        <Txt variant="label">{`${t('customersProofLabel')} (${t('optional')})`}</Txt>
        {proofUri ? (
          <Row gap={space.md}>
            <Image source={{ uri: proofUri }} accessibilityLabel={t('customersProofLabel')} style={styles.thumb} />
            <View style={styles.flex}>
              <Txt variant="small">{t('customersProofAttached')}</Txt>
            </View>
            <IconButton name="trash-outline" label={t('customersProofRemove')} onPress={clearProof} />
          </Row>
        ) : (
          <>
            <Row>
              <Chip variant="assist" icon="image-outline" label={t('customersProofAttach')} onPress={pickProof} />
            </Row>
            <Txt variant="small">{t('customersProofHint')}</Txt>
          </>
        )}
        {proofError ? (
          <Txt variant="small" tone="danger">
            {proofError}
          </Txt>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** One line of the summary table: label at the reading start, tabular amount at the end. */
function SummaryRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: TextTone;
  strong?: boolean;
}) {
  const { money } = useApp();
  return (
    <View accessible accessibilityLabel={`${label}: ${money(value)}`}>
      <Row gap={space.md} justify="space-between">
        <View style={styles.flex}>
          <Txt variant={strong ? 'body' : 'muted'} weight={strong ? 700 : undefined}>
            {label}
          </Txt>
        </View>
        <Amount
          value={value}
          variant={strong ? 'h2' : 'body'}
          tone={tone}
          weight={strong ? 700 : 600}
          tabular
          align="end"
        />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { borderRadius: radius.md, padding: space.md, gap: space.sm },
  carried: { marginTop: space.xxs },
  group: { gap: space.sm },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceContainer },
  errorRow: { alignItems: 'flex-start', gap: space.xs },
});
