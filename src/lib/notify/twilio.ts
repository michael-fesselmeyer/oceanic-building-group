// Sends a text message through Twilio's REST API with a plain fetch (no SDK),
// so it runs in a Cloudflare Worker. Only used when SMS is switched on; see
// docs/architecture.md#sms for the switch and its cost.
// https://www.twilio.com/docs/messaging/api/message-resource
import type { SmsTransport } from './sms';
import type { SendResult } from './types';

export interface TwilioOptions {
  accountSid: string;
  authToken: string;
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function twilioMessagesUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
}

/** Maps Twilio's answer to a result. Its error body is `{ status, message, code, more_info }`. */
async function toResult(response: Response): Promise<SendResult> {
  if (response.ok) return { ok: true };
  let code = '';
  try {
    const body = (await response.json()) as { code?: unknown };
    if (typeof body.code === 'number' || typeof body.code === 'string') code = String(body.code);
  } catch {
    // No JSON body; the status code is enough.
  }
  const detail = code ? `twilio ${code}` : `http ${response.status}`;
  if (response.status === 429) return { ok: false, reason: 'rate-limited', detail };
  if (response.status >= 500) return { ok: false, reason: 'unavailable', detail };
  return { ok: false, reason: 'rejected', detail };
}

/**
 * No retry: a text that may have gone out once is not worth a second charge
 * or a duplicate on the office phone, and the email carries the lead anyway.
 */
export function twilioTransport({
  accountSid,
  authToken,
  from,
  fetch: fetcher = fetch,
  timeoutMs = 8000,
}: TwilioOptions): SmsTransport {
  const authorization = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
  return {
    name: 'twilio',
    async send(to, body) {
      try {
        const response = await fetcher(twilioMessagesUrl(accountSid), {
          method: 'POST',
          headers: { Authorization: authorization },
          body: new URLSearchParams({ To: to, From: from, Body: body }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return await toResult(response);
      } catch {
        return { ok: false, reason: 'unavailable', detail: 'network' };
      }
    },
  };
}
