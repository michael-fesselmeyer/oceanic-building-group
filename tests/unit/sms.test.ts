// The SMS channel and its switch. All numbers are fictional 555-01xx numbers
// and all credentials are obvious fakes; nothing here reaches Twilio.
import { describe, expect, it, vi } from 'vitest';
import type { Intake } from '../../src/lib/intake';
import { readIntakeConfig, readSmsConfig } from '../../src/lib/intake-config';
import { createIntakeSetup } from '../../src/lib/intake-handler';
import {
  createNotifier,
  emailChannel,
  formatLeadText,
  smsChannel,
  type EmailTransport,
  type Lead,
  type SendResult,
  type SmsTransport,
} from '../../src/lib/notify';
import { leadChannels } from '../../src/lib/notify/index';
import { twilioMessagesUrl, twilioTransport } from '../../src/lib/notify/twilio';

const intake: Intake = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  projectType: 'commercial',
  message: 'An office build-out on the second floor.',
};
const lead: Lead = { intake, spamCheck: 'passed', key: 'lead-test-1' };

const OFFICE = '+15615550101';
const MOBILE = '+15615550102';
const smsOn = {
  SMS_ENABLED: 'true',
  TWILIO_ACCOUNT_SID: 'test-sid',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_FROM_NUMBER: '+15615550100',
  LEAD_NOTIFICATION_PHONE: `${OFFICE}, ${MOBILE}`,
};
const emailOnly = {
  EMAIL_TRANSPORT: 'log',
  LEAD_NOTIFICATION_EMAIL: 'office@example.test',
  TURNSTILE_SECRET_KEY: 'test-secret',
};

function fakeLogger() {
  const lines: string[] = [];
  const record = (line: string) => void lines.push(line);
  return { logger: { info: record, warn: record, error: record }, lines };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('the SMS switch', () => {
  it('is off when SMS_ENABLED is unset, and reads no other SMS variable', () => {
    const env = new Proxy({} as Record<string, string | undefined>, {
      get(_target, name) {
        if (name !== 'SMS_ENABLED') throw new Error(`read ${String(name)}`);
        return undefined;
      },
    });
    expect(readSmsConfig(env)).toEqual({ sms: null, warnings: [] });
  });

  it('is off for any value other than "true", even with every variable set', () => {
    for (const value of ['', 'false', 'yes', '1', 'TRUE ']) {
      expect(readSmsConfig({ ...smsOn, SMS_ENABLED: value }).sms).toBeNull();
    }
  });

  it('needs no SMS variable for the form to work', () => {
    const result = readIntakeConfig(emailOnly, { dev: false });
    expect(result).toMatchObject({ ok: true, warnings: [], config: { sms: null } });
  });

  it('reads complete settings when switched on', () => {
    expect(readSmsConfig(smsOn)).toEqual({
      sms: {
        accountSid: 'test-sid',
        authToken: 'test-token',
        from: '+15615550100',
        to: [OFFICE, MOBILE],
      },
      warnings: [],
    });
  });

  it('stays off with a warning naming the missing variables, without stopping the form', () => {
    const result = readIntakeConfig(
      { ...emailOnly, SMS_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'test-sid' },
      { dev: false },
    );
    expect(result).toMatchObject({
      ok: true,
      config: { sms: null },
      warnings: [
        'SMS is off: TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, LEAD_NOTIFICATION_PHONE not set',
      ],
    });
  });

  it('stays off for numbers not in international form, without repeating them', () => {
    const { sms, warnings } = readSmsConfig({
      ...smsOn,
      TWILIO_FROM_NUMBER: '561-555-0100',
      LEAD_NOTIFICATION_PHONE: '(561) 555-0101',
    });
    expect(sms).toBeNull();
    expect(warnings).toHaveLength(2);
    expect(warnings.join(' ')).not.toMatch(/555/);
  });

  it('logs the warning when the endpoint is set up', () => {
    const { logger, lines } = fakeLogger();
    createIntakeSetup({ ...emailOnly, SMS_ENABLED: 'true' }, { dev: false, logger });
    expect(lines).toEqual([
      '[intake] SMS is off: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, LEAD_NOTIFICATION_PHONE not set',
    ]);
  });
});

describe('channel selection', () => {
  const channelsFor = (env: Record<string, string>) => {
    const result = readIntakeConfig(env, { dev: false });
    if (!result.ok) throw new Error('expected settings');
    const { logger } = fakeLogger();
    return leadChannels(result.config, { logger }).map(({ name, required }) => ({
      name,
      required,
    }));
  };

  it('uses email alone by default', () => {
    expect(channelsFor(emailOnly)).toEqual([{ name: 'email', required: true }]);
  });

  it('adds SMS as an optional channel when switched on', () => {
    expect(channelsFor({ ...emailOnly, ...smsOn })).toEqual([
      { name: 'email', required: true },
      { name: 'sms', required: false },
    ]);
  });
});

describe('formatLeadText', () => {
  it('names the project type and nothing personal', () => {
    const text = formatLeadText(lead);
    expect(text).toBe('New website enquiry: Commercial. The details are in the office email.');
    for (const value of Object.values(intake)) expect(text).not.toContain(value);
  });

  it('says when the spam check did not run', () => {
    expect(formatLeadText({ ...lead, spamCheck: 'not-run' })).toMatch(/Spam check not run\.$/);
  });
});

describe('smsChannel', () => {
  const transport = (answers: Record<string, SendResult>) => {
    const sent: { to: string; body: string }[] = [];
    const fake: SmsTransport = {
      name: 'fake',
      async send(to, body) {
        sent.push({ to, body });
        return answers[to] ?? { ok: true };
      },
    };
    return { fake, sent };
  };

  it('texts every number', async () => {
    const { fake, sent } = transport({});
    const result = await smsChannel({ transport: fake, to: [OFFICE, MOBILE] }).send(lead);
    expect(result).toEqual({ ok: true });
    expect(sent.map((message) => message.to)).toEqual([OFFICE, MOBILE]);
  });

  it('reports a failed number by count and code, never by number', async () => {
    const { fake, sent } = transport({
      [MOBILE]: { ok: false, reason: 'rejected', detail: 'twilio 21610' },
    });
    const result = await smsChannel({ transport: fake, to: [OFFICE, MOBILE] }).send(lead);
    expect(result).toEqual({
      ok: false,
      reason: 'rejected',
      detail: '1 of 2 numbers: twilio 21610',
    });
    expect(sent).toHaveLength(2);
  });
});

describe('one failing channel does not stop the others', () => {
  const emailTransport = (answer: SendResult) => {
    const send = vi.fn(async () => answer);
    return { transport: { name: 'fake-email', send } as EmailTransport, send };
  };
  const smsTransport = (answer: SendResult) => {
    const send = vi.fn(async () => answer);
    return { transport: { name: 'fake-sms', send } as SmsTransport, send };
  };
  const build = (email: SendResult, sms: SendResult) => {
    const { logger, lines } = fakeLogger();
    const e = emailTransport(email);
    const t = smsTransport(sms);
    const notifier = createNotifier(
      [
        emailChannel({
          transport: e.transport,
          from: 'website@example.test',
          to: ['office@example.test'],
        }),
        smsChannel({ transport: t.transport, to: [OFFICE] }),
      ],
      logger,
    );
    return { notifier, lines, email: e.send, sms: t.send };
  };

  it('delivers by email when the text fails, and logs the text failure without the number', async () => {
    const { notifier, lines, email } = build(
      { ok: true },
      { ok: false, reason: 'unavailable', detail: 'network' },
    );
    const result = await notifier.notify(lead);

    expect(result.delivered).toBe(true);
    expect(email).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(['[intake] sms failed: unavailable (1 of 1 numbers: network)']);
    expect(lines.join('\n')).not.toMatch(/555/);
  });

  it('still sends the text when the email fails, but the enquiry is not delivered', async () => {
    const { notifier, sms } = build(
      { ok: false, reason: 'quota', detail: 'daily_quota_exceeded' },
      { ok: true },
    );
    const result = await notifier.notify(lead);

    expect(sms).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(false);
    expect(result.failures).toEqual([
      { channel: 'email', required: true, reason: 'quota', detail: 'daily_quota_exceeded' },
    ]);
  });

  it('keeps sending by email when the text channel throws', async () => {
    const { logger } = fakeLogger();
    const notifier = createNotifier(
      [
        emailChannel({
          transport: emailTransport({ ok: true }).transport,
          from: 'website@example.test',
          to: ['office@example.test'],
        }),
        smsChannel({
          transport: { name: 'broken', send: () => Promise.reject(new Error('boom')) },
          to: [OFFICE],
        }),
      ],
      logger,
    );
    expect((await notifier.notify(lead)).delivered).toBe(true);
  });
});

describe('twilioTransport', () => {
  const options = { accountSid: 'test-sid', authToken: 'test-token', from: '+15615550100' };

  it('posts the message with basic authentication', async () => {
    const fetcher = vi.fn(async () => json(201, { sid: 'test-message' }));
    const result = await twilioTransport({ ...options, fetch: fetcher }).send(OFFICE, 'Hello');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(twilioMessagesUrl('test-sid'));
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/test-sid/Messages.json');
    expect(init.headers).toEqual({ Authorization: `Basic ${btoa('test-sid:test-token')}` });
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      To: OFFICE,
      From: '+15615550100',
      Body: 'Hello',
    });
  });

  it('reports a refused message with Twilio’s code and does not retry', async () => {
    const fetcher = vi.fn(async () =>
      json(400, { status: 400, code: 21211, message: 'Invalid To number' }),
    );
    const result = await twilioTransport({ ...options, fetch: fetcher }).send(OFFICE, 'Hello');
    expect(result).toEqual({ ok: false, reason: 'rejected', detail: 'twilio 21211' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('tells rate limits and outages apart', async () => {
    const limited = vi.fn(async () => json(429, { code: 20429 }));
    const down = vi.fn(async () => new Response('Bad gateway', { status: 502 }));
    const offline = vi.fn(async () => {
      throw new TypeError('network down');
    });
    expect(await twilioTransport({ ...options, fetch: limited }).send(OFFICE, 'x')).toEqual({
      ok: false,
      reason: 'rate-limited',
      detail: 'twilio 20429',
    });
    expect(await twilioTransport({ ...options, fetch: down }).send(OFFICE, 'x')).toEqual({
      ok: false,
      reason: 'unavailable',
      detail: 'http 502',
    });
    expect(await twilioTransport({ ...options, fetch: offline }).send(OFFICE, 'x')).toEqual({
      ok: false,
      reason: 'unavailable',
      detail: 'network',
    });
  });
});
