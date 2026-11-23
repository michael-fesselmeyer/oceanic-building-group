// The email to the office: what it says, and the channel that sends it
// through a transport (Resend in production, a log line locally and in CI).
import { projectTypes } from '../intake';
import { redactEmail, redactName, redactPhone } from '../redact';
import type { Channel, Lead, SendResult } from './types';

export interface EmailMessage {
  from: string;
  to: string[];
  /** The visitor's address, so the office can answer with a plain reply. */
  replyTo: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailTransport {
  /** Short name for logs: `resend`, `log`. */
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export function projectTypeLabel(value: string): string {
  return projectTypes.find((type) => type.value === value)?.label ?? value;
}

/** Line breaks would let a visitor's text break out of a header line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The subject and plain-text body. The body depends only on the submission,
 * never on the time it was sent, so a resent form produces the same request
 * and the provider's idempotency check can recognise it.
 */
export function formatLeadEmail(lead: Lead): { subject: string; text: string } {
  const { intake, spamCheck } = lead;
  const name = oneLine(intake.name);
  const project = projectTypeLabel(intake.projectType);

  const flag = spamCheck === 'not-run' ? ' [spam check not run]' : '';
  const subject = `New enquiry: ${project} from ${name}${flag}`;

  const text = [
    'A new enquiry came in through the website contact form.',
    '',
    `Name: ${name}`,
    `Email: ${intake.email}`,
    `Phone: ${intake.phone ?? 'not given'}`,
    `Project: ${project}`,
    '',
    'Message:',
    intake.message,
    '',
    '--',
    spamCheck === 'passed'
      ? 'Spam check: passed.'
      : 'Spam check: not run, because the visitor’s browser had JavaScript turned off. ' +
        'Treat with care if it looks automated.',
    `Reply to this email to answer ${name} directly.`,
  ].join('\n');

  return { subject, text };
}

/** One log line describing a lead without its personal details. */
export function summarizeLead(lead: Lead): string {
  const { intake } = lead;
  return [
    redactName(intake.name),
    redactEmail(intake.email),
    intake.phone ? `phone ${redactPhone(intake.phone)}` : 'no phone',
    projectTypeLabel(intake.projectType),
    `message ${intake.message.length} characters`,
    `spam check ${lead.spamCheck}`,
  ].join(', ');
}

export interface EmailChannelOptions {
  transport: EmailTransport;
  from: string;
  to: string[];
}

/** The email channel. It is always on and always required. */
export function emailChannel({ transport, from, to }: EmailChannelOptions): Channel {
  return {
    name: 'email',
    required: true,
    send(lead) {
      const { subject, text } = formatLeadEmail(lead);
      return transport.send({
        from,
        to,
        replyTo: lead.intake.email,
        subject,
        text,
        idempotencyKey: lead.key,
      });
    },
  };
}
