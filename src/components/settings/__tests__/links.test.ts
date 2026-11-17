import { beforeEach, describe, expect, it } from '@jest/globals';

import { isSafeEmail, mailtoUrl, safeHttpsUrl } from '../links';
import {
  clearPinTries,
  LOCK_MS,
  MAX_LOCK_MS,
  MAX_TRIES,
  pinWaitSeconds,
  recordWrongPin,
  type ThrottleStore,
} from '../pinThrottle';

describe('safeHttpsUrl', () => {
  it('accepts plain https links', () => {
    expect(safeHttpsUrl('https://example.com/fee-tracker/delete-account')).toBe(
      'https://example.com/fee-tracker/delete-account',
    );
    expect(safeHttpsUrl('  https://a.example.org:8443/x?y=1#z ')).toBe('https://a.example.org:8443/x?y=1#z');
  });

  it('rejects other schemes and malformed links', () => {
    for (const bad of [
      'http://example.com',
      'javascript:alert(1)',
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///data/data/app.db',
      'https://',
      'https://localhost/x',
      'https://user:pass@example.com/',
      'https://example.com/a b',
      'https://exa\u202Emple.com',
      '',
      null,
      undefined,
    ]) {
      expect(safeHttpsUrl(bad as string)).toBeNull();
    }
  });
});

describe('mailtoUrl', () => {
  it('builds an encoded mailto link for a plain address', () => {
    expect(mailtoUrl('support@example.com')).toBe('mailto:support@example.com');
    expect(mailtoUrl('a+b%c@example.co')).toBe('mailto:a%2Bb%25c@example.co');
  });

  it('refuses anything that is not a plain address', () => {
    for (const bad of ['support@example.com?subject=x', 'a b@example.com', '<a@b.com>', 'a@b', 'x@@b.com', '']) {
      expect(isSafeEmail(bad)).toBe(false);
      expect(mailtoUrl(bad)).toBeNull();
    }
  });
});

describe('pin throttle', () => {
  let saved: Map<string, string>;
  let store: ThrottleStore;
  beforeEach(() => {
    saved = new Map();
    store = {
      get: async (k) => saved.get(k) ?? null,
      set: async (k, v) => {
        if (v === null) saved.delete(k);
        else saved.set(k, v);
      },
    };
  });

  it('pauses after too many wrong PINs and clears after a correct one', async () => {
    const now = 1_000_000;
    for (let i = 1; i < MAX_TRIES; i++) expect(await recordWrongPin(store, 's1', now)).toBe(0);
    expect(await recordWrongPin(store, 's1', now)).toBe(LOCK_MS / 1000);
    expect(await pinWaitSeconds(store, 's1', now + 1000)).toBe(LOCK_MS / 1000 - 1);
    expect(await pinWaitSeconds(store, 's2', now)).toBe(0);
    expect(await pinWaitSeconds(store, 's1', now + LOCK_MS)).toBe(0);
    await clearPinTries(store, 's1');
    expect(await pinWaitSeconds(store, 's1', now)).toBe(0);
  });

  it('doubles each pause, up to an hour, and keeps counting across restarts', async () => {
    let now = 1_000_000;
    const waits: number[] = [];
    for (let round = 0; round < 9; round++) {
      let wait = 0;
      for (let i = 0; i < MAX_TRIES; i++) wait = await recordWrongPin(store, 's1', now);
      waits.push(wait);
      now += wait * 1000;
    }
    expect(waits.slice(0, 4)).toEqual([30, 60, 120, 240]);
    expect(Math.max(...waits)).toBe(MAX_LOCK_MS / 1000);
    // The counts live in the store (app_meta), not in memory: a "restart" keeps them.
    expect(saved.size).toBe(1);
  });

  it('treats a damaged record as no record', async () => {
    saved.set('pin_tries:s1', '{not json');
    expect(await pinWaitSeconds(store, 's1')).toBe(0);
    saved.set('pin_tries:s1', JSON.stringify({ wrong: -3, lockedUntil: 'soon' }));
    expect(await pinWaitSeconds(store, 's1')).toBe(0);
  });
});
