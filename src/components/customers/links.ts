/**
 * Contact links for a customer's stored phone number. Every URL is built only
 * from a phone number that passes isValidPhone, and only from its digits (plus
 * a leading "+"), so text saved in the phone field (or arriving through sync or
 * a restored backup) can never inject another URL scheme or extra parameters
 * into Linking.openURL.
 */
import { DEFAULT_COUNTRY_CODE } from '../../config';
import { digitsOf, isValidPhone } from '../../lib/phone';
import { smsUrl, whatsappUrl } from '../../lib/template';

/** The phone number reduced to an optional leading "+" and digits, or null if it isn't valid. */
export function dialablePhone(phone: string | null | undefined): string | null {
  if (!phone || !isValidPhone(phone)) return null;
  const digits = digitsOf(phone);
  return phone.trim().startsWith('+') ? `+${digits}` : digits;
}

/** `tel:` URL, or null when the number isn't valid (then Call is hidden). */
export function telUrl(phone: string | null | undefined): string | null {
  const n = dialablePhone(phone);
  return n ? `tel:${n}` : null;
}

/** WhatsApp chat (https://wa.me/<international number>) with no text, or null. */
export function whatsappChatUrl(phone: string | null | undefined): string | null {
  const n = dialablePhone(phone);
  if (!n) return null;
  const url = whatsappUrl(n, '', DEFAULT_COUNTRY_CODE);
  // whatsappUrl always builds https://wa.me/<digits>; keep only that shape.
  return url && /^https:\/\/wa\.me\/\d{8,15}\?text=$/.test(url) ? url.replace(/\?text=$/, '') : null;
}

/** `sms:` URL that opens the messages app with no text, or null. */
export function smsChatUrl(phone: string | null | undefined): string | null {
  const n = dialablePhone(phone);
  if (!n) return null;
  const url = smsUrl(n, '');
  return url && /^sms:\+?\d{7,15}\?body=$/.test(url) ? url.replace(/\?body=$/, '') : null;
}
