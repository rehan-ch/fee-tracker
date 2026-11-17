/** Screen 6: Add / edit customer form, shared by both routes (docs/DESIGN.md 13.7). */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listAreas } from '../db/repo';
import type { Customer, CustomerInput, CustomerStatus } from '../db/types';
import { useQuery } from '../db/useQuery';
import { todayKey } from '../lib/date';
import { parseAmount } from '../lib/money';
import { isValidPhone } from '../lib/phone';
import { useApp } from '../state/app';
import { space } from '../theme';
import { FormScreen } from './ds/FormScreen';
import { DateField } from './pickers';
import {
  Amount,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  Field,
  Row,
  SectionHeader,
  Segmented,
  Txt,
  useCurrencyPrefix,
} from './ui';

export function CustomerForm({
  initial,
  onSubmit,
  onDelete,
}: {
  initial?: Customer & { current_fee?: number };
  onSubmit: (input: CustomerInput) => Promise<void>;
  onDelete?: () => void;
}) {
  const { t, business } = useApp();
  const bid = business?.id ?? '';
  const { data: areas } = useQuery((d) => listAreas(d, bid), [bid]);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [areaId, setAreaId] = useState<string | null>(initial?.area_id ?? null);
  const [fee, setFee] = useState(initial ? String(initial.monthly_fee) : '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayKey());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<CustomerStatus>(initial?.status ?? 'active');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; fee?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const currencyPrefix = useCurrencyPrefix();

  // When editing, the fee changes on its own screen (with fee history).
  const parsedFee = initial ? initial.monthly_fee : parseAmount(fee);

  const submit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (phone.trim() && !isValidPhone(phone)) next.phone = t('phoneInvalid');
    if (parsedFee === null) next.fee = t('feeInvalid');
    setErrors(next);
    setSaveFailed(false);
    if (Object.keys(next).length || parsedFee === null) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        area_id: areaId,
        monthly_fee: parsedFee,
        start_date: startDate,
        status,
        notes: notes.trim() || null,
      });
    } catch {
      // Fixed message only: the error may contain customer details.
      if (__DEV__) console.warn('CustomerForm: saving the customer failed');
      setSaveFailed(true);
      setSaving(false);
    }
  };

  const hasErrors = !!(errors.name || errors.phone || errors.fee);

  return (
    <FormScreen
      footer={
        <>
          {saveFailed ? (
            <Banner tone="error" body={t('somethingWrong')} />
          ) : hasErrors ? (
            <Banner tone="error" body={t('customersFixErrors')} />
          ) : null}
          <Button title={t('save')} icon="checkmark" size="lg" onPress={submit} loading={saving} />
        </>
      }
    >
      <SectionHeader title={t('customersSectionContact')} />
      <Card style={styles.section}>
        <Field
          label={t('name')}
          value={name}
          onChangeText={setName}
          error={errors.name}
          maxLength={80}
          autoFocus={!initial}
        />
        <Field
          label={`${t('phone')} (${t('optional')})`}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="03XX-XXXXXXX"
          error={errors.phone}
          maxLength={20}
          ltr
        />
      </Card>

      <SectionHeader title={t('customersSectionBilling')} />
      <Card style={styles.section}>
        {initial ? (
          <View style={styles.group}>
            <Txt variant="label">{t('monthlyFee')}</Txt>
            <Row justify="space-between" gap={space.md} wrap>
              <Amount value={initial.current_fee ?? initial.monthly_fee} variant="title" />
              <Button
                title={t('changeFee')}
                icon="trending-up"
                iconFlipForRTL
                variant="tonal"
                onPress={() => router.push(`/customer/${initial.id}/fee`)}
              />
            </Row>
            <Txt variant="small">{t('customersFeeEditHint')}</Txt>
          </View>
        ) : (
          <Field
            label={t('monthlyFee')}
            value={fee}
            onChangeText={setFee}
            keyboardType="number-pad"
            placeholder="2000"
            prefix={currencyPrefix}
            error={errors.fee}
            maxLength={9}
            ltr
          />
        )}
        <DateField label={t('startDate')} value={startDate} onChange={setStartDate} hint={t('startDateHint')} />
      </Card>

      <SectionHeader title={t('customersSectionAreaNotes')} />
      <Card style={styles.section}>
        <View style={styles.group}>
          <Txt variant="label">{t('area')}</Txt>
          <ChipRow>
            <Chip label={t('noArea')} selected={areaId === null} onPress={() => setAreaId(null)} />
            {(areas ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />
            ))}
            <Chip variant="assist" icon="add" label={t('manageAreas')} onPress={() => router.push('/areas')} />
          </ChipRow>
        </View>
        <Field
          label={`${t('address')} (${t('optional')})`}
          value={address}
          onChangeText={setAddress}
          maxLength={200}
        />
        <Field
          label={`${t('notes')} (${t('optional')})`}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('notesHint')}
          multiline
          maxLength={300}
        />
      </Card>

      <SectionHeader title={t('status')} />
      <Card style={styles.section}>
        <Segmented<CustomerStatus>
          options={[
            { key: 'active', label: t('active') },
            { key: 'inactive', label: t('inactive') },
          ]}
          value={status}
          onChange={setStatus}
          accessibilityLabel={t('status')}
        />
        <Txt variant="small">{t('inactiveHint')}</Txt>
      </Card>

      {onDelete ? (
        <Button
          title={t('deleteCustomer')}
          icon="trash-outline"
          variant="outlined"
          destructive
          onPress={onDelete}
          style={styles.delete}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  group: { gap: space.sm },
  delete: { marginTop: space.lg },
});
