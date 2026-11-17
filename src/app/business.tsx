/** Edit business name and phone (reached from Settings). */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { FormScreen } from '../components/ds/FormScreen';
import { Button, Card, EmptyState, Field } from '../components/ui';
import { updateBusiness } from '../db/repo';
import { isValidPhone } from '../lib/phone';
import { useApp } from '../state/app';
import { space } from '../theme';

export default function BusinessScreen() {
  const db = useSQLiteContext();
  const { t, business, can } = useApp();
  const [name, setName] = useState(business?.name ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  // Settings only links here with this permission; the route checks it too
  // (it can also be opened by a deep link).
  if (!business || !can('settings.business')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }

  const save = async () => {
    if (!can('settings.business') || saving) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (phone.trim() && !isValidPhone(phone)) next.phone = t('phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await updateBusiness(db, business.id, { name: name.trim(), phone: phone.trim() || null });
      router.back();
    } catch {
      if (__DEV__) console.warn('Saving business info failed');
      setSaving(false);
      Alert.alert(t('somethingWrong'));
    }
  };

  return (
    <FormScreen
      footer={<Button title={t('save')} icon="checkmark" size="lg" variant="filled" onPress={save} loading={saving} />}
    >
      <Card style={styles.form}>
        <Field
          label={t('businessName')}
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder={t('businessNameHint')}
          maxLength={80}
        />
        <Field
          label={`${t('businessPhone')} (${t('optional')})`}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          error={errors.phone}
          maxLength={20}
          ltr
        />
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
