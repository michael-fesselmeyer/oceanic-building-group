// The email to the office: what it says, and the channel that sends it
// through a transport (Resend in production, a log line locally and in CI).
import { followUps, projectTypes, type FollowUpAnswer } from '../intake';
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

/** The follow-up answers, one per line, each under its short label. */
function followUpLines(answers: readonly FollowUpAnswer[]): string[] {
  if (answers.length === 0) return [];
  return [
    '',
    'About the project:',
    ...answers.map(({ field, answer }) => {
      const label = followUps.find((question) => question.field === field)?.summary ?? field;
      return `${label}: ${oneLine(answer)}`;
    }),
  ];
}

/**
 * Unicode direction controls. In a visitor's text they would reverse how the
 * rest of a line is displayed, so a name could disguise the subject.
 */
const DIRECTION_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Removes direction controls and every control character except white space (tab, line break). */
function withoutControls(text: string): string {
  return text.replace(DIRECTION_CONTROLS, '').replace(/[^\P{Cc}\s]/gu, '');
}

/**
 * A visitor's text for one line (the subject, a "Name:" line): line breaks
 * would let it break out of a header line, and other control characters have
 * no place in an email.
 */
function oneLine(text: string): string {
  return withoutControls(text).replace(/\s+/g, ' ').trim();
}

/** A visitor's message: line breaks kept, other control characters removed. */
function plainText(text: string): string {
  return withoutControls(text.replace(/\r\n?/g, '\n')).trim();
}

/**
 * The subject and plain-text body. The body depends only on the submission,
 * never on the time it was sent, so a resent form produces the same request
 * and the provider's idempotency check can recognise it. The spam-check line
 * comes before anything the visitor wrote, so their text cannot imitate it.
 */
export function formatLeadEmail(lead: Lead): { subject: string; text: string } {
  const { intake, spamCheck } = lead;
  const name = oneLine(intake.name);
  const project = projectTypeLabel(intake.projectType);

  const flag = spamCheck === 'not-run' ? ' [spam check not run]' : '';
  const subject = `New enquiry: ${project} from ${name}${flag}`;

  const text = [
    'A new enquiry came in through the website contact form.',
    spamCheck === 'passed'
      ? 'Spam check: passed.'
      : 'Spam check: not run, because the visitor’s browser had JavaScript turned off. ' +
        'Treat with care if it looks automated.',
    '',
    `Name: ${name}`,
    `Email: ${oneLine(intake.email)}`,
    `Phone: ${intake.phone ? oneLine(intake.phone) : 'not given'}`,
    `Project: ${project}`,
    '',
    'Message:',
    plainText(intake.message),
    ...followUpLines(intake.followUps),
    '',
    '--',
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
    // Which questions were answered, not the answers: the building text is the visitor's own.
    intake.followUps.length > 0
      ? `follow-ups ${intake.followUps.map((answer) => answer.field).join(' ')}`
      : 'no follow-ups',
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
