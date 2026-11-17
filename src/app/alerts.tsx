/**
 * Owner alerts: a monthly "N customers still unpaid" notification (version 2)
 * and a reminder schedule that prompts you to send WhatsApp reminders on
 * chosen days (premium). All local to the phone.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { useSystemPicker } from '../components/pickers';
import { Loading, PremiumChip, TonalIcon } from '../components/settings/bits';
import {
  AppSwitch,
  bidiIsolate,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  type IconName,
  Row,
  Screen,
  Txt,
} from '../components/ui';
import { useQuery } from '../db/useQuery';
import { ALERT_DAYS, type AlertSettings } from '../lib/alerts';
import { configureNotifications, ensurePermission, getAlertSettings, saveAlertSettings, sendTestAlert } from '../lib/notify';
import { useApp } from '../state/app';
import { colors, space } from '../theme';

export default function AlertsScreen() {
  const { business, can, t } = useApp();
  const bid = business?.id ?? '';
  const { data } = useQuery((d) => getAlertSettings(d, bid), [bid]);
  if (!business || !can('settings.business')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  if (!data) return <Loading />;
  return <AlertsForm key={bid} businessId={bid} initial={data} />;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Card header: tonal icon, h2 title and a trailing control (Switch or premium chip). */
function AlertHeader({ icon, title, right }: { icon: IconName; title: string; right: ReactNode }) {
  return (
    <Row gap={space.md} justify="space-between">
      <TonalIcon name={icon} />
      <View style={styles.flex}>
        <Txt variant="h2" header>
          {title}
        </Txt>
      </View>
      {right}
    </Row>
  );
}

function AlertsForm({ businessId, initial }: { businessId: string; initial: AlertSettings }) {
  const db = useSQLiteContext();
  const { t, premium, business, money, monthLabel, can } = useApp();
  const [s, setS] = useState(initial);
  const [testing, setTesting] = useState(false);
  const timePicker = useSystemPicker();

  const notificationsDenied = () =>
    Alert.alert(t('notificationsOff'), t('notificationsOffBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('openSettings'), onPress: () => Linking.openSettings() },
    ]);

  const testAlert = async () => {
    if (!business || !can('settings.business')) return;
    setTesting(true);
    try {
      await configureNotifications(t('alertsChannel'));
      if (!(await ensurePermission())) return notificationsDenied();
      await sendTestAlert(db, business, {
        summaryTitle: (p) => t('alertSummaryTitle', p),
        summaryBody: (p) => t('alertSummaryBody', p),
        monthLabel,
        money,
      });
    } catch {
      if (__DEV__) console.warn('Sending a test alert failed');
      Alert.alert(t('somethingWrong'));
    } finally {
      setTesting(false);
    }
  };

  const update = async (next: AlertSettings) => {
    if (!can('settings.business')) return;
    const turningOn =
      (next.summary.enabled && !s.summary.enabled) || (next.reminders.enabled && !s.reminders.enabled);
    if (turningOn && !(await ensurePermission())) {
      notificationsDenied();
      return;
    }
    setS(next);
    await saveAlertSettings(db, businessId, next);
  };

  const pickTime = (which: 'summary' | 'reminders') => {
    const cur = s[which];
    timePicker.open({
      mode: 'time',
      value: new Date(2000, 0, 1, cur.hour, cur.minute),
      title: which === 'summary' ? t('monthlyUnpaidAlert') : t('reminderSchedule'),
      onPick: (date) => update({ ...s, [which]: { ...cur, hour: date.getHours(), minute: date.getMinutes() } }),
    });
  };

  const timeChip = (which: 'summary' | 'reminders') => {
    const time = `${pad(s[which].hour)}:${pad(s[which].minute)}`;
    return (
      <Row>
        <Chip
          variant="assist"
          icon="time-outline"
          label={`${t('atTime')} ${bidiIsolate(time)}`}
          accessibilityLabel={t('settingsAlertTimeA11y', { time })}
          onPress={() => pickTime(which)}
        />
      </Row>
    );
  };

  const dayChip = (d: number, selected: boolean, onPress: () => void) => (
    <Chip
      key={d}
      label={String(d)}
      selected={selected}
      accessibilityLabel={t('settingsDayN', { n: d })}
      onPress={onPress}
    />
  );

  return (
    <Screen>
      <Card style={styles.card}>
        <AlertHeader
          icon="notifications-outline"
          title={t('monthlyUnpaidAlert')}
          right={
            <AppSwitch
              value={s.summary.enabled}
              onValueChange={(v) => update({ ...s, summary: { ...s.summary, enabled: v } })}
              accessibilityLabel={t('monthlyUnpaidAlert')}
            />
          }
        />
        <Txt variant="muted">{t('monthlyUnpaidAlertHint')}</Txt>
        {s.summary.enabled ? (
          <>
            <Txt variant="label">{t('onDay')}</Txt>
            <Row wrap gap={space.sm}>
              {ALERT_DAYS.map((d) =>
                dayChip(d, s.summary.day === d, () => update({ ...s, summary: { ...s.summary, day: d } })),
              )}
            </Row>
            {timeChip('summary')}
          </>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AlertHeader
          icon="alarm-outline"
          title={t('reminderSchedule')}
          right={
            premium.active ? (
              <AppSwitch
                value={s.reminders.enabled}
                onValueChange={(v) => update({ ...s, reminders: { ...s.reminders, enabled: v } })}
                accessibilityLabel={t('reminderSchedule')}
              />
            ) : (
              <PremiumChip />
            )
          }
        />
        <Txt variant="muted">{t('reminderScheduleHint')}</Txt>
        {premium.active && s.reminders.enabled ? (
          <>
            <Txt variant="label">{t('onDays')}</Txt>
            <Row wrap gap={space.sm}>
              {ALERT_DAYS.map((d) => {
                const on = s.reminders.days.includes(d);
                return dayChip(d, on, () => {
                  const days = on
                    ? s.reminders.days.filter((x) => x !== d)
                    : [...s.reminders.days, d].sort((a, b) => a - b);
                  if (days.length > 0) update({ ...s, reminders: { ...s.reminders, days } });
                });
              })}
            </Row>
            {timeChip('reminders')}
          </>
        ) : null}
      </Card>

      <Button
        title={t('sendTestAlert')}
        icon="notifications-outline"
        variant="tonal"
        onPress={testAlert}
        loading={testing}
      />
      <Row gap={space.sm} align="flex-start">
        <Icon name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Txt variant="small">{t('alertsPrivacy')}</Txt>
        </View>
      </Row>
      {timePicker.picker}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.md },
});
