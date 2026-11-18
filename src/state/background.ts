/**
 * Background work while the app is open: cloud sync, rescheduling owner
 * alerts, and opening the right screen when an alert is tapped.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { cloudConfigured } from '../config';
import { useDataVersion } from '../db/events';
import { getActiveBusiness, getBusinessById, setActiveBusiness } from '../db/repo';
import { notificationTarget } from '../lib/deepLinks';
import { configureNotifications, rescheduleAlerts } from '../lib/notify';
import { pruneProofs } from '../lib/proofs';
import { linkedBusinesses, pendingChanges } from '../sync/engine';
import { runSync } from '../sync/runner';
import { useApp } from './app';

const SYNC_EVERY_MS = 3 * 60 * 1000;

export function useBackgroundWork() {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const { t, money, monthLabel, premium, lang, business, can, ready } = useApp();
  const premiumActive = premium.active;

  // Proof screenshots whose payment, customer or business was deleted.
  useEffect(() => {
    pruneProofs(db).catch(() => undefined);
  }, [db]);

  // --- Cloud sync: on open, on resume, every few minutes, and after local edits.
  useEffect(() => {
    if (!cloudConfigured) return;
    const go = () => {
      runSync(db, premiumActive);
    };
    go();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') go();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') go();
    }, SYNC_EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [db, premiumActive]);

  const firstVersion = useRef(true);
  useEffect(() => {
    if (!cloudConfigured) return;
    if (firstVersion.current) {
      firstVersion.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      for (const id of await linkedBusinesses(db)) {
        if ((await pendingChanges(db, id)) > 0) {
          runSync(db, premiumActive);
          return;
        }
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [db, version, premiumActive]);

  // --- Owner alerts: keep the scheduled notifications' numbers current.
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        await configureNotifications(t('alertsChannel'));
        await rescheduleAlerts(
          db,
          {
            summaryTitle: (p) => t('alertSummaryTitle', p),
            summaryBody: (p) => t('alertSummaryBody', p),
            nextMonthBody: (p) => t('alertNextMonthBody', p),
            remindersTitle: (p) => t('alertRemindersTitle', p),
            remindersBody: (p) => t('alertRemindersBody', p),
            monthLabel,
            money,
          },
          premiumActive,
        );
      })().catch(() => {
        if (__DEV__) console.warn('Scheduling alerts failed');
      });
    }, 2000);
    return () => clearTimeout(timer);
    // t/money/monthLabel follow `lang` and the business currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, premiumActive, lang, business?.currency]);

  // --- Tapping an alert opens its list (switching business if needed).
  // Only the two alert screens open, rebuilt from checked parts (lib/deepLinks),
  // and only for a business on this phone. Switching business follows the same
  // rule as the business switcher: on a shared phone, a collector or manager
  // must not land in another business (where they could be the owner).
  // A tap is handled only once the phone's user (and so their role) is known:
  // taps wait in `pendingTap` until the app state has loaded.
  const pendingTap = useRef<unknown>(null);
  const current = useRef({ ready, can });
  useEffect(() => {
    current.current = { ready, can };
  }, [ready, can]);
  const openTap = useCallback(async () => {
    const data = pendingTap.current;
    if (!current.current.ready || data === null) return;
    pendingTap.current = null;
    const target = notificationTarget(data);
    if (!target) return;
    if (target.businessId && (await getActiveBusiness(db))?.id !== target.businessId) {
      if (!current.current.can('businesses.manage') || !(await getBusinessById(db, target.businessId))) return;
      await setActiveBusiness(db, target.businessId);
    }
    router.push(target.url as never);
  }, [db]);
  useEffect(() => {
    const queue = (data: unknown) => {
      pendingTap.current = data ?? null;
      openTap().catch(() => {
        if (__DEV__) console.warn('Opening an alert failed');
      });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      queue(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      queue(r.notification.request.content.data);
    });
    return () => sub.remove();
  }, [openTap]);
  useEffect(() => {
    if (!ready) return;
    openTap().catch(() => {
      if (__DEV__) console.warn('Opening an alert failed');
    });
  }, [ready, can, openTap]);
}
