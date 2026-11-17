/**
 * Premium cloud sync: sign in, put this business in the cloud so the owner
 * and staff phones share the same data, sync status, and account deletion.
 */
import type { Session } from '@supabase/supabase-js';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { CloudSignIn } from '../components/CloudSignIn';
import { PremiumGate } from '../components/PremiumGate';
import { ListCard, Loading, TonalIcon } from '../components/settings/bits';
import { safeHttpsUrl } from '../components/settings/links';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  type IconName,
  joinA11y,
  ListItem,
  Row,
  Screen,
  SectionHeader,
  Txt,
} from '../components/ui';
import { cloudConfigured, PUBLISHER } from '../config';
import { listBusinesses } from '../db/repo';
import { useQuery } from '../db/useQuery';
import { toDayKey } from '../lib/date';
import { useApp } from '../state/app';
import {
  addCloudBusiness,
  deleteCloudAccount,
  enableCloud,
  getSession,
  myBusinesses,
  removeFromCloud,
  signOut,
  type CloudMembership,
} from '../sync/cloud';
import { isLinked, linkedBusinesses, pendingChanges } from '../sync/engine';
import { runSync, useSyncStatus } from '../sync/runner';
import { colors, feedbackColors, radius, size, space, statusColors } from '../theme';
import { showToast } from '../lib/toast';

/** Opened only if it is a real https: link (checked once, at load). */
const ACCOUNT_DELETION_URL = safeHttpsUrl(PUBLISHER.accountDeletionUrl);

export default function CloudScreen() {
  const { t, staffLocked, can } = useApp();
  if (!cloudConfigured) return <EmptyState icon="cloud-offline-outline" tone="neutral" title={t('cloudNotConfigured')} />;
  // Settings only shows Cloud sync to the owner, or on a staff member's own
  // phone. Other roles on a shared phone must not reach the signed-in account
  // (sign out, delete account) through a deep link either.
  if (!staffLocked && !can('cloud.manage')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }
  // A staff phone that joined a business keeps syncing whatever the owner's plan.
  return staffLocked ? (
    <CloudPanel />
  ) : (
    <PremiumGate>
      <CloudPanel />
    </PremiumGate>
  );
}

type SyncState = 'running' | 'error' | 'pending' | 'synced' | 'never';

const SYNC_LOOK: Record<SyncState, { icon: IconName; color: string; bg: string }> = {
  running: { icon: 'sync', color: colors.primary, bg: colors.primarySubtle },
  error: { icon: 'close-circle', color: feedbackColors.error.fg, bg: feedbackColors.error.container },
  pending: { icon: 'time-outline', color: feedbackColors.warning.fg, bg: feedbackColors.warning.container },
  synced: { icon: 'checkmark-circle', color: statusColors.paid.fg, bg: statusColors.paid.bg },
  never: { icon: 'time-outline', color: feedbackColors.warning.fg, bg: feedbackColors.warning.container },
};

function CloudPanel() {
  const db = useSQLiteContext();
  const { t, business, can, premium, dateLabel, lang, isRTL } = useApp();
  const status = useSyncStatus();
  const bid = business?.id ?? '';
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [remote, setRemote] = useState<CloudMembership[] | null>(null);
  const { data: linked } = useQuery((d) => isLinked(d, bid), [bid]);
  const { data: pending } = useQuery((d) => pendingChanges(d, bid), [bid]);
  const { data: localIds } = useQuery(async (d) => (await listBusinesses(d)).map((b) => b.id), []);
  const isOwner = can('cloud.manage');

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session) return;
    myBusinesses()
      .then(setRemote)
      .catch(() => setRemote([]));
  }, [session, linked]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      // Never log the error object: it can contain the account's email.
      if (__DEV__) console.warn('Cloud action failed');
      Alert.alert(t('cloudError'));
    } finally {
      setBusy(null);
    }
  };

  if (session === undefined) return <Loading />;
  if (!session) {
    return (
      <Screen>
        <Txt variant="muted">{t('cloudIntro')}</Txt>
        <CloudSignIn onSignedIn={setSession} />
      </Screen>
    );
  }

  const notHere = (remote ?? []).filter((m) => !(localIds ?? []).includes(m.business_id));
  const timeLabel = (iso: string) =>
    `${dateLabel(toDayKey(new Date(iso)))} ${new Date(iso).toLocaleTimeString(lang === 'ur' ? 'ur-PK' : 'en-PK', { hour: '2-digit', minute: '2-digit' })}`;

  const syncState: SyncState = status.running
    ? 'running'
    : status.error
      ? 'error'
      : pending
        ? 'pending'
        : status.lastSyncAt
          ? 'synced'
          : 'never';
  const syncWord = {
    running: t('syncing'),
    error: t('settingsSyncError'),
    pending: t('settingsSyncPending'),
    synced: t('settingsSyncedOk'),
    never: t('notSyncedYet'),
  }[syncState];
  const look = SYNC_LOOK[syncState];
  const detail = [
    status.lastSyncAt ? t('lastSync', { time: timeLabel(status.lastSyncAt) }) : null,
    pending ? t('pendingChanges', { count: pending }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const openDeletionPage = () => {
    if (!ACCOUNT_DELETION_URL) return;
    Linking.openURL(ACCOUNT_DELETION_URL).catch(() => Alert.alert(t('somethingWrong')));
  };

  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <TonalIcon name="person-circle-outline" />
          <View style={styles.flex}>
            <Txt variant="label">{t('signedInAs')}</Txt>
            <Txt weight={600} ltr>
              {session.user.email ?? ''}
            </Txt>
          </View>
        </Row>
      </Card>

      <SectionHeader title={business?.name ?? ''} />
      <Card style={styles.gapMd}>
        {linked ? (
          <>
            <View
              accessible
              accessibilityLabel={joinA11y([syncWord, detail], isRTL)}
              accessibilityLiveRegion="polite"
            >
              <Row gap={space.md}>
                <View style={[styles.statusCircle, { backgroundColor: look.bg }]}>
                  <Icon name={look.icon} size={22} color={look.color} />
                </View>
                <View style={styles.flex}>
                  <Txt variant="h2" color={look.color}>
                    {syncWord}
                  </Txt>
                  {detail ? <Txt variant="small">{detail}</Txt> : null}
                </View>
              </Row>
            </View>
            <Txt variant="small">{t('cloudOn')}</Txt>
            {status.error ? <Txt variant="small">{t('syncFailed')}</Txt> : null}
            <Button
              title={t('syncNow')}
              icon="sync"
              variant="filled"
              loading={status.running}
              // Sync every linked business only with premium; otherwise just the
              // businesses this phone joined as staff (the runner's own rule).
              onPress={() => runSync(db, premium.active)}
            />
          </>
        ) : isOwner ? (
          <>
            <Txt variant="muted">{t('cloudEnableIntro')}</Txt>
            <Button
              title={t('cloudEnable')}
              icon="cloud-upload-outline"
              variant="filled"
              loading={busy === 'enable'}
              disabled={busy !== null}
              onPress={() =>
                run('enable', async () => {
                  if (!can('cloud.manage')) return;
                  await enableCloud(db, bid);
                  await runSync(db, premium.active);
                  showToast(t('cloudEnabled'), true);
                })
              }
            />
          </>
        ) : (
          <Txt variant="muted">{t('cloudOwnerOnly')}</Txt>
        )}
      </Card>

      {notHere.length > 0 ? (
        <>
          <SectionHeader title={t('cloudOtherBusinesses')} />
          <ListCard>
            {notHere.map((m, i) => (
              <View key={m.business_id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <ListItem
                  icon="cloud-download-outline"
                  title={m.name}
                  subtitle={t('downloadToPhone')}
                  disabled={busy !== null}
                  onPress={() =>
                    run(m.business_id, async () => {
                      await addCloudBusiness(db, m);
                      await runSync(db, premium.active || m.role !== 'owner');
                    })
                  }
                />
              </View>
            ))}
          </ListCard>
        </>
      ) : null}

      <SectionHeader title={t('account')} />
      <Card style={styles.gapSm}>
        {linked && isOwner ? (
          <Button
            title={t('removeFromCloud')}
            variant="outlined"
            destructive
            icon="cloud-offline-outline"
            loading={busy === 'remove'}
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(t('removeFromCloud'), t('removeFromCloudConfirm'), [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('remove'),
                  style: 'destructive',
                  onPress: () =>
                    run('remove', async () => {
                      if (can('cloud.manage')) await removeFromCloud(db, bid);
                    }),
                },
              ])
            }
          />
        ) : null}
        <Button
          title={t('signOut')}
          icon="log-out-outline"
          iconFlipForRTL
          variant="text"
          loading={busy === 'out'}
          disabled={busy !== null}
          onPress={() =>
            run('out', async () => {
              await signOut();
              setSession(null);
            })
          }
        />
        <Button
          title={t('deleteCloudAccount')}
          variant="danger"
          icon="trash-outline"
          loading={busy === 'delete'}
          disabled={busy !== null}
          onPress={() =>
            Alert.alert(t('deleteCloudAccount'), t('deleteCloudAccountConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('delete'),
                style: 'destructive',
                onPress: () =>
                  run('delete', async () => {
                    await deleteCloudAccount(db, await linkedBusinesses(db));
                    setSession(null);
                    showToast(t('cloudAccountDeleted'), true);
                  }),
              },
            ])
          }
        />
        {ACCOUNT_DELETION_URL ? (
          <View style={styles.deletion}>
            <Txt variant="small">{t('deleteAccountWeb')}</Txt>
            <Button
              title={t('settingsOpenDeletionPage')}
              icon="open-outline"
              iconFlipForRTL
              variant="text"
              accessibilityHint={ACCOUNT_DELETION_URL}
              onPress={openDeletionPage}
            />
            <Txt variant="small" ltr selectable>
              {ACCOUNT_DELETION_URL}
            </Txt>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapMd: { gap: space.md },
  gapSm: { gap: space.sm },
  deletion: { gap: space.xs, marginTop: space.sm },
  statusCircle: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
