import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TOKEN_LENGTH,
  SITEVERIFY_URL,
  TEST_KEYS,
  isServiceFailure,
  turnstileSiteKey,
  verifyTurnstile,
} from '../../src/lib/turnstile';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

describe('verifyTurnstile', () => {
  it('posts the secret, token and visitor address to siteverify', async () => {
    const fetcher = vi.fn(async () => json({ success: true }));
    const result = await verifyTurnstile({
      secret: 'test-secret',
      token: 'XXXX.DUMMY.TOKEN.XXXX',
      remoteIp: '192.0.2.1',
      fetch: fetcher,
    });

    expect(result).toEqual({ success: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('test-secret');
    expect(body.get('response')).toBe('XXXX.DUMMY.TOKEN.XXXX');
    expect(body.get('remoteip')).toBe('192.0.2.1');
  });

  it('answers Cloudflare’s test secrets the way Cloudflare does, without a network call', async () => {
    const fetcher = vi.fn();
    const verify = (secret: string) =>
      verifyTurnstile({ secret, token: 'XXXX.DUMMY.TOKEN.XXXX', fetch: fetcher });

    expect(await verify(TEST_KEYS.secretAlwaysPasses)).toEqual({ success: true });
    expect(await verify(TEST_KEYS.secretAlwaysFails)).toEqual({
      success: false,
      errorCodes: ['invalid-input-response'],
    });
    expect(await verify(TEST_KEYS.secretTokenSpent)).toEqual({
      success: false,
      errorCodes: ['timeout-or-duplicate'],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('still refuses a missing token with a test secret', async () => {
    expect(
      await verifyTurnstile({ secret: TEST_KEYS.secretAlwaysPasses, token: '', fetch: vi.fn() }),
    ).toEqual({ success: false, errorCodes: ['missing-input-response'] });
  });

  it('refuses a token solved on another host', async () => {
    const fetcher = vi.fn(async () => json({ success: true, hostname: 'preview.example.test' }));
    const verify = (hostname?: string) =>
      verifyTurnstile({ secret: 's', token: 't', hostname, fetch: fetcher });

    expect(await verify('site.example.test')).toEqual({
      success: false,
      errorCodes: ['hostname-mismatch'],
    });
    expect(isServiceFailure(['hostname-mismatch'])).toBe(false);
    expect(await verify('preview.example.test')).toEqual({ success: true });
  });

  it('refuses an answer that names no host when one is expected', async () => {
    const fetcher = vi.fn(async () => json({ success: true }));
    expect(
      await verifyTurnstile({
        secret: 's',
        token: 't',
        hostname: 'site.example.test',
        fetch: fetcher,
      }),
    ).toEqual({ success: false, errorCodes: ['hostname-mismatch'] });
  });

  it('returns the error codes of a failed token', async () => {
    const fetcher = vi.fn(async () =>
      json({ success: false, 'error-codes': ['invalid-input-response'] }),
    );
    const result = await verifyTurnstile({ secret: 's', token: 't', fetch: fetcher });
    expect(result).toEqual({ success: false, errorCodes: ['invalid-input-response'] });
  });

  it('does not call Cloudflare for a missing or overlong token', async () => {
    const fetcher = vi.fn();
    expect(await verifyTurnstile({ secret: 's', token: '', fetch: fetcher })).toEqual({
      success: false,
      errorCodes: ['missing-input-response'],
    });
    expect(
      await verifyTurnstile({
        secret: 's',
        token: 'x'.repeat(MAX_TOKEN_LENGTH + 1),
        fetch: fetcher,
      }),
    ).toEqual({ success: false, errorCodes: ['invalid-input-response'] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports an unreachable service or an odd answer as a service failure', async () => {
    const down = await verifyTurnstile({
      secret: 's',
      token: 't',
      fetch: vi.fn(async () => {
        throw new TypeError('network down');
      }),
    });
    const odd = await verifyTurnstile({
      secret: 's',
      token: 't',
      fetch: vi.fn(async () => json({ success: 'yes' })),
    });

    expect(down).toEqual({ success: false, errorCodes: ['unreachable'] });
    expect(odd).toEqual({ success: false, errorCodes: ['unknown'] });
    expect(isServiceFailure(['unreachable'])).toBe(true);
    expect(isServiceFailure(['unknown'])).toBe(true);
  });

  it('tells a rejected token from a problem on our side', () => {
    expect(isServiceFailure(['invalid-input-response'])).toBe(false);
    expect(isServiceFailure(['timeout-or-duplicate'])).toBe(false);
    expect(isServiceFailure(['invalid-input-secret'])).toBe(true);
    expect(isServiceFailure(['internal-error'])).toBe(true);
    expect(isServiceFailure(['bad-request'])).toBe(true);
  });
});

describe('turnstileSiteKey', () => {
  it('uses the configured key', () => {
    expect(turnstileSiteKey(' 0x4AAAAexample ', true)).toBe('0x4AAAAexample');
  });

  it('falls back to the always-pass test key before launch', () => {
    expect(turnstileSiteKey(undefined, false)).toBe(TEST_KEYS.siteAlwaysPasses);
    expect(turnstileSiteKey('', false)).toBe(TEST_KEYS.siteAlwaysPasses);
  });

  it('leaves the widget out of a launched build with no key', () => {
    expect(turnstileSiteKey(undefined, true)).toBeNull();
  });
});
