// Sends email through Resend's HTTPS API with a plain fetch (no SDK), so it
// runs in a Cloudflare Worker. Why Resend: docs/adr/0002-lead-email-transport.md.
// https://resend.com/docs/api-reference/emails/send-email
import type { EmailMessage, EmailTransport } from './email';
import type { SendResult } from './types';

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface ResendOptions {
  apiKey: string;
  fetch?: typeof fetch;
  /** Gives up on one attempt after this long, in milliseconds. */
  timeoutMs?: number;
}

/** Maps Resend's answer to a result. Error names come from its errors page. */
async function toResult(response: Response): Promise<SendResult> {
  if (response.ok) return { ok: true };

  let name = '';
  try {
    const body = (await response.json()) as { name?: unknown };
    if (typeof body.name === 'string') name = body.name;
  } catch {
    // No JSON body; the status code is enough.
  }
  const detail = name || `http ${response.status}`;

  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded') {
    return { ok: false, reason: 'quota', detail };
  }
  // A twin request with the same idempotency key is already being sent, which
  // happens on a double click. That one delivers the lead.
  if (name === 'concurrent_idempotent_requests') return { ok: true };
  if (response.status === 429) return { ok: false, reason: 'rate-limited', detail };
  if (response.status >= 500) return { ok: false, reason: 'unavailable', detail };
  return { ok: false, reason: 'rejected', detail };
}

export function resendTransport({
  apiKey,
  fetch: fetcher = fetch,
  timeoutMs = 8000,
}: ResendOptions): EmailTransport {
  async function attempt(message: EmailMessage): Promise<SendResult> {
    try {
      const response = await fetcher(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          reply_to: message.replyTo,
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await toResult(response);
    } catch {
      return { ok: false, reason: 'unavailable', detail: 'network' };
    }
  }

  return {
    name: 'resend',
    async send(message) {
      const first = await attempt(message);
      // One retry for a passing problem. The idempotency key makes it safe:
      // if the first attempt did get through, the retry sends nothing new.
      if (!first.ok && (first.reason === 'unavailable' || first.reason === 'rate-limited')) {
        return attempt(message);
      }
      return first;
    },
  };
}
