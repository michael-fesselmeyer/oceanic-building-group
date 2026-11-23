// What the intake endpoint does with a submission, kept apart from the route
// (src/pages/api/intake.astro) so it can be tested without a server. It reads
// the body within a size limit, drops honeypot posts, validates with the
// shared schema, checks the Turnstile token and hands the lead to the
// notifier. The route turns the outcome into a redirect or a page.
import {
  isHoneypotFilled,
  parseIntake,
  type Intake,
  type IntakeField,
  type Notice,
} from './intake';
import { readIntakeConfig, type IntakeConfigResult, type IntakeEnv } from './intake-config';
import {
  createLeadNotifier,
  summarizeLead,
  type Logger,
  type Notifier,
  type SpamCheck,
} from './notify';
import { TURNSTILE_FIELD, isServiceFailure, verifyTurnstile } from './turnstile';

/**
 * Largest body accepted, in bytes. The longest legitimate form, with every
 * character of the message a three-byte one and percent-encoded, plus a
 * spam-check token, is about 35 KB.
 */
export const MAX_BODY_BYTES = 64 * 1024;

const FORM_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);
const FIELDS: IntakeField[] = ['name', 'email', 'phone', 'projectType', 'message'];

/** What the visitor typed, to put back in the form when it is shown again. */
export type FormValues = Partial<Record<IntakeField, string>>;

export type IntakeOutcome =
  /** The office was notified. */
  | { kind: 'sent' }
  /** The honeypot was filled. Answered like a success so the sender learns nothing. */
  | { kind: 'dropped' }
  | { kind: 'invalid'; values: FormValues; errors: Partial<Record<IntakeField, string>> }
  | { kind: 'spam-check-failed'; values: FormValues; notice: Notice }
  | { kind: 'unavailable'; values: FormValues; notice: Notice }
  /** Not a form a browser would send: too large, wrong type or unreadable. */
  | { kind: 'bad-request'; status: 400 | 413 | 415; message: string };

export interface IntakeSetup {
  config: IntakeConfigResult;
  notifier?: Notifier;
}

/** Reads the settings and builds the notifier from them. */
export function createIntakeSetup(
  env: IntakeEnv,
  options: { dev: boolean; logger: Logger; fetch?: typeof fetch },
): IntakeSetup {
  const config = readIntakeConfig(env, { dev: options.dev });
  if (!config.ok) return { config };
  for (const warning of config.warnings) options.logger.warn(`[intake] ${warning}`);
  return { config, notifier: createLeadNotifier(config.config, options) };
}

export interface IntakeDeps {
  /** Settings, and the notifier built from them (absent when the settings have problems). */
  setup: IntakeSetup;
  logger: Logger;
  verify?: typeof verifyTurnstile;
  fetch?: typeof fetch;
}

/** Reads at most `limit` bytes; `null` if the body is longer. */
async function readLimited(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The first text value of each field. Files and repeated names are ignored. */
async function readFields(
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
  mediaType: string,
): Promise<Record<string, string> | null> {
  const fields: Record<string, string> = {};
  const keep = (key: string, value: unknown) => {
    if (typeof value === 'string' && !(key in fields)) fields[key] = value;
  };

  if (mediaType === 'application/x-www-form-urlencoded') {
    for (const [key, value] of new URLSearchParams(new TextDecoder().decode(body)))
      keep(key, value);
    return fields;
  }
  try {
    const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
    for (const [key, value] of form) keep(key, value);
    return fields;
  } catch {
    return null;
  }
}

/** A key that is the same for identical submissions, for the provider's idempotency check. */
export async function leadKey(intake: Intake): Promise<string> {
  const text = JSON.stringify([
    intake.name,
    intake.email.toLowerCase(),
    intake.phone ?? '',
    intake.projectType,
    intake.message,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0'));
  return `lead-${hex.join('').slice(0, 40)}`;
}

export async function handleIntake(request: Request, deps: IntakeDeps): Promise<IntakeOutcome> {
  const { setup, logger, verify = verifyTurnstile } = deps;

  const contentType = request.headers.get('Content-Type') ?? '';
  const mediaType = contentType.split(';')[0]!.trim().toLowerCase();
  if (!FORM_TYPES.has(mediaType)) {
    return { kind: 'bad-request', status: 415, message: 'Send the form as form data.' };
  }

  const declared = Number(request.headers.get('Content-Length'));
  const body = declared > MAX_BODY_BYTES ? null : await readLimited(request, MAX_BODY_BYTES);
  if (!body) return { kind: 'bad-request', status: 413, message: 'The form is too large.' };

  const fields = await readFields(body, contentType, mediaType);
  if (!fields) return { kind: 'bad-request', status: 400, message: 'The form could not be read.' };

  if (isHoneypotFilled(fields)) {
    logger.info('[intake] dropped: spam trap filled');
    return { kind: 'dropped' };
  }

  const values: FormValues = {};
  for (const field of FIELDS) {
    if (fields[field] !== undefined) values[field] = fields[field];
  }

  const parsed = parseIntake(values);
  if (!parsed.success) {
    logger.info(`[intake] invalid: ${Object.keys(parsed.errors).join(', ')}`);
    return { kind: 'invalid', values, errors: parsed.errors };
  }

  if (!setup.config.ok || !setup.notifier) {
    const problems = setup.config.ok ? ['no notifier'] : setup.config.problems;
    logger.error(`[intake] not configured: ${problems.join('; ')}`);
    return { kind: 'unavailable', values, notice: 'unavailable' };
  }
  const { turnstile } = setup.config.config;

  let spamCheck: SpamCheck;
  const token = fields[TURNSTILE_FIELD]?.trim() ?? '';
  if (!token) {
    // Without JavaScript the widget never runs, so there is no token. The
    // honeypot is then the only check, and the email says so in its subject.
    if (turnstile.required) {
      logger.info('[intake] refused: no spam-check token');
      return { kind: 'spam-check-failed', values, notice: 'spamCheckNeedsScript' };
    }
    spamCheck = 'not-run';
  } else {
    const remoteIp = request.headers.get('CF-Connecting-IP') ?? undefined;
    const result = await verify({ secret: turnstile.secret, token, remoteIp, fetch: deps.fetch });
    if (!result.success) {
      const codes = result.errorCodes.join(', ');
      if (isServiceFailure(result.errorCodes)) {
        logger.error(`[intake] spam check unavailable: ${codes}`);
        return { kind: 'unavailable', values, notice: 'unavailable' };
      }
      logger.info(`[intake] refused: spam check failed (${codes})`);
      return { kind: 'spam-check-failed', values, notice: 'spamCheckFailed' };
    }
    spamCheck = 'passed';
  }

  const lead = { intake: parsed.data, spamCheck, key: await leadKey(parsed.data) };
  const result = await setup.notifier.notify(lead);
  if (!result.delivered) return { kind: 'unavailable', values, notice: 'unavailable' };

  logger.info(`[intake] sent: ${summarizeLead(lead)}`);
  return { kind: 'sent' };
}
