/** Add or edit a staff member: name, phone, role, PIN, and a cloud invite code. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { FormScreen } from '../../components/ds/FormScreen';
import { PremiumGate } from '../../components/PremiumGate';
import { Loading } from '../../components/settings/bits';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Row,
  SectionHeader,
  Segmented,
  Txt,
} from '../../components/ui';
import { cloudConfigured } from '../../config';
import {
  createStaff,
  deleteStaff,
  getStaff,
  getStaffPinHash,
  setStaffPin,
  updateStaff,
} from '../../db/repo';
import type { Staff, StaffRole } from '../../db/types';
import { useQuery } from '../../db/useQuery';
import { isValidPhone } from '../../lib/phone';
import { hashPin, isValidPin } from '../../lib/pin';
import { useApp } from '../../state/app';
import { createInvite } from '../../sync/cloud';
import { isLinked } from '../../sync/engine';
import { colors, space } from '../../theme';
import { showToast } from '../../lib/toast';

export default function StaffEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, can, business } = useApp();
  const { data, loading } = useQuery(
    async (d) => {
      if (!id) return { staff: null, hasPin: false };
      return { staff: await getStaff(d, id), hasPin: !!(await getStaffPinHash(d, id)) };
    },
    [id],
  );
  if (!can('staff.manage')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  if (loading && !data) return <Loading />;
  // Only staff of the open business (a deep link could name any id).
  if (id && (!data?.staff || data.staff.business_id !== business?.id)) {
    return <EmptyState icon="alert-circle-outline" tone="neutral" title={t('staffNotFound')} />;
  }
  return (
    <PremiumGate>
      <StaffForm key={id ?? 'new'} initial={data?.staff ?? null} hasPin={data?.hasPin ?? false} />
    </PremiumGate>
  );
}

function StaffForm({ initial, hasPin }: { initial: Staff | null; hasPin: boolean }) {
  const db = useSQLiteContext();
  const { t, business, staffLabel, can } = useApp();
  const bid = business?.id ?? '';
  const { data: cloudOn } = useQuery((d) => isLinked(d, bid), [bid]);
  const isOwner = initial?.role === 'owner';
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<StaffRole>(initial?.role ?? 'collector');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; pin?: string }>({});
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const save = async () => {
    if (!can('staff.manage')) return;
    const next: typeof errors = {};
    if (!isOwner && !name.trim()) next.name = t('nameRequired');
    if (phone.trim() && !isValidPhone(phone)) next.phone = t('phoneInvalid');
    if (pin && !isValidPin(pin)) next.pin = t('pinInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), phone: phone.trim() || null, role: isOwner ? 'owner' : role } as const;
      const staffId = initial ? initial.id : await createStaff(db, bid, input);
      if (initial) await updateStaff(db, initial.id, input);
      if (pin) await setStaffPin(db, staffId, await hashPin(staffId, pin));
      showToast(t('saved'));
      router.back();
    } catch {
      if (__DEV__) console.warn('Saving a staff member failed');
      setSaving(false);
      Alert.alert(t('somethingWrong'));
    }
  };

  const removePin = () =>
    initial &&
    Alert.alert(t('removePin'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('removePin'),
        style: 'destructive',
        onPress: () => {
          if (can('staff.manage')) setStaffPin(db, initial.id, null);
        },
      },
    ]);

  const confirmDelete = () =>
    initial &&
    Alert.alert(t('removeStaff'), t('removeStaffConfirm', { name: staffLabel(initial) }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (!can('staff.manage')) return;
          await deleteStaff(db, initial.id);
          router.back();
        },
      },
    ]);

  const invite = async () => {
    if (!initial || !can('staff.manage')) return;
    setSharing(true);
    try {
      const code = initial.invite_code ?? (await createInvite(db, initial.id));
      await Share.share({ message: t('inviteMessage', { business: business?.name ?? '', code }) });
    } catch {
      if (__DEV__) console.warn('Sharing the invite failed');
      Alert.alert(t('somethingWrong'));
    } finally {
      setSharing(false);
    }
  };

  const code = initial?.invite_code ?? null;

  return (
    <FormScreen
      footer={<Button title={t('save')} icon="checkmark" size="lg" variant="filled" onPress={save} loading={saving} />}
    >
      <Stack.Screen options={{ title: initial ? staffLabel(initial) : t('addStaff') }} />
      <SectionHeader title={t('settingsStaffDetails')} />
      <Card style={styles.gapMd}>
        <Field
          label={isOwner ? `${t('name')} (${t('optional')})` : t('name')}
          value={name}
          onChangeText={setName}
          error={errors.name}
          maxLength={60}
          autoFocus={!initial}
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
      </Card>

      {!isOwner ? (
        <>
          <SectionHeader title={t('role')} />
          <Card style={styles.gapMd}>
            <Segmented<StaffRole>
              options={[
                { key: 'manager', label: t('roleManager'), icon: 'briefcase-outline' },
                { key: 'collector', label: t('roleCollector'), icon: 'wallet-outline' },
              ]}
              value={role}
              onChange={setRole}
              accessibilityLabel={t('role')}
            />
            <Txt variant="muted">{role === 'manager' ? t('roleManagerDesc') : t('roleCollectorDesc')}</Txt>
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('settingsPinSection')} />
      <Card style={styles.gapMd}>
        {hasPin ? (
          <Row gap={space.sm}>
            <Icon name="lock-closed" size={18} color={colors.textSecondary} />
            <View style={styles.flex}>
              <Txt variant="muted">{t('settingsPinSet')}</Txt>
            </View>
          </Row>
        ) : null}
        {/* Masked so a PIN is never shown on a shared phone. */}
        <Field
          label={hasPin ? t('changePin') : t('setPin')}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
          error={errors.pin}
          hint={isOwner ? t('ownerPinHint') : t('staffPinHint')}
          secure
          ltr
        />
        {hasPin ? (
          <Button title={t('removePin')} icon="lock-open-outline" variant="text" destructive onPress={removePin} />
        ) : null}
      </Card>

      {initial && !isOwner && cloudConfigured && cloudOn ? (
        <>
          <SectionHeader title={t('ownPhone')} />
          <Card style={styles.gapMd}>
            {initial.user_id ? (
              <Row gap={space.sm} align="flex-start">
                <Icon name="checkmark-circle" size={20} color={colors.success} />
                <View style={styles.flex}>
                  <Txt>{t('cloudLinkedDesc')}</Txt>
                </View>
              </Row>
            ) : (
              <>
                <Txt variant="muted">{t('inviteHint')}</Txt>
                {code ? (
                  <Card variant="filled" style={styles.codeCard}>
                    <Txt variant="label" center>
                      {t('inviteCode')}
                    </Txt>
                    <Txt
                      variant="headline"
                      center
                      ltr
                      selectable
                      accessibilityLabel={t('settingsInviteCodeA11y', { code: code.split('').join(' ') })}
                      style={styles.code}
                    >
                      {code}
                    </Txt>
                  </Card>
                ) : null}
                <Button
                  title={t('shareInvite')}
                  icon="share-social-outline"
                  variant="tonal"
                  onPress={invite}
                  loading={sharing}
                />
              </>
            )}
          </Card>
        </>
      ) : null}

      {initial && !isOwner ? (
        <Button
          title={t('removeStaff')}
          icon="trash-outline"
          variant="outlined"
          destructive
          onPress={confirmDelete}
          style={styles.remove}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapMd: { gap: space.md },
  codeCard: { alignItems: 'stretch', gap: space.xs },
  // Spaced letters are easier to read out and type in (Latin only, never Urdu).
  code: { letterSpacing: 4 },
  remove: { marginTop: space.lg },
});
