// The stand-in transport for development and CI. It sends nothing and writes
// one line saying what would have been sent, with personal details shortened
// (see src/lib/redact.ts). It never logs the message itself.
import { redactEmail } from '../redact';
import type { EmailTransport } from './email';
import type { Logger } from './types';

export function logTransport(logger: Logger): EmailTransport {
  return {
    name: 'log',
    async send(message) {
      const to = message.to.map(redactEmail).join(', ') || 'no recipient set';
      logger.info(
        `[intake] email not sent (log transport): to ${to}, reply to ${redactEmail(message.replyTo)}, ` +
          `${message.text.length} characters, key ${message.idempotencyKey.slice(0, 12)}`,
      );
      return { ok: true };
    },
  };
}
