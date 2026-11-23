// Cloudflare Turnstile, the spam check on the intake form. The widget on the
// contact page adds a token to the form; the endpoint asks Cloudflare whether
// the token is genuine before anything is sent.
//
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

/** The hidden field the widget adds to the form. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's longest token. Anything longer is not a token. */
export const MAX_TOKEN_LENGTH = 2048;

/**
 * Cloudflare's published test keys. They work on any host, including
 * localhost, and are used in development and CI so no real key is needed.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TEST_KEYS = {
  siteAlwaysPasses: '1x00000000000000000000AA',
  siteAlwaysFails: '2x00000000000000000000AB',
  secretAlwaysPasses: '1x0000000000000000000000000000000AA',
  secretAlwaysFails: '2x0000000000000000000000000000000AA',
  secretTokenSpent: '3x0000000000000000000000000000000AA',
} as const;

export type TurnstileResult = { success: true } | { success: false; errorCodes: string[] };

export interface VerifyOptions {
  secret: string;
  token: string;
  /** The visitor's address, which helps Cloudflare judge the token. */
  remoteIp?: string;
  fetch?: typeof fetch;
  /** Gives up after this long, in milliseconds. */
  timeoutMs?: number;
}

/**
 * Asks Cloudflare whether a token is genuine. Never throws: a network
 * failure or an unexpected answer comes back as a failure with its own code,
 * so the caller can tell a rejected token from an unreachable service.
 */
export async function verifyTurnstile({
  secret,
  token,
  remoteIp,
  fetch: fetcher = fetch,
  timeoutMs = 5000,
}: VerifyOptions): Promise<TurnstileResult> {
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };
  if (token.length > MAX_TOKEN_LENGTH) {
    return { success: false, errorCodes: ['invalid-input-response'] };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const outcome = (await response.json()) as { success?: unknown; 'error-codes'?: unknown };
    if (outcome.success === true) return { success: true };
    const codes = Array.isArray(outcome['error-codes'])
      ? outcome['error-codes'].filter((code): code is string => typeof code === 'string')
      : [];
    return { success: false, errorCodes: codes.length > 0 ? codes : ['unknown'] };
  } catch {
    return { success: false, errorCodes: ['unreachable'] };
  }
}

/**
 * True when the failure is on Cloudflare's side or ours (bad secret, service
 * down) rather than a token that did not pass. The visitor is then told the
 * form cannot be sent right now instead of being treated as a program.
 */
export function isServiceFailure(errorCodes: string[]): boolean {
  const ours = new Set([
    'missing-input-secret',
    'invalid-input-secret',
    'internal-error',
    'unreachable',
    'unknown',
  ]);
  return errorCodes.some((code) => ours.has(code));
}
