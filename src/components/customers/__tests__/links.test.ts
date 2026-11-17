import { describe, expect, it } from '@jest/globals';

import { dialablePhone, smsChatUrl, telUrl, whatsappChatUrl } from '../links';

describe('customer contact links', () => {
  it('builds tel: from digits only, keeping a leading +', () => {
    expect(telUrl('0300-1234567')).toBe('tel:03001234567');
    expect(telUrl('+92 300 123 4567')).toBe('tel:+923001234567');
    expect(telUrl('(042) 3576-1234')).toBe('tel:04235761234');
  });

  it('refuses numbers that fail isValidPhone (Call is hidden)', () => {
    expect(telUrl(null)).toBeNull();
    expect(telUrl('')).toBeNull();
    expect(telUrl('12345')).toBeNull();
    expect(telUrl('0300-1234567;javascript:alert(1)')).toBeNull();
    expect(telUrl('0300 1234567?body=x')).toBeNull();
    expect(telUrl('https://evil.example/03001234567')).toBeNull();
    expect(telUrl('+92+3001234567')).toBeNull();
    expect(dialablePhone('03001234567\nsms:123')).toBeNull();
  });

  it('opens WhatsApp only on https://wa.me with an international number', () => {
    expect(whatsappChatUrl('0300-1234567')).toBe('https://wa.me/923001234567');
    expect(whatsappChatUrl('+44 20 7946 0958')).toBe('https://wa.me/442079460958');
    expect(whatsappChatUrl('abc')).toBeNull();
    expect(whatsappChatUrl('1234567')).toBeNull();
  });

  it('opens SMS with digits only and no body', () => {
    expect(smsChatUrl('0300-1234567')).toBe('sms:03001234567');
    expect(smsChatUrl('+92 300 1234567')).toBe('sms:+923001234567');
    expect(smsChatUrl('0300-1234567&body=hi')).toBeNull();
  });
});
