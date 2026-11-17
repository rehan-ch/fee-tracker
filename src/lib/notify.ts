/**
 * Owner alerts as local notifications (nothing is sent to a server). All
 * alerts are cancelled and scheduled again whenever the app opens or data
 * changes, so the numbers in them stay current.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  getMeta,
  listBusinesses,
  monthSummary,
  projectedUnpaidNextMonth,
  setMeta,
} from '../db/repo';
import { parseAlerts, upcomingAlerts, type AlertSettings } from './alerts';
import { currentMonthKey } from './date';

export const CHANNEL_ID = 'alerts';
export const alertsKey = (businessId: string) => `alerts:${businessId}`;

export async function getAlertSettings(db: SQLiteDatabase, businessId: string): Promise<AlertSettings> {
  return parseAlerts(await getMeta(db, alertsKey(businessId)));
}

export async function saveAlertSettings(db: SQLiteDatabase, businessId: string, s: AlertSettings) {
  await setMeta(db, alertsKey(businessId), JSON.stringify(s));
}

let configured = false;
/** Show alerts while the app is open too, and create the Android channel. */
export async function configureNotifications(channelName: string): Promise<void> {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Ask for notification permission (Android 13+ shows a prompt). */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export interface AlertTexts {
  summaryTitle: (p: { business: string; count: number }) => string;
  summaryBody: (p: { month: string; pending: string }) => string;
  nextMonthBody: (p: { month: string; count: number }) => string;
  remindersTitle: (p: { business: string }) => string;
  remindersBody: (p: { month: string; count: number }) => string;
  monthLabel: (m: string) => string;
  money: (n: number) => string;
}

/** Cancel and reschedule every business's alerts. Safe to call often. */
export async function rescheduleAlerts(db: SQLiteDatabase, texts: AlertTexts, premium: boolean): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!perm.granted) return;
  const now = new Date();
  const current = currentMonthKey();
  for (const business of await listBusinesses(db)) {
    const settings = await getAlertSettings(db, business.id);
    const triggers = upcomingAlerts(settings, now, 1, premium);
    if (triggers.length === 0) continue;
    const summary = await monthSummary(db, business.id, current);
    const unpaidNow = summary.counts.unpaid + summary.counts.partial;
    const unpaidNext = await projectedUnpaidNextMonth(db, business.id);
    for (const trig of triggers.slice(0, 20)) {
      const thisMonth = trig.month === current;
      const count = thisMonth ? unpaidNow : unpaidNext;
      if (count === 0) continue;
      const month = texts.monthLabel(trig.month);
      const content =
        trig.kind === 'summary'
          ? {
              title: texts.summaryTitle({ business: business.name, count }),
              body: thisMonth
                ? texts.summaryBody({ month, pending: texts.money(summary.pending) })
                : texts.nextMonthBody({ month, count }),
              data: { businessId: business.id, url: `/collection?tab=unpaid&month=${trig.month}` },
            }
          : {
              title: texts.remindersTitle({ business: business.name }),
              body: texts.remindersBody({ month, count }),
              data: { businessId: business.id, url: `/reminders?month=${trig.month}` },
            };
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trig.date, channelId: CHANNEL_ID },
      });
    }
  }
}

/** Show the unpaid alert right away, so the owner can check notifications work. */
export async function sendTestAlert(
  db: SQLiteDatabase,
  business: { id: string; name: string },
  texts: Pick<AlertTexts, 'summaryTitle' | 'summaryBody' | 'monthLabel' | 'money'>,
): Promise<void> {
  const month = currentMonthKey();
  const summary = await monthSummary(db, business.id, month);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: texts.summaryTitle({ business: business.name, count: summary.counts.unpaid + summary.counts.partial }),
      body: texts.summaryBody({ month: texts.monthLabel(month), pending: texts.money(summary.pending) }),
      data: { businessId: business.id, url: `/collection?tab=unpaid&month=${month}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: CHANNEL_ID },
  });
}
