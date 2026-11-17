/** Screen 13: Fee change - change a customer's fee from a chosen month; saved to fee history (docs/DESIGN.md 13.8). */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FeeTimeline } from '../../../components/customers/FeeTimeline';
import { FormScreen } from '../../../components/ds/FormScreen';
import { useA11yJoin, useLtr } from '../../../components/customers/text';
import { StatTile } from '../../../components/ds/StatTile';
import { MonthPicker } from '../../../components/pickers';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  SectionHeader,
  Txt,
  useCurrencyPrefix,
} from '../../../components/ui';
import { changeFee, customerDues, deleteFeeChange, feeHistory, getCustomer } from '../../../db/repo';
import type { FeeChange } from '../../../db/types';
import { useQuery } from '../../../db/useQuery';
import { addMonths, currentMonthKey, monthOfDay, type MonthKey } from '../../../lib/date';
import { parseAmount } from '../../../lib/money';
import { useApp } from '../../../state/app';
import { colors, space } from '../../../theme';
import { showToast } from '../../../lib/toast';

export default function FeeChangeScreen() {
  const db = useSQLiteContext();
  const { t, money, monthLabel, can, business } = useApp();
  const ltr = useLtr();
  const join = useA11yJoin();
  const currencyPrefix = useCurrencyPrefix();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: customer, loading } = useQuery((d) => getCustomer(d, id), [id]);
  const { data: history } = useQuery((d) => feeHistory(d, id), [id]);
  const { data: dues } = useQuery((d) => customerDues(d, id), [id]);
  const current = currentMonthKey();
  const [picked, setMonth] = useState<MonthKey>(current);
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading && !customer) return null;
  // Only customers of the open business (a deep link could name any id).
  if (!customer || customer.business_id !== business?.id) {
    return <EmptyState icon="alert-circle-outline" tone="neutral" title={t('customerNotFound')} />;
  }
  if (!can('customers.edit')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;

  const startMonth = monthOfDay(customer.start_date);
  // A customer starting in a future month can't have a fee before it.
  const month = picked < startMonth ? startMonth : picked;
  const parsed = parseAmount(fee);
  // Months already billed that this change re-prices, and how many have payments.
  const affected = (dues ?? []).filter((d) => d.month >= month);
  const affectedPaid = affected.filter((d) => d.paid_amount > 0).length;

  const save = async () => {
    if (!can('customers.edit')) return;
    if (parsed === null) {
      setError(t('feeInvalid'));
      return;
    }
    setSaving(true);
    try {
      await changeFee(db, customer.id, month, parsed, note.trim() || null);
      showToast(t('feeChanged'));
      router.back();
    } catch {
      // Fixed message only: the error may contain customer details.
      if (__DEV__) console.warn('FeeChange: saving the fee change failed');
      setError(t('somethingWrong'));
      setSaving(false);
    }
  };

  const changeLabel = (c: FeeChange) =>
    t('feeChangeLine', {
      month: monthLabel(c.effective_month),
      from: ltr(money(c.old_fee)),
      to: ltr(money(c.new_fee)),
    });

  const confirmUndo = (changeId: string, label: string) =>
    Alert.alert(t('undoFeeChange'), t('undoFeeChangeConfirm', { change: label }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('undo'),
        style: 'destructive',
        onPress: () => {
          if (can('customers.edit')) deleteFeeChange(db, changeId);
        },
      },
    ]);

  return (
    <FormScreen
      footer={<Button title={t('saveFee')} icon="checkmark" size="lg" onPress={save} loading={saving} />}
    >
      <StatTile label={t('customersCurrentFee')} value={customer.current_fee} sub={customer.name} />

      <Card style={styles.form}>
        <Field
          label={t('newMonthlyFee')}
          value={fee}
          onChangeText={(v) => {
            setFee(v);
            setError(null);
          }}
          size="amount"
          prefix={currencyPrefix}
          keyboardType="number-pad"
          placeholder={String(customer.current_fee)}
          error={error}
          maxLength={9}
          autoFocus
        />
        <View style={styles.group}>
          <Txt variant="label">{t('fromMonth')}</Txt>
          <MonthPicker value={month} onChange={setMonth} min={startMonth} max={addMonths(current, 12)} />
        </View>
        {month < current && affected.length > 0 ? (
          <Banner tone="warning" body={t('feePastWarning', { count: affected.length, paid: affectedPaid })} />
        ) : month > current ? (
          <Banner tone="info" body={t('feeFutureNote', { month: monthLabel(month) })} />
        ) : (
          <Banner tone="info" body={t('feeFromNote', { month: monthLabel(month) })} />
        )}
        <Field
          label={`${t('reason')} (${t('optional')})`}
          value={note}
          onChangeText={setNote}
          placeholder={t('reasonPlaceholder')}
          maxLength={100}
        />
      </Card>

      <SectionHeader title={t('feeHistory')} />
      <Card>
        {history && history.length > 0 ? (
          <FeeTimeline
            changes={history}
            trailing={(c) => (
              <IconButton
                name="arrow-undo-outline"
                label={join([t('undoFeeChange'), monthLabel(c.effective_month)])}
                color={colors.textSecondary}
                flipForRTL
                onPress={() => confirmUndo(c.id, changeLabel(c))}
              />
            )}
          />
        ) : (
          <Txt variant="muted">{t('noFeeChanges', { amount: ltr(money(customer.current_fee)) })}</Txt>
        )}
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  group: { gap: space.sm },
});
