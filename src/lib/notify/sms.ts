// The text message to the office: a short alert that an enquiry arrived.
// It carries no personal details (no name, address, phone number or
// message), so the visitor's data goes only through the email, and the text
// provider never sees it. The office reads the details in the email.
import { projectTypeLabel } from './email';
import type { Channel, Lead, SendResult } from './types';

export interface SmsTransport {
  /** Short name for logs: `twilio`. */
  name: string;
  send(to: string, body: string): Promise<SendResult>;
}

export function formatLeadText(lead: Lead): string {
  const flag = lead.spamCheck === 'not-run' ? ' Spam check not run.' : '';
  return `New website enquiry: ${projectTypeLabel(lead.intake.projectType)}. The details are in the office email.${flag}`;
}

export interface SmsChannelOptions {
  transport: SmsTransport;
  to: string[];
}

/**
 * The SMS channel. Optional: when it fails the enquiry still counts as sent,
 * because the email carries it. Each number gets its own message; a failure
 * names how many numbers failed and the provider's codes, never the numbers.
 */
export function smsChannel({ transport, to }: SmsChannelOptions): Channel {
  return {
    name: 'sms',
    required: false,
    async send(lead) {
      const body = formatLeadText(lead);
      const results = await Promise.all(to.map((number) => transport.send(number, body)));
      const failures = results.filter((result) => !result.ok);
      if (failures.length === 0) return { ok: true };
      const codes = [...new Set(failures.map((failure) => failure.detail).filter(Boolean))];
      return {
        ok: false,
        reason: failures[0]!.reason,
        detail: `${failures.length} of ${to.length} numbers${codes.length > 0 ? `: ${codes.join(', ')}` : ''}`,
      };
    },
  };
}
