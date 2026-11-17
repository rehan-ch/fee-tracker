/** Premium: several businesses on one phone (e.g. a cable network and a tuition centre). */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FormScreen } from '../components/ds/FormScreen';
import { PremiumGate } from '../components/PremiumGate';
import { ListCard, Loading } from '../components/settings/bits';
import { BusinessRow } from '../components/settings/rows';
import { Button, Card, Divider, EmptyState, Field, SectionHeader, Txt } from '../components/ui';
import { createBusiness, deleteBusiness, listBusinesses, setActiveBusiness } from '../db/repo';
import { useQuery } from '../db/useQuery';
import { isValidPhone } from '../lib/phone';
import { useApp } from '../state/app';
import { space } from '../theme';

export default function BusinessesScreen() {
  const db = useSQLiteContext();
  const { t, business, lang, can } = useApp();
  const { data: businesses } = useQuery(listBusinesses, []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  if (!can('businesses.manage')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;

  const open = async (id: string) => {
    if (!can('businesses.manage')) return;
    if (id !== business?.id) await setActiveBusiness(db, id);
    router.dismissTo('/');
  };

  const add = async () => {
    if (!can('businesses.manage') || saving) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (phone.trim() && !isValidPhone(phone)) next.phone = t('phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await createBusiness(db, { name: name.trim(), phone: phone.trim() || null, language: lang });
      router.dismissTo('/');
    } catch {
      if (__DEV__) console.warn('Adding a business failed');
      setSaving(false);
      Alert.alert(t('somethingWrong'));
    }
  };

  const confirmDelete = (id: string, bname: string) =>
    Alert.alert(t('deleteBusiness'), t('deleteBusinessConfirm', { name: bname }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (can('businesses.manage')) deleteBusiness(db, id);
        },
      },
    ]);

  const cancelAdd = () => {
    setAdding(false);
    setName('');
    setPhone('');
    setErrors({});
  };

  const canDelete = (businesses?.length ?? 0) > 1;

  return (
    <PremiumGate>
      <FormScreen>
        <Txt variant="muted">{t('businessesIntro')}</Txt>
        {businesses === undefined ? (
          <Loading />
        ) : (
          <ListCard>
            {businesses.map((b, i) => (
              <View key={b.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <BusinessRow
                  name={b.name}
                  phone={b.phone}
                  current={b.id === business?.id}
                  onPress={() => open(b.id)}
                  onDelete={canDelete ? () => confirmDelete(b.id, b.name) : undefined}
                />
              </View>
            ))}
          </ListCard>
        )}
        {adding ? (
          <>
            <SectionHeader title={t('addBusiness')} />
            <Card style={styles.form}>
              <Field
                label={t('businessName')}
                value={name}
                onChangeText={setName}
                error={errors.name}
                placeholder={t('businessNameHint')}
                maxLength={60}
                autoFocus
              />
              <Field
                label={`${t('phone')} (${t('optional')})`}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                error={errors.phone}
                maxLength={20}
                ltr
              />
              <Button title={t('addBusiness')} icon="checkmark" variant="filled" onPress={add} loading={saving} />
              <Button title={t('cancel')} variant="text" onPress={cancelAdd} disabled={saving} />
            </Card>
          </>
        ) : (
          <Button title={t('addBusiness')} icon="add" variant="tonal" onPress={() => setAdding(true)} />
        )}
      </FormScreen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
