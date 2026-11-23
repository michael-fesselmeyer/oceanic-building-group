// Reads the intake endpoint's settings from environment variables. Values
// come from the git-ignored .dev.vars file locally and from encrypted Worker
// settings in production; .env.example lists the names. Problems are reported
// by variable name only, never with a value.
import { z } from 'astro/zod';
import { TEST_KEYS } from './turnstile';

/** Every variable the endpoint reads. */
export const INTAKE_ENV_NAMES = [
  'EMAIL_TRANSPORT',
  'RESEND_API_KEY',
  'LEAD_FROM_EMAIL',
  'LEAD_NOTIFICATION_EMAIL',
  'TURNSTILE_SECRET_KEY',
  'TURNSTILE_REQUIRED',
] as const;

export type IntakeEnv = Partial<Record<(typeof INTAKE_ENV_NAMES)[number], string | undefined>>;

export type EmailConfig =
  | { transport: 'resend'; apiKey: string; from: string; to: string[] }
  | { transport: 'log'; from: string; to: string[] };

export interface IntakeConfig {
  turnstile: {
    secret: string;
    /** When true, a post without a spam-check token is refused instead of sent flagged. */
    required: boolean;
  };
  email: EmailConfig;
}

export type IntakeConfigResult =
  { ok: true; config: IntakeConfig } | { ok: false; problems: string[] };

const address = z.email();

/** `a@example.test, b@example.test` becomes two addresses; `null` if any is not valid. */
function parseRecipients(value: string): string[] | null {
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.every((item) => address.safeParse(item).success) ? list : null;
}

/**
 * Turns the environment into settings. `dev` (the development server) fills
 * in safe defaults: the log transport and Cloudflare's always-pass test
 * secret. A built site gets no defaults, so a missing secret in production
 * stops the form with a logged problem instead of sending nothing silently.
 */
export function readIntakeConfig(env: IntakeEnv, { dev }: { dev: boolean }): IntakeConfigResult {
  const problems: string[] = [];
  const value = (name: keyof IntakeEnv) => env[name]?.trim() || undefined;

  const secret = value('TURNSTILE_SECRET_KEY') ?? (dev ? TEST_KEYS.secretAlwaysPasses : undefined);
  if (!secret) problems.push('TURNSTILE_SECRET_KEY is not set');

  const transport = value('EMAIL_TRANSPORT') ?? (dev ? 'log' : 'resend');
  if (transport !== 'resend' && transport !== 'log') {
    problems.push('EMAIL_TRANSPORT must be "resend" or "log"');
  }

  const recipients = value('LEAD_NOTIFICATION_EMAIL');
  const to = recipients ? parseRecipients(recipients) : [];
  if (to === null) problems.push('LEAD_NOTIFICATION_EMAIL holds an address that is not valid');

  const from = value('LEAD_FROM_EMAIL');
  const apiKey = value('RESEND_API_KEY');
  if (transport === 'resend') {
    if (!apiKey) problems.push('RESEND_API_KEY is not set');
    if (!from) problems.push('LEAD_FROM_EMAIL is not set');
    if (!recipients) problems.push('LEAD_NOTIFICATION_EMAIL is not set');
  }

  if (problems.length > 0 || !secret || to === null) return { ok: false, problems };

  const email: EmailConfig =
    transport === 'resend'
      ? { transport, apiKey: apiKey!, from: from!, to }
      : { transport: 'log', from: from ?? 'website@example.test', to };

  return {
    ok: true,
    config: {
      turnstile: { secret, required: value('TURNSTILE_REQUIRED') === 'true' },
      email,
    },
  };
}
