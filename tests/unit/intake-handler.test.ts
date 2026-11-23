import { describe, expect, it, vi } from 'vitest';
import { messages, notices, townChoices } from '../../src/lib/intake';
import { readIntakeConfig } from '../../src/lib/intake-config';
import {
  MAX_BODY_BYTES,
  createIntakeSetup,
  handleIntake,
  type IntakeDeps,
} from '../../src/lib/intake-handler';
import {
  createNotifier,
  emailChannel,
  type EmailTransport,
  type SendResult,
} from '../../src/lib/notify';
import type { EmailMessage } from '../../src/lib/notify/email';
import { TEST_KEYS, type TurnstileResult } from '../../src/lib/turnstile';

const visitor = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  projectType: 'custom-home',
  message: 'A four bedroom home on a corner lot, starting next spring.',
};
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

function post(fields: Record<string, string>, init: RequestInit = {}) {
  return new Request('https://site.example.test/api/intake/', {
    method: 'POST',
    body: new URLSearchParams(fields),
    ...init,
  });
}

/** A transport that records what it was asked to send and answers as told. */
function fakeTransport(answer: SendResult = { ok: true }) {
  const sent: EmailMessage[] = [];
  const transport: EmailTransport = {
    name: 'fake',
    async send(message) {
      sent.push(message);
      return answer;
    },
  };
  return { transport, sent };
}

function fakeLogger() {
  const lines: string[] = [];
  const record = (line: string) => void lines.push(line);
  return { logger: { info: record, warn: record, error: record }, lines };
}

function setup({
  answer,
  turnstile = { success: true },
  required = false,
}: {
  answer?: SendResult;
  turnstile?: TurnstileResult;
  required?: boolean;
} = {}) {
  const { transport, sent } = fakeTransport(answer);
  const { logger, lines } = fakeLogger();
  const config = readIntakeConfig(
    {
      EMAIL_TRANSPORT: 'log',
      LEAD_NOTIFICATION_EMAIL: 'office@example.test',
      LEAD_FROM_EMAIL: 'website@example.test',
      TURNSTILE_SECRET_KEY: TEST_KEYS.secretAlwaysPasses,
      TURNSTILE_REQUIRED: required ? 'true' : undefined,
    },
    { dev: false },
  );
  const notifier = createNotifier(
    [emailChannel({ transport, from: 'website@example.test', to: ['office@example.test'] })],
    logger,
  );
  const verify = vi.fn(async () => turnstile);
  const deps: IntakeDeps = { setup: { config, notifier }, logger, verify };
  return { deps, sent, lines, verify };
}

/** Nothing personal may reach a log line. */
function expectNoPersonalData(lines: string[]) {
  const text = lines.join('\n');
  expect(text).not.toContain(visitor.email);
  expect(text).not.toContain('555-0142');
  expect(text).not.toContain(visitor.message);
  expect(text).not.toContain(visitor.name);
  expect(text).not.toContain('office@example.test');
}

describe('handleIntake', () => {
  it('sends a valid submission to the office and logs only a redacted summary', async () => {
    const { deps, sent, lines, verify } = setup();
    const outcome = await handleIntake(
      post(
        { ...visitor, 'cf-turnstile-response': TOKEN },
        { headers: { 'CF-Connecting-IP': '192.0.2.1' } },
      ),
      deps,
    );

    expect(outcome).toEqual({ kind: 'sent' });
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: TEST_KEYS.secretAlwaysPasses,
        token: TOKEN,
        remoteIp: '192.0.2.1',
      }),
    );
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email!.to).toEqual(['office@example.test']);
    expect(email!.replyTo).toBe(visitor.email);
    expect(email!.subject).toBe('New enquiry: Custom home from Dana Rivera');
    expect(email!.text).toContain(visitor.message);
    expect(email!.text).toContain('Phone: (561) 555-0142');
    expect(email!.text).toContain('Spam check: passed.');
    expect(
      lines.some((line) => line.includes('[intake] sent: D., d***@***.test, phone ***42')),
    ).toBe(true);
    expectNoPersonalData(lines);
  });

  it('gives identical submissions the same idempotency key, so a resend is delivered once', async () => {
    const { deps, sent } = setup();
    const fields = { ...visitor, 'cf-turnstile-response': TOKEN };
    await handleIntake(post(fields), deps);
    await handleIntake(post(fields), deps);
    await handleIntake(post({ ...fields, message: `${visitor.message} Thanks.` }), deps);

    expect(sent[0]!.idempotencyKey).toMatch(/^lead-[0-9a-f]{40}$/);
    expect(sent[1]!.idempotencyKey).toBe(sent[0]!.idempotencyKey);
    expect(sent[2]!.idempotencyKey).not.toBe(sent[0]!.idempotencyKey);
  });

  it('sends the follow-up answers for the chosen type and logs only which were answered', async () => {
    const { deps, sent, lines } = setup();
    deps.towns = townChoices([{ id: 'harbor-point', data: { name: 'Harbor Point' } }]);
    const fields = {
      ...visitor,
      town: 'harbor-point',
      lot: 'yes',
      building: 'Corner shop with flats above',
      'cf-turnstile-response': TOKEN,
    };
    expect(await handleIntake(post(fields), deps)).toEqual({ kind: 'sent' });

    const [email] = sent;
    expect(email!.text).toContain('About the project:\nWhere: Harbor Point\nOwns the lot: Yes\n');
    // The building question belongs to commercial projects, not custom homes.
    expect(email!.text).not.toContain('Corner shop');
    expect(lines.some((line) => line.endsWith('spam check passed, follow-ups town lot'))).toBe(
      true,
    );
    expect(lines.join('\n')).not.toContain('Harbor Point');

    // Different follow-up answers are a different enquiry, not a resend.
    await handleIntake(post({ ...fields, lot: 'looking' }), deps);
    expect(sent[1]!.idempotencyKey).not.toBe(email!.idempotencyKey);
  });

  it('keeps the follow-up answers when the form comes back', async () => {
    const { deps } = setup();
    const outcome = await handleIntake(
      post({ ...visitor, message: 'Too short', start: 'later', plans: 'not-yet' }),
      deps,
    );
    expect(outcome).toMatchObject({
      kind: 'invalid',
      values: { start: 'later', plans: 'not-yet' },
    });
  });

  it('returns invalid fields with their messages and keeps what was typed', async () => {
    const { deps, sent, verify } = setup();
    const outcome = await handleIntake(
      post({
        ...visitor,
        email: 'not-an-address',
        message: 'Too short',
        'cf-turnstile-response': TOKEN,
      }),
      deps,
    );

    expect(outcome).toEqual({
      kind: 'invalid',
      values: { ...visitor, email: 'not-an-address', message: 'Too short' },
      errors: { email: messages.emailInvalid, message: messages.messageTooShort },
    });
    expect(verify).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('reports every missing required field', async () => {
    const { deps } = setup();
    const outcome = await handleIntake(post({}), deps);
    expect(outcome.kind).toBe('invalid');
    if (outcome.kind !== 'invalid') return;
    expect(Object.keys(outcome.errors).sort()).toEqual(['email', 'message', 'name', 'projectType']);
  });

  it('drops a submission with the spam trap filled, without checking or sending it', async () => {
    const { deps, sent, verify } = setup();
    const outcome = await handleIntake(
      post({ ...visitor, website: 'https://spam.example.test', 'cf-turnstile-response': TOKEN }),
      deps,
    );

    expect(outcome).toEqual({ kind: 'dropped' });
    expect(verify).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('refuses a submission whose spam-check token does not pass', async () => {
    const { deps, sent } = setup({
      turnstile: { success: false, errorCodes: ['invalid-input-response'] },
    });
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);

    expect(outcome).toEqual({
      kind: 'spam-check-failed',
      values: visitor,
      notice: 'spamCheckFailed',
    });
    expect(sent).toHaveLength(0);
  });

  it('treats a spent token like a failed one, so the visitor gets a fresh check', async () => {
    const { deps } = setup({ turnstile: { success: false, errorCodes: ['timeout-or-duplicate'] } });
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);
    expect(outcome.kind).toBe('spam-check-failed');
  });

  it('says the form is unavailable when the spam check itself cannot run', async () => {
    const { deps, sent, lines } = setup({
      turnstile: { success: false, errorCodes: ['unreachable'] },
    });
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);

    expect(outcome).toEqual({ kind: 'unavailable', values: visitor, notice: 'unavailable' });
    expect(sent).toHaveLength(0);
    expect(lines).toContain('[intake] spam check unavailable: unreachable');
  });

  it('sends a submission without a token (no JavaScript) flagged as unchecked', async () => {
    const { deps, sent, verify } = setup();
    const outcome = await handleIntake(post(visitor), deps);

    expect(outcome).toEqual({ kind: 'sent' });
    expect(verify).not.toHaveBeenCalled();
    expect(sent[0]!.subject).toBe('New enquiry: Custom home from Dana Rivera [spam check not run]');
    expect(sent[0]!.text).toContain('Spam check: not run');
  });

  it('refuses a submission without a token when the spam check is required', async () => {
    const { deps, sent } = setup({ required: true });
    const outcome = await handleIntake(post(visitor), deps);

    expect(outcome).toEqual({
      kind: 'spam-check-failed',
      values: visitor,
      notice: 'spamCheckNeedsScript',
    });
    expect(sent).toHaveLength(0);
  });

  it('keeps what was typed when the email cannot be sent', async () => {
    const { deps, lines } = setup({
      answer: { ok: false, reason: 'unavailable', detail: 'network' },
    });
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);

    expect(outcome).toEqual({ kind: 'unavailable', values: visitor, notice: 'unavailable' });
    expect(lines).toContain('[intake] email failed: unavailable (network)');
    expectNoPersonalData(lines);
  });

  it('keeps what was typed when the provider quota is used up', async () => {
    const { deps, lines } = setup({
      answer: { ok: false, reason: 'quota', detail: 'daily_quota_exceeded' },
    });
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);

    expect(outcome.kind).toBe('unavailable');
    expect(lines).toContain('[intake] email failed: quota (daily_quota_exceeded)');
  });

  it('treats a transport that throws as an outage', async () => {
    const { deps } = setup();
    const { logger } = fakeLogger();
    deps.setup.notifier = createNotifier(
      [
        emailChannel({
          transport: {
            name: 'broken',
            send: () => Promise.reject(new Error('boom')),
          },
          from: 'website@example.test',
          to: ['office@example.test'],
        }),
      ],
      logger,
    );
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);
    expect(outcome.kind).toBe('unavailable');
  });

  it('says the form is unavailable when settings are missing, naming only the variables', async () => {
    const { logger, lines } = fakeLogger();
    const deps: IntakeDeps = {
      setup: createIntakeSetup(
        { LEAD_NOTIFICATION_EMAIL: 'office@example.test' },
        { dev: false, logger },
      ),
      logger,
    };
    const outcome = await handleIntake(post({ ...visitor, 'cf-turnstile-response': TOKEN }), deps);

    expect(outcome.kind).toBe('unavailable');
    expect(lines).toEqual([
      '[intake] not configured: TURNSTILE_SECRET_KEY is not set; RESEND_API_KEY is not set; LEAD_FROM_EMAIL is not set',
    ]);
  });

  it('accepts multipart form data', async () => {
    const { deps, sent } = setup();
    const body = new FormData();
    for (const [key, value] of Object.entries({ ...visitor, 'cf-turnstile-response': TOKEN })) {
      body.set(key, value);
    }
    const outcome = await handleIntake(
      new Request('https://site.example.test/api/intake/', { method: 'POST', body }),
      deps,
    );
    expect(outcome).toEqual({ kind: 'sent' });
    expect(sent).toHaveLength(1);
  });

  it('uses the first value when a field is repeated', async () => {
    const { deps, sent } = setup();
    const body = new URLSearchParams({ ...visitor, 'cf-turnstile-response': TOKEN });
    body.append('name', 'Someone Else');
    await handleIntake(
      new Request('https://site.example.test/api/intake/', { method: 'POST', body }),
      deps,
    );
    expect(sent[0]!.subject).toContain('Dana Rivera');
  });

  it('refuses a body that is not form data', async () => {
    const { deps, sent } = setup();
    const outcome = await handleIntake(
      new Request('https://site.example.test/api/intake/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitor),
      }),
      deps,
    );
    expect(outcome).toMatchObject({ kind: 'bad-request', status: 415 });
    expect(sent).toHaveLength(0);
  });

  it('refuses a body with no content type', async () => {
    const { deps } = setup();
    const outcome = await handleIntake(
      new Request('https://site.example.test/api/intake/', {
        method: 'POST',
        body: new Uint8Array(4),
      }),
      deps,
    );
    expect(outcome).toMatchObject({ kind: 'bad-request', status: 415 });
  });

  it('refuses an oversized body that declares its length, without reading it', async () => {
    const { deps } = setup();
    const request = post(visitor, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(MAX_BODY_BYTES + 1),
      },
    });
    const outcome = await handleIntake(request, deps);
    expect(outcome).toMatchObject({ kind: 'bad-request', status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it('stops reading an oversized body that does not declare its length', async () => {
    const { deps, sent } = setup();
    const chunk = new TextEncoder().encode('message='.padEnd(16 * 1024, 'a'));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const outcome = await handleIntake(
      new Request('https://site.example.test/api/intake/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: stream,
        duplex: 'half',
      } as RequestInit),
      deps,
    );
    expect(outcome).toMatchObject({ kind: 'bad-request', status: 413 });
    expect(pulled).toBeLessThanOrEqual(6);
    expect(sent).toHaveLength(0);
  });

  it('refuses a multipart body it cannot read', async () => {
    const { deps } = setup();
    const outcome = await handleIntake(
      post(visitor, { headers: { 'Content-Type': 'multipart/form-data; boundary=nothing-here' } }),
      deps,
    );
    expect(outcome).toMatchObject({ kind: 'bad-request', status: 400 });
  });

  it('has a notice for every outcome that shows the form again', () => {
    expect(Object.keys(notices).sort()).toEqual([
      'spamCheckFailed',
      'spamCheckNeedsScript',
      'unavailable',
    ]);
  });
});
