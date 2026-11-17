/** Sign in to cloud sync with an emailed 6-digit code (no password). */
import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp } from '../state/app';
import { sendCode, signInWithPassword, verifyCode } from '../sync/cloud';
import { space } from '../theme';
import { StepList } from './settings/bits';
import { Button, Card, Field, Txt } from './ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CloudSignIn({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Errors are never logged as objects: they can contain the email address.
  const send = async () => {
    if (!EMAIL.test(email.trim())) {
      setError(t('emailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setSent(true);
    } catch {
      if (__DEV__) console.warn('Sending the sign-in code failed');
      setError(t('cloudError'));
    } finally {
      setBusy(false);
    }
  };

  const passwordSignIn = async () => {
    if (!EMAIL.test(email.trim())) {
      setError(t('emailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signInWithPassword(email, password));
    } catch {
      if (__DEV__) console.warn('Password sign-in failed');
      setError(t('wrongPassword'));
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await verifyCode(email, code));
    } catch {
      if (__DEV__) console.warn('Checking the sign-in code failed');
      setError(t('codeInvalid'));
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Txt variant="muted">{t('cloudSignInIntro')}</Txt>
      {usePassword ? null : (
        <StepList
          steps={[
            { label: t('settingsSignInStep1'), done: sent, current: !sent },
            { label: t('settingsSignInStep2'), current: sent },
          ]}
        />
      )}
      <Field
        label={t('email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setSent(false);
          setError(null);
        }}
        keyboardType="email-address"
        error={sent || usePassword ? null : error}
        maxLength={120}
        onSubmitEditing={usePassword || sent ? undefined : send}
        returnKeyType={usePassword || sent ? undefined : 'send'}
        ltr
      />
      {usePassword ? (
        <View style={styles.group}>
          <Field
            label={t('password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secure
            error={error}
            maxLength={200}
            ltr
          />
          <Button
            title={t('signIn')}
            icon="log-in-outline"
            iconFlipForRTL
            size="lg"
            variant="filled"
            onPress={passwordSignIn}
            loading={busy}
            disabled={!password}
          />
          <Button
            title={t('useEmailCode')}
            variant="text"
            onPress={() => {
              setUsePassword(false);
              setPassword('');
              setError(null);
            }}
          />
        </View>
      ) : sent ? (
        <View style={styles.group}>
          <Txt variant="small">{t('codeSent', { email: email.trim() })}</Txt>
          <Field
            label={t('signInCode')}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, ''));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={8}
            error={error}
            onSubmitEditing={code.length >= 6 ? verify : undefined}
            returnKeyType="done"
            autoFocus
            ltr
          />
          <Button
            title={t('signIn')}
            icon="log-in-outline"
            iconFlipForRTL
            size="lg"
            variant="filled"
            onPress={verify}
            loading={busy}
            disabled={code.length < 6}
          />
          <Button title={t('sendAgain')} icon="refresh" variant="text" onPress={send} disabled={busy} />
        </View>
      ) : (
        <View style={styles.group}>
          <Button
            title={t('sendCode')}
            icon="mail-outline"
            size="lg"
            variant="filled"
            onPress={send}
            loading={busy}
          />
          <Button
            title={t('usePassword')}
            variant="text"
            onPress={() => {
              setUsePassword(true);
              setError(null);
            }}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  group: { gap: space.md },
});
