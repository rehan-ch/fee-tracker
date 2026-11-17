/**
 * Payment reminder messages (WhatsApp / SMS) built from the business's
 * template with {name}, {amount}, {month}, {business}, {phone} and
 * {payment} placeholders.
 */
import type { Language } from '../db/types';
import { toInternational } from './phone';

export const PLACEHOLDERS = ['{name}', '{amount}', '{month}', '{business}', '{phone}', '{payment}'] as const;

export const DEFAULT_TEMPLATES: Record<Language, string> = {
  en:
    'Assalam-o-Alaikum {name},\n' +
    'This is a reminder that your {month} fee of {amount} for {business} is due. ' +
    'Please pay at your earliest convenience.\n{payment}\nThank you!',
  ur:
    'السلام علیکم {name}،\n' +
    '{business} کی {month} کی فیس {amount} ادا کرنا باقی ہے۔ ' +
    'براہ کرم جلد ادائیگی کر دیں۔\n{payment}\nشکریہ!',
};

export interface TemplateValues {
  name: string;
  amount: string;
  month: string;
  business: string;
  phone: string | null;
  /** Payment details and link (premium), already formatted; empty when not used. */
  payment: string;
}

/** Fill the placeholders and tidy the empty lines a missing value leaves behind. */
export function fillTemplate(template: string, v: TemplateValues): string {
  const map: Record<string, string> = {
    '{name}': v.name,
    '{amount}': v.amount,
    '{month}': v.month,
    '{business}': v.business,
    '{phone}': v.phone ?? '',
    '{payment}': v.payment,
  };
  return template
    .replace(/\{(name|amount|month|business|phone|payment)\}/g, (m) => map[m] ?? m)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Payment details block for messages and receipts, e.g. "JazzCash 0300-…\nPay online: https://…". */
export function paymentBlock(info: string | null, link: string | null, payOnlineLabel: string): string {
  const parts: string[] = [];
  if (info?.trim()) parts.push(info.trim());
  if (link?.trim()) parts.push(`${payOnlineLabel}: ${link.trim()}`);
  return parts.join('\n');
}

/** wa.me link that opens a chat with the message typed in (WhatsApp or WhatsApp Business). */
export function whatsappUrl(phone: string | null, text: string, countryCode: string): string | null {
  const number = toInternational(phone, countryCode);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** sms: link that opens the messaging app with the text filled in (no SMS permission needed). */
export function smsUrl(phone: string | null, text: string): string | null {
  // Digits only, with an optional leading "+": nothing else can reach the URL.
  const raw = (phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `sms:${raw.startsWith('+') ? '+' : ''}${digits}?body=${encodeURIComponent(text)}`;
}

/** Only http(s) links are allowed as payment links. */
export function isValidLink(url: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url.trim());
}
