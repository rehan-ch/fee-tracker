/**
 * Premium staff accounts on a shared phone: pick who is using the app.
 * Staff with a PIN (including the owner) must enter it to switch to them.
 * The PIN field is masked, and repeated wrong PINs pause entry for a while.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getMeta, getStaffPinHash, listStaff, setMetaQuietly, setStaffPin, type StaffRow } from '../db/repo';
import { useQuery } from '../db/useQuery';
import { verifyPin } from '../lib/pin';
import { useApp } from '../state/app';
import { space } from '../theme';
import { BottomSheet } from './ds/Sheet';
import { Loading } from './settings/bits';
import { clearPinTries, pinWaitSeconds, recordWrongPin, type ThrottleStore } from './settings/pinThrottle';
import { roleKey } from './settings/roles';
import { PersonRow } from './settings/rows';
import { Button, Divider, Field } from './ui';

export function SwitchUserSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const db = useSQLiteContext();
  const { t, business, staff, switchStaff, staffLabel } = useApp();
  const bid = business?.id ?? '';
  const { data: people } = useQuery((d) => listStaff(d, bid), [bid]);
  const [picked, setPicked] = useState<StaffRow | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Wrong-PIN counts are saved on the phone, so restarting the app doesn't reset them.
  const tries = useMemo<ThrottleStore>(
    () => ({ get: (k) => getMeta(db, k), set: (k, v) => setMetaQuietly(db, k, v) }),
    [db],
  );

  const close = () => {
    setPicked(null);
    setPin('');
    setError(null);
    onClose();
  };

  const choose = async (s: StaffRow) => {
    if (s.id === staff?.id) return close();
    if (s.has_pin) {
      setPicked(s);
      setPin('');
      setError(null);
      return;
    }
    await switchStaff(s.id);
    close();
  };

  const tooMany = (seconds: number) => t('settingsPinTooMany', { seconds });

  const confirmPin = async () => {
    if (!picked || checking || pin.length < 4) return;
    setChecking(true);
    try {
      const wait = await pinWaitSeconds(tries, picked.id);
      if (wait > 0) {
        setError(tooMany(wait));
        return;
      }
      const stored = await getStaffPinHash(db, picked.id);
      if (stored) {
        const check = await verifyPin(picked.id, pin, stored);
        if (!check.ok) {
          const paused = await recordWrongPin(tries, picked.id);
          setPin('');
          setError(paused > 0 ? tooMany(paused) : t('wrongPin'));
          return;
        }
        // PINs saved by an older version move to the stronger hash.
        if (check.rehash) await setStaffPin(db, picked.id, check.rehash);
      }
      await clearPinTries(tries, picked.id);
      await switchStaff(picked.id);
      close();
    } catch {
      if (__DEV__) console.warn('PIN check failed');
      setError(t('somethingWrong'));
    } finally {
      setChecking(false);
    }
  };

  const back = () => {
    setPicked(null);
    setPin('');
    setError(null);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={picked ? staffLabel(picked) : t('switchUser')}
      subtitle={picked ? t(roleKey(picked.role)) : t('settingsWhoIsUsing')}
      footer={
        picked ? (
          <>
            <Button
              title={t('continue')}
              size="lg"
              variant="filled"
              onPress={confirmPin}
              loading={checking}
              disabled={pin.length < 4}
            />
            <Button title={t('back')} variant="text" icon="arrow-back" iconFlipForRTL onPress={back} />
          </>
        ) : undefined
      }
    >
      {picked ? (
        <Field
          label={t('enterPin')}
          value={pin}
          onChangeText={(v) => {
            setPin(v.replace(/\D/g, ''));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          error={error}
          onSubmitEditing={confirmPin}
          returnKeyType="done"
          autoFocus
          secure
          ltr
        />
      ) : people === undefined ? (
        <Loading />
      ) : (
        // Rows run to the sheet edges; their own 16dp padding lines them up with the title.
        <View style={styles.bleed}>
          {people.map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <Divider inset={72} /> : null}
              <PersonRow
                name={staffLabel(s)}
                role={t(roleKey(s.role))}
                hasPin={!!s.has_pin}
                current={s.id === staff?.id}
                onPress={() => choose(s)}
              />
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.lg },
});
