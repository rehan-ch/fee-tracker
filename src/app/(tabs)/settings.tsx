/** Screen 9: Settings - business, premium features, alerts, language, backup and restore. */
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ListCard } from '../../components/settings/bits';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { roleKey } from '../../components/settings/roles';
import { SwitchUserSheet } from '../../components/SwitchUserSheet';
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  type IconName,
  joinA11y,
  ListItem,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Txt,
} from '../../components/ui';
import { cloudConfigured } from '../../config';
import { getMeta, listBusinesses, listStaff, META_LAST_BACKUP } from '../../db/repo';
import type { Language } from '../../db/types';
import { useQuery } from '../../db/useQuery';
import { pickAndRestore, runBackup } from '../../lib/backup';
import { toDayKey } from '../../lib/date';
import { eraseEverything } from '../../lib/wipe';
import { useApp } from '../../state/app';
import { linkedBusinesses } from '../../sync/engine';
import { colors, space } from '../../theme';
import { showToast } from '../../lib/toast';

/** Indent for dividers under rows with a 40dp leading icon. */
const ICON_INSET = 72;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const app = useApp();
  const { t, lang, setLanguage, business, dateLabel, can, premium, staff, staffLabel, staffLocked, role } = app;
  const { rowDir, isRTL } = app;
  const bid = business?.id ?? '';
  const { data: lastBackup } = useQuery((d) => getMeta(d, META_LAST_BACKUP), []);
  const { data: staffCount } = useQuery(async (d) => (await listStaff(d, bid)).length, [bid]);
  const { data: businessCount } = useQuery(async (d) => (await listBusinesses(d)).length, []);
  const { data: synced } = useQuery(async (d) => (await linkedBusinesses(d)).includes(bid), [bid]);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [switching, setSwitching] = useState(false);

  const isoToLabel = (iso: string) => dateLabel(toDayKey(new Date(iso)));

  // Each handler re-checks the role: hiding a button is never the only gate.
  const backup = async () => {
    if (!can('backup')) return;
    setBusy('backup');
    try {
      await runBackup(db, t);
    } finally {
      setBusy(null);
    }
  };

  // Restoring replaces every staff member and removes all PINs, so only the owner may do it.
  const restore = async () => {
    if (!can('backup.restore')) return;
    setBusy('restore');
    try {
      await pickAndRestore(db, t, isoToLabel, () => can('backup.restore'));
    } finally {
      setBusy(null);
    }
  };

  const confirmDeleteAll = () => {
    if (!can('data.delete')) return;
    Alert.alert(t('deleteAllData'), t('deleteAllConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (!can('data.delete')) return;
          await eraseEverything(db);
          showToast(t('deleteAllDone'));
        },
      },
    ]);
  };

  /** Chevron with the premium badge in front of it, for locked premium rows. */
  const premiumRight = (
    <Row gap={space.sm}>
      <Badge label={t('premium')} tone="premium" />
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL />
    </Row>
  );

  /** A premium item. Billing isn't shipped yet, so premium is always active and the row opens its screen. */
  const premiumItem = (icon: IconName, title: string, subtitle: string | undefined, href: Href) => (
    <ListItem
      icon={icon}
      title={title}
      subtitle={subtitle}
      accessibilityLabel={premium.active ? undefined : joinA11y([title, subtitle, t('premium')], isRTL)}
      onPress={() => router.push(href)}
      right={premium.active ? undefined : premiumRight}
    />
  );

  const showStaff = premium.active && ((staffCount ?? 0) > 1 || staffLocked);
  const showSwitch = premium.active && !staffLocked && (staffCount ?? 0) > 1;
  const usingAs = showStaff
    ? t('usingAs', { name: t('settingsUsingAsRole', { name: staffLabel(staff), role: t(roleKey(role)) }) })
    : undefined;

  const businessRows = can('customers.edit') || can('settings.business');
  const premiumSection = can('staff.manage') || can('businesses.manage') || can('subscription');

  return (
    <Screen>
      <ProfileCard
        name={business?.name ?? ''}
        phone={business?.phone ?? null}
        onPress={can('settings.business') ? () => router.push('/business') : undefined}
        usingAs={usingAs}
        onSwitch={showSwitch ? () => setSwitching(true) : undefined}
      />

      {businessRows ? (
        <>
          <SectionHeader title={t('settingsBusiness')} />
          <ListCard>
            {can('customers.edit') ? (
              <ListItem icon="location-outline" title={t('areasTitle')} onPress={() => router.push('/areas')} />
            ) : null}
            {can('settings.business') ? (
              <>
                {can('customers.edit') ? <Divider inset={ICON_INSET} /> : null}
                <ListItem
                  icon="chatbubbles-outline"
                  title={t('reminderMessage')}
                  subtitle={t('reminderMessageHint')}
                  onPress={() => router.push('/messages')}
                />
                <Divider inset={ICON_INSET} />
                {premiumItem('wallet-outline', t('paymentDetails'), t('paymentDetailsHint'), '/payment-details')}
                <Divider inset={ICON_INSET} />
                <ListItem
                  icon="notifications-outline"
                  title={t('alertsTitle')}
                  subtitle={t('alertsHint')}
                  onPress={() => router.push('/alerts')}
                />
              </>
            ) : null}
          </ListCard>
        </>
      ) : null}

      {premiumSection ? (
        <>
          <SectionHeader title={t('premium')} />
          <ListCard>
            {can('staff.manage')
              ? premiumItem('people-outline', t('staffTitle'), t('staffHint', { count: staffCount ?? 1 }), '/staff')
              : null}
            {can('businesses.manage') ? (
              <>
                <Divider inset={ICON_INSET} />
                {premiumItem(
                  'business-outline',
                  t('businessesTitle'),
                  t('businessesHint', { count: businessCount ?? 1 }),
                  '/businesses',
                )}
              </>
            ) : null}
            {cloudConfigured && can('cloud.manage') ? (
              <>
                <Divider inset={ICON_INSET} />
                {premiumItem('cloud-outline', t('cloudSync'), synced ? t('cloudOn') : t('cloudHint'), '/cloud')}
              </>
            ) : null}
          </ListCard>
        </>
      ) : cloudConfigured && staffLocked ? (
        <>
          <SectionHeader title={t('cloudSync')} />
          <ListCard>
            <ListItem
              icon="cloud-outline"
              title={t('cloudSync')}
              subtitle={t('cloudOn')}
              onPress={() => router.push('/cloud')}
            />
          </ListCard>
        </>
      ) : null}

      <SectionHeader title={t('language')} />
      <Segmented<Language>
        options={[
          { key: 'en', label: 'English' },
          { key: 'ur', label: 'اردو' },
        ]}
        value={lang}
        onChange={(k) => setLanguage(k)}
        accessibilityLabel={t('language')}
      />

      {can('backup') ? (
        <>
          <SectionHeader title={t('backupRestore')} />
          <Card style={styles.gapMd}>
            <Txt variant="muted">{t('backupHelp')}</Txt>
            <View style={[styles.lastBackup, { flexDirection: rowDir }]}>
              <Icon name="time-outline" size={18} color={colors.textSecondary} />
              <View style={styles.flex}>
                <Txt weight={600}>
                  {lastBackup ? t('lastBackup', { date: isoToLabel(lastBackup) }) : t('noBackupYet')}
                </Txt>
              </View>
            </View>
            <Button
              title={t('backupNow')}
              icon="cloud-upload-outline"
              variant="filled"
              onPress={backup}
              loading={busy === 'backup'}
              disabled={busy !== null}
            />
            {can('backup.restore') ? (
              <Button
                title={t('restoreBackup')}
                icon="cloud-download-outline"
                variant="tonal"
                onPress={restore}
                loading={busy === 'restore'}
                disabled={busy !== null}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('about')} />
      <ListCard>
        <ListItem icon="shield-checkmark-outline" title={t('privacyPolicy')} onPress={() => router.push('/privacy')} />
        <Divider inset={ICON_INSET} />
        <ListItem
          icon="information-circle-outline"
          iconTone="neutral"
          title={t('appName')}
          subtitle={t('version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        />
      </ListCard>

      {can('data.delete') ? (
        <>
          <SectionHeader title={t('dataSection')} />
          <ListCard variant="outlined">
            <ListItem
              icon="trash-outline"
              title={t('deleteAllData')}
              subtitle={t('settingsDeleteAllHint')}
              danger
              onPress={confirmDeleteAll}
            />
          </ListCard>
        </>
      ) : null}
      <SwitchUserSheet visible={switching} onClose={() => setSwitching(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapMd: { gap: space.md },
  lastBackup: { alignItems: 'center', gap: space.sm },
});
