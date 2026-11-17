/**
 * Build a customer's payment reminder from the business template and open
 * it in WhatsApp (or the SMS app), logging it in reminders_log.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';

import { DEFAULT_COUNTRY_CODE } from '../config';
import { logReminder } from '../db/repo';
import type { ReminderChannel } from '../db/types';
import type { ChainDue } from '../lib/dues';
import { DEFAULT_TEMPLATES, fillTemplate, paymentBlock, smsUrl, whatsappUrl } from '../lib/template';
import { useApp } from '../state/app';

export interface ReminderTarget extends ChainDue {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
}

export function useReminders() {
  const db = useSQLiteContext();
  const { t, money, monthLabel, business, lang, premium, staff } = useApp();

  const template = business?.reminder_template?.trim() || DEFAULT_TEMPLATES[lang];
  const payment = premium.active
    ? paymentBlock(business?.payment_info ?? null, business?.payment_link ?? null, t('payOnline'))
    : '';

  const messageFor = useCallback(
    (d: Pick<ReminderTarget, 'customer_name' | 'month' | 'total_due' | 'paid_amount'>) =>
      fillTemplate(template, {
        name: d.customer_name,
        amount: money(Math.max(0, d.total_due - d.paid_amount)),
        month: monthLabel(d.month),
        business: business?.name ?? '',
        phone: business?.phone ?? null,
        payment,
      }),
    [template, money, monthLabel, business, payment],
  );

  /** Open the chat with the message typed in. Returns false if it couldn't be opened. */
  const send = useCallback(
    async (d: ReminderTarget, channel: ReminderChannel): Promise<boolean> => {
      const text = messageFor(d);
      const url =
        channel === 'whatsapp'
          ? whatsappUrl(d.customer_phone, text, DEFAULT_COUNTRY_CODE)
          : smsUrl(d.customer_phone, text);
      if (!url) {
        Alert.alert(t('noPhoneTitle'), t('noPhoneBody', { name: d.customer_name }));
        return false;
      }
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(t('cannotOpenApp'));
        return false;
      }
      if (business) {
        await logReminder(db, {
          business_id: business.id,
          customer_id: d.customer_id,
          monthly_due_id: d.id,
          channel,
          sent_by: staff?.id ?? null,
        });
      }
      return true;
    },
    [db, messageFor, business, staff, t],
  );

  return { messageFor, send, template };
}
