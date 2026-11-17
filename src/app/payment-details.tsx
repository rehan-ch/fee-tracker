/**
 * Premium: how customers can pay - JazzCash / Easypaisa / bank details and
 * an optional payment page link from the business's own merchant account.
 * Added to reminders ({payment}) and receipts.
 */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { FormScreen } from '../components/ds/FormScreen';
import { PremiumGate } from '../components/PremiumGate';
import { Banner, Button, Card, EmptyState, Field } from '../components/ui';
import { updateBusiness } from '../db/repo';
import { isValidLink } from '../lib/template';
import { useApp } from '../state/app';
import { space } from '../theme';
import { showToast } from '../lib/toast';

export default function PaymentDetailsScreen() {
  const db = useSQLiteContext();
  const { t, business, can, premium } = useApp();
  const [info, setInfo] = useState(business?.payment_info ?? '');
  const [link, setLink] = useState(business?.payment_link ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!business || !can('settings.business')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }

  const save = async () => {
    if (!can('settings.business') || !premium.active || saving) return;
    if (link.trim() && !isValidLink(link)) {
      setError(t('linkInvalid'));
      return;
    }
    setSaving(true);
    try {
      await updateBusiness(db, business.id, {
        payment_info: info.trim() || null,
        payment_link: link.trim() || null,
      });
      showToast(t('saved'));
      router.back();
    } catch {
      if (__DEV__) console.warn('Saving payment details failed');
      setSaving(false);
      Alert.alert(t('somethingWrong'));
    }
  };

  return (
    <PremiumGate>
      <FormScreen
        footer={
          <Button title={t('save')} icon="checkmark" size="lg" variant="filled" onPress={save} loading={saving} />
        }
      >
        <Banner tone="info" title={t('settingsPaymentDetailsWhere')} body={t('paymentDetailsIntro')} />
        <Card style={styles.form}>
          <Field
            label={t('paymentInfo')}
            value={info}
            onChangeText={setInfo}
            placeholder={t('paymentInfoPlaceholder')}
            multiline
            maxLength={300}
          />
          <Field
            label={`${t('paymentLink')} (${t('optional')})`}
            value={link}
            onChangeText={(v) => {
              setLink(v);
              setError(null);
            }}
            placeholder="https://"
            keyboardType="url"
            error={error}
            hint={t('paymentLinkHint')}
            maxLength={300}
            ltr
          />
        </Card>
      </FormScreen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
