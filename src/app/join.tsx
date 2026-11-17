/**
 * Staff phone: join the owner's business with the invite code they shared.
 * Reached from the welcome screen; the business downloads from the cloud.
 */
import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CloudSignIn } from '../components/CloudSignIn';
import { FormScreen } from '../components/ds/FormScreen';
import { ListCard, Loading, StepList, TonalIcon } from '../components/settings/bits';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  ListItem,
  Row,
  SectionHeader,
  Txt,
} from '../components/ui';
import { cloudConfigured } from '../config';
import { useApp } from '../state/app';
import {
  addCloudBusiness,
  getSession,
  joinWithCode,
  JoinError,
  myBusinesses,
  type CloudMembership,
} from '../sync/cloud';
import { runSync } from '../sync/runner';
import { space } from '../theme';

export default function JoinScreen() {
  const db = useSQLiteContext();
  const { t, premium, business, can } = useApp();
  // This route sits outside the setup guard, so a deep link can open it on a
  // phone that is already in use. Only the welcome screen (no business yet) or
  // the owner may use it: otherwise a collector on a shared phone could
  // download the signed-in owner's businesses as the owner. Decided once when
  // the screen opens, so joining (which makes this a staff phone) doesn't
  // flip the screen to "no access" while the business downloads.
  const [allowed] = useState(() => !business || can('businesses.manage'));
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mine, setMine] = useState<CloudMembership[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloudConfigured || !allowed) return;
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, [allowed]);

  // Businesses this account already belongs to (e.g. the owner on a new phone).
  useEffect(() => {
    if (!session) return;
    myBusinesses()
      .then(setMine)
      .catch(() => setMine([]));
  }, [session]);

  const download = async (m: CloudMembership) => {
    if (!allowed || busy) return;
    setBusy(true);
    try {
      await addCloudBusiness(db, m);
      await runSync(db, premium.active || m.role !== 'owner');
      router.dismissTo('/');
    } catch {
      if (__DEV__) console.warn('Downloading a cloud business failed');
      setError(t('cloudError'));
      setBusy(false);
    }
  };

  if (!cloudConfigured) return <EmptyState icon="cloud-offline-outline" tone="neutral" title={t('cloudNotConfigured')} />;
  if (!allowed) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  if (session === undefined) return <Loading />;

  const join = async () => {
    if (!allowed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinWithCode(db, code);
      await runSync(db, false);
      router.dismissTo('/');
    } catch (e) {
      if (__DEV__) console.warn('Joining with an invite code failed');
      setError(
        e instanceof JoinError && e.kind === 'invalid'
          ? t('inviteInvalid')
          : e instanceof JoinError && e.kind === 'tooMany'
            ? t('inviteTooMany')
            : t('cloudError'),
      );
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <Txt variant="muted">{t('joinIntro')}</Txt>
      <Card>
        <StepList
          steps={[
            { label: t('settingsStep1'), done: !!session, current: !session },
            { label: t('settingsStep2'), current: !!session },
            { label: t('settingsStep3') },
          ]}
        />
      </Card>
      {session ? (
        <>
          <SectionHeader title={t('inviteCode')} />
          <Card style={styles.gapMd}>
            <Row gap={space.md}>
              <TonalIcon name="person-circle-outline" />
              <View style={styles.flex}>
                <Txt variant="label">{t('signedInAs')}</Txt>
                <Txt weight={600} ltr>
                  {session.user.email ?? ''}
                </Txt>
              </View>
            </Row>
            <Field
              label={t('inviteCode')}
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                setError(null);
              }}
              maxLength={8}
              error={error}
              placeholder="ABCD2345"
              onSubmitEditing={code.length === 8 ? join : undefined}
              returnKeyType="go"
              autoFocus
              ltr
            />
            <Button
              title={t('joinBusiness')}
              icon="enter-outline"
              size="lg"
              variant="filled"
              onPress={join}
              loading={busy}
              disabled={code.length < 8}
            />
          </Card>
        </>
      ) : null}
      {session && mine.length > 0 ? (
        <>
          <SectionHeader title={t('cloudOtherBusinesses')} />
          <ListCard>
            {mine.map((m, i) => (
              <View key={m.business_id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <ListItem
                  icon="cloud-download-outline"
                  title={m.name}
                  subtitle={t('downloadToPhone')}
                  disabled={busy}
                  onPress={() => download(m)}
                />
              </View>
            ))}
          </ListCard>
        </>
      ) : null}
      {session ? null : <CloudSignIn onSignedIn={setSession} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapMd: { gap: space.md },
});
