// Builds the notifier the intake endpoint uses from its settings. This is the
// one place that decides which channels are on. Email is always on and
// required. An SMS channel joins the list here behind its own switch
// (SMS_ENABLED), as an optional channel, without any change to the endpoint.
import type { EmailConfig } from '../intake-config';
import { emailChannel, type EmailTransport } from './email';
import { logTransport } from './log-transport';
import { createNotifier, type Notifier } from './notifier';
import { resendTransport } from './resend';
import type { Channel, Logger } from './types';

export { createNotifier, type Notifier, type NotifyResult } from './notifier';
export { emailChannel, formatLeadEmail, summarizeLead, type EmailTransport } from './email';
export type { Channel, Lead, Logger, SendResult, SpamCheck } from './types';

export interface NotifierOptions {
  logger: Logger;
  fetch?: typeof fetch;
}

export function emailTransportFor(config: EmailConfig, options: NotifierOptions): EmailTransport {
  return config.transport === 'resend'
    ? resendTransport({ apiKey: config.apiKey, fetch: options.fetch })
    : logTransport(options.logger);
}

export function createLeadNotifier(email: EmailConfig, options: NotifierOptions): Notifier {
  const channels: Channel[] = [
    emailChannel({ transport: emailTransportFor(email, options), from: email.from, to: email.to }),
  ];
  return createNotifier(channels, options.logger);
}
