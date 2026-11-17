/**
 * When to show owner alerts. Pure date logic, so it can be tested; the
 * notifications themselves are scheduled in notify.ts.
 *
 * - summary (version 2): once a month, "15 customers still unpaid".
 * - reminders (premium): on chosen days, a prompt to send WhatsApp reminders
 *   to everyone unpaid (the sending itself stays one tap per customer).
 */
import { addMonths, toMonthKey, type MonthKey } from './date';

export interface AlertSettings {
  summary: { enabled: boolean; day: number; hour: number; minute: number };
  reminders: { enabled: boolean; days: number[]; hour: number; minute: number };
}

export const DEFAULT_ALERTS: AlertSettings = {
  summary: { enabled: false, day: 10, hour: 10, minute: 0 },
  reminders: { enabled: false, days: [5, 15, 25], hour: 11, minute: 0 },
};

export const ALERT_DAYS = [1, 3, 5, 7, 10, 12, 15, 20, 25, 28];

export function parseAlerts(raw: string | null): AlertSettings {
  if (!raw) return DEFAULT_ALERTS;
  try {
    const v = JSON.parse(raw) as Partial<AlertSettings>;
    return {
      summary: { ...DEFAULT_ALERTS.summary, ...v.summary },
      reminders: { ...DEFAULT_ALERTS.reminders, ...v.reminders },
    };
  } catch {
    return DEFAULT_ALERTS;
  }
}

export interface AlertTrigger {
  kind: 'summary' | 'reminders';
  date: Date;
  month: MonthKey;
}

function at(month: MonthKey, day: number, hour: number, minute: number): Date {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(day, 1), last), hour, minute, 0, 0);
}

/**
 * Upcoming alerts for this month and the next `monthsAhead` months, in time
 * order. Rescheduled every time the app opens, so counts stay fresh.
 */
export function upcomingAlerts(s: AlertSettings, now: Date, monthsAhead = 1, premium = true): AlertTrigger[] {
  const out: AlertTrigger[] = [];
  const first = toMonthKey(now);
  for (let i = 0; i <= monthsAhead; i++) {
    const month = addMonths(first, i);
    if (s.summary.enabled) {
      out.push({ kind: 'summary', month, date: at(month, s.summary.day, s.summary.hour, s.summary.minute) });
    }
    if (premium && s.reminders.enabled) {
      for (const day of [...new Set(s.reminders.days)]) {
        out.push({ kind: 'reminders', month, date: at(month, day, s.reminders.hour, s.reminders.minute) });
      }
    }
  }
  return out.filter((a) => a.date.getTime() > now.getTime()).sort((a, b) => a.date.getTime() - b.date.getTime());
}
