// Builds the notifier the intake endpoint uses from its settings. This is the
// one place that decides which channels are on:
//
//   email  always on, required: the enquiry counts as sent only if it goes out
//   sms    only when SMS_ENABLED is "true" and its settings are complete;
//          optional: a failure is logged and the enquiry still counts as sent
//
// The endpoint calls notifier.notify(lead) and never knows which channels ran.
import type { EmailConfig, SmsConfig } from '../intake-config';
import { emailChannel, type EmailTransport } from './email';
import { logTransport } from './log-transport';
import { createNotifier, type Notifier } from './notifier';
import { resendTransport } from './resend';
import { smsChannel } from './sms';
import { twilioTransport } from './twilio';
import type { Channel, Logger } from './types';

export { createNotifier, type Notifier, type NotifyResult } from './notifier';
export { emailChannel, formatLeadEmail, summarizeLead, type EmailTransport } from './email';
export { formatLeadText, smsChannel, type SmsTransport } from './sms';
export type { Channel, Lead, Logger, SendResult, SpamCheck } from './types';

export interface NotifierOptions {
  logger: Logger;
  fetch?: typeof fetch;
}

export interface ChannelConfig {
  email: EmailConfig;
  sms: SmsConfig | null;
}

export function emailTransportFor(config: EmailConfig, options: NotifierOptions): EmailTransport {
  return config.transport === 'resend'
    ? resendTransport({ apiKey: config.apiKey, fetch: options.fetch })
    : logTransport(options.logger);
}

/** The channels that are on, in the order they are listed above. */
export function leadChannels(config: ChannelConfig, options: NotifierOptions): Channel[] {
  const channels: Channel[] = [
    emailChannel({
      transport: emailTransportFor(config.email, options),
      from: config.email.from,
      to: config.email.to,
    }),
  ];
  if (config.sms) {
    const { accountSid, authToken, from, to } = config.sms;
    channels.push(
      smsChannel({
        transport: twilioTransport({ accountSid, authToken, from, fetch: options.fetch }),
        to,
      }),
    );
  }
  return channels;
}

export function createLeadNotifier(config: ChannelConfig, options: NotifierOptions): Notifier {
  return createNotifier(leadChannels(config, options), options.logger);
}
