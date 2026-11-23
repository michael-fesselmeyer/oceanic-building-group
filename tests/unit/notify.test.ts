import { describe, expect, it, vi } from 'vitest';
import type { Intake } from '../../src/lib/intake';
import { readIntakeConfig } from '../../src/lib/intake-config';
import {
  createLeadNotifier,
  createNotifier,
  formatLeadEmail,
  type Channel,
  type Lead,
} from '../../src/lib/notify';
import type { EmailMessage } from '../../src/lib/notify/email';
import { logTransport } from '../../src/lib/notify/log-transport';
import { RESEND_ENDPOINT, resendTransport } from '../../src/lib/notify/resend';
import { redactEmail, redactName, redactPhone } from '../../src/lib/redact';

const intake: Intake = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  projectType: 'renovation',
  message: 'A kitchen and two bathrooms in a 1980s house.',
};
const lead: Lead = { intake, spamCheck: 'passed', key: 'lead-test-1' };

const message: EmailMessage = {
  from: 'Website <website@example.test>',
  to: ['office@example.test'],
  replyTo: intake.email,
  subject: 'New enquiry',
  text: 'Body',
  idempotencyKey: lead.key,
};

function fakeLogger() {
  const lines: string[] = [];
  const record = (line: string) => void lines.push(line);
  return { logger: { info: record, warn: record, error: record }, lines };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('formatLeadEmail', () => {
  it('writes every answer into the body and the project and name into the subject', () => {
    const { subject, text } = formatLeadEmail(lead);
    expect(subject).toBe('New enquiry: Renovation from Dana Rivera');
    for (const line of [
      'Name: Dana Rivera',
      'Email: dana.rivera@example.test',
      'Phone: (561) 555-0142',
      'Project: Renovation',
      intake.message,
    ]) {
      expect(text).toContain(line);
    }
  });

  it('says when no phone number was given', () => {
    const withoutPhone = { ...intake, phone: undefined };
    expect(formatLeadEmail({ ...lead, intake: withoutPhone }).text).toContain('Phone: not given');
  });

  it('keeps line breaks out of the subject', () => {
    const { subject } = formatLeadEmail({
      ...lead,
      intake: { ...intake, name: 'Dana\r\nBcc: someone@example.test' },
    });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('does not depend on the time, so a resend produces the same email', () => {
    expect(formatLeadEmail(lead)).toEqual(formatLeadEmail(structuredClone(lead)));
  });
});

describe('resendTransport', () => {
  it('posts the email with the key, the idempotency key and a reply-to address', async () => {
    const fetcher = vi.fn(async () => json(200, { id: 'email-id' }));
    const result = await resendTransport({ apiKey: 're_test_key', fetch: fetcher }).send(message);

    expect(result).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Idempotency-Key': lead.key,
    });
    expect(JSON.parse(init.body as string)).toEqual({
      from: message.from,
      to: message.to,
      reply_to: message.replyTo,
      subject: message.subject,
      text: message.text,
    });
  });

  it.each([
    ['daily_quota_exceeded', 'quota'],
    ['monthly_quota_exceeded', 'quota'],
  ])('reports %s as a quota failure without retrying', async (name, reason) => {
    const fetcher = vi.fn(async () => json(429, { name }));
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);
    expect(result).toEqual({ ok: false, reason, detail: name });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries a provider error once with the same idempotency key', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(503, { name: 'service_unavailable' }))
      .mockResolvedValueOnce(json(200, { id: 'email-id' }));
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const keys = fetcher.mock.calls.map(([, init]) => (init as RequestInit).headers);
    expect(keys[0]).toEqual(keys[1]);
  });

  it('gives up after a second failure', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);
    expect(result).toEqual({ ok: false, reason: 'unavailable', detail: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('treats a rate limit as passing and retries it', async () => {
    const fetcher = vi.fn(async () => json(429, { name: 'rate_limit_exceeded' }));
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);
    expect(result).toEqual({ ok: false, reason: 'rate-limited', detail: 'rate_limit_exceeded' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('counts a twin request already in flight as delivered', async () => {
    const fetcher = vi.fn(async () => json(409, { name: 'concurrent_idempotent_requests' }));
    expect(await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message)).toEqual({
      ok: true,
    });
  });

  it('reports a refused request (bad key, unverified sender) without retrying', async () => {
    const fetcher = vi.fn(async () => json(403, { name: 'validation_error' }));
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);
    expect(result).toEqual({ ok: false, reason: 'rejected', detail: 'validation_error' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('copes with an error answer that is not JSON', async () => {
    const fetcher = vi.fn(async () => new Response('Bad gateway', { status: 502 }));
    const result = await resendTransport({ apiKey: 'key', fetch: fetcher }).send(message);
    expect(result).toEqual({ ok: false, reason: 'unavailable', detail: 'http 502' });
  });
});

describe('logTransport', () => {
  it('sends nothing and logs one redacted line', async () => {
    const { logger, lines } = fakeLogger();
    const result = await logTransport(logger).send({ ...message, text: intake.message });

    expect(result).toEqual({ ok: true });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('to o***@***.test, reply to d***@***.test');
    expect(lines[0]).not.toContain(intake.email);
    expect(lines[0]).not.toContain(intake.message);
  });
});

describe('createNotifier', () => {
  const channel = (name: string, required: boolean, ok: boolean): Channel => ({
    name,
    required,
    send: async () => (ok ? { ok: true } : { ok: false, reason: 'unavailable' }),
  });

  it('delivers when every required channel succeeds, even if an optional one fails', async () => {
    const { logger, lines } = fakeLogger();
    const notifier = createNotifier(
      [channel('email', true, true), channel('sms', false, false)],
      logger,
    );
    const result = await notifier.notify(lead);

    expect(result.delivered).toBe(true);
    expect(result.failures).toEqual([{ channel: 'sms', required: false, reason: 'unavailable' }]);
    expect(lines).toEqual(['[intake] sms failed: unavailable']);
  });

  it('does not deliver when a required channel fails', async () => {
    const { logger } = fakeLogger();
    const notifier = createNotifier(
      [channel('email', true, false), channel('sms', false, true)],
      logger,
    );
    expect((await notifier.notify(lead)).delivered).toBe(false);
  });

  it('refuses a channel list with nothing required', () => {
    const { logger } = fakeLogger();
    expect(() => createNotifier([channel('sms', false, true)], logger)).toThrow();
  });

  it('builds an email notifier from settings', async () => {
    const { logger, lines } = fakeLogger();
    const config = readIntakeConfig(
      { LEAD_NOTIFICATION_EMAIL: 'office@example.test' },
      { dev: true },
    );
    if (!config.ok) throw new Error('expected settings');
    const result = await createLeadNotifier(config.config.email, { logger }).notify(lead);
    expect(result.delivered).toBe(true);
    expect(lines[0]).toMatch(/^\[intake\] email not sent \(log transport\)/);
  });
});

describe('readIntakeConfig', () => {
  const production = {
    RESEND_API_KEY: 're_test_key',
    LEAD_FROM_EMAIL: 'Website <website@example.test>',
    LEAD_NOTIFICATION_EMAIL: 'office@example.test, sales@example.test',
    TURNSTILE_SECRET_KEY: 'secret',
  };

  it('reads a complete production setup', () => {
    expect(readIntakeConfig(production, { dev: false })).toEqual({
      ok: true,
      config: {
        turnstile: { secret: 'secret', required: false },
        email: {
          transport: 'resend',
          apiKey: 're_test_key',
          from: production.LEAD_FROM_EMAIL,
          to: ['office@example.test', 'sales@example.test'],
        },
      },
    });
  });

  it('fills in the log transport and the test secret on the development server', () => {
    const result = readIntakeConfig({}, { dev: true });
    expect(result.ok && result.config.email.transport).toBe('log');
    expect(result.ok && result.config.turnstile.secret).toMatch(/^1x0+AA$/);
  });

  it('gives no defaults to a built site', () => {
    expect(readIntakeConfig({}, { dev: false })).toEqual({
      ok: false,
      problems: [
        'TURNSTILE_SECRET_KEY is not set',
        'RESEND_API_KEY is not set',
        'LEAD_FROM_EMAIL is not set',
        'LEAD_NOTIFICATION_EMAIL is not set',
      ],
    });
  });

  it('names a bad recipient list without repeating it', () => {
    const result = readIntakeConfig(
      { ...production, LEAD_NOTIFICATION_EMAIL: 'office@example.test, nonsense' },
      { dev: false },
    );
    expect(result).toEqual({
      ok: false,
      problems: ['LEAD_NOTIFICATION_EMAIL holds an address that is not valid'],
    });
  });

  it('rejects an unknown transport', () => {
    const result = readIntakeConfig({ ...production, EMAIL_TRANSPORT: 'pigeon' }, { dev: false });
    expect(result.ok).toBe(false);
  });

  it('turns on the required spam check only for the exact value "true"', () => {
    const on = readIntakeConfig({ ...production, TURNSTILE_REQUIRED: 'true' }, { dev: false });
    const off = readIntakeConfig({ ...production, TURNSTILE_REQUIRED: 'yes' }, { dev: false });
    expect(on.ok && on.config.turnstile.required).toBe(true);
    expect(off.ok && off.config.turnstile.required).toBe(false);
  });
});

describe('redaction', () => {
  it('shortens an email address to its first letter and top-level domain', () => {
    expect(redactEmail('dana.rivera@example.test')).toBe('d***@***.test');
    expect(redactEmail('not an address')).toBe('***');
  });

  it('keeps the last two digits of a phone number', () => {
    expect(redactPhone('(561) 555-0142')).toBe('***42');
    expect(redactPhone('')).toBe('***');
  });

  it('keeps the first letter of a name', () => {
    expect(redactName(' Dana Rivera')).toBe('D.');
  });
});
