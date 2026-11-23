// The project intake form: its fields, limits, error messages and the
// validation schema. The contact page renders its inputs from these values
// and the server endpoint validates submissions with the same schema, so the
// browser and the server always agree.
//
// Editing the wording: every message a visitor can see is in `messages`
// below. Change the text freely; keep each one short, polite and specific
// about what to do next.
import { z } from 'astro/zod';

/** Where the form posts. The endpoint itself is built separately. */
export const INTAKE_ENDPOINT = '/api/intake/';

/**
 * Name of the hidden spam-trap field. People never see or reach it, so a
 * submission that fills it in came from a program and is dropped. It is not
 * part of the schema.
 */
export const HONEYPOT_FIELD = 'website';

/** Project types, in display order. `value` is what the form sends. */
export const projectTypes = [
  { value: 'custom-home', label: 'Custom home' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'investor-partnership', label: 'Investor partnership' },
  { value: 'other', label: 'Something else' },
] as const;

export type ProjectType = (typeof projectTypes)[number]['value'];

const projectTypeValues = projectTypes.map((type) => type.value) as [ProjectType, ...ProjectType[]];

/** Length limits, in characters. The page sets the same limits on its inputs. */
export const limits = {
  name: { max: 100 },
  email: { max: 254 },
  phone: { max: 30 },
  message: { min: 10, max: 3000 },
} as const;

/**
 * A phone number: digits with optional spaces, brackets, dots, dashes and a
 * leading plus, holding 10 to 15 digits. Written so it works both as an HTML
 * `pattern` attribute (which must match the whole value) and here.
 */
export const PHONE_PATTERN = '[\\s\\(\\)\\.\\+\\-]*(?:\\d[\\s\\(\\)\\.\\+\\-]*){10,15}';
const phoneExpression = new RegExp(`^(?:${PHONE_PATTERN})$`, 'v');

/** Everything a visitor can be told about a field they need to fix. */
export const messages = {
  nameRequired: 'Please enter your name.',
  nameTooLong: `Please keep your name under ${limits.name.max} characters.`,
  emailRequired: 'Please enter your email address so we can reply.',
  emailInvalid: 'Please enter an email address like name@example.com.',
  emailTooLong: `Please keep your email address under ${limits.email.max} characters.`,
  phoneInvalid: 'Please enter a phone number with its area code, or leave this blank.',
  projectTypeRequired: 'Please choose the kind of project.',
  messageRequired: 'Please tell us a little about your project.',
  messageTooShort: `Please add a few more words about your project (at least ${limits.message.min} characters).`,
  messageTooLong: `Please keep your message under ${limits.message.max.toLocaleString('en-US')} characters.`,
} as const;

/**
 * What a visitor is told when the form comes back after sending, above the
 * form, which keeps everything they typed.
 */
export const notices = {
  spamCheckFailed:
    'We could not confirm that this form was sent by a person. Please check the box below if one appears, then send it again.',
  spamCheckNeedsScript:
    'Our spam check needs JavaScript, which seems to be turned off in your browser. Please turn it on and send again, or get in touch using the office details on this page.',
  unavailable:
    'Sorry, we could not send your enquiry just now. Nothing you typed has been lost. Please try again in a few minutes, or get in touch using the office details on this page.',
} as const;

export type Notice = keyof typeof notices;

export const intakeSchema = z.object({
  name: z
    .string({ error: messages.nameRequired })
    .trim()
    .min(1, { error: messages.nameRequired })
    .max(limits.name.max, { error: messages.nameTooLong }),
  email: z
    .string({ error: messages.emailRequired })
    .trim()
    .min(1, { error: messages.emailRequired })
    .max(limits.email.max, { error: messages.emailTooLong })
    .pipe(z.email({ error: messages.emailInvalid })),
  phone: z
    .string({ error: messages.phoneInvalid })
    .trim()
    .max(limits.phone.max, { error: messages.phoneInvalid })
    .refine((value) => value === '' || phoneExpression.test(value), {
      error: messages.phoneInvalid,
    })
    .transform((value) => value || undefined)
    .optional(),
  projectType: z.enum(projectTypeValues, { error: messages.projectTypeRequired }),
  message: z
    .string({ error: messages.messageRequired })
    .trim()
    .min(1, { error: messages.messageRequired })
    .min(limits.message.min, { error: messages.messageTooShort })
    .max(limits.message.max, { error: messages.messageTooLong }),
});

export type Intake = z.output<typeof intakeSchema>;
export type IntakeField = keyof z.input<typeof intakeSchema>;

export type IntakeResult =
  | { success: true; data: Intake }
  | { success: false; errors: Partial<Record<IntakeField, string>> };

function toRecord(input: FormData | Record<string, unknown>): Record<string, unknown> {
  return input instanceof FormData ? Object.fromEntries(input) : input;
}

/**
 * Validates a submission. On failure, returns one message per field that
 * needs fixing (the first problem found), ready to show next to the field.
 * Fields the form does not know about, including the honeypot, are dropped.
 */
export function parseIntake(input: FormData | Record<string, unknown>): IntakeResult {
  const result = intakeSchema.safeParse(toRecord(input));
  if (result.success) return { success: true, data: result.data };

  const errors: Partial<Record<IntakeField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as IntakeField;
    errors[field] ??= issue.message;
  }
  return { success: false, errors };
}

/** True when the hidden spam-trap field has anything in it. */
export function isHoneypotFilled(input: FormData | Record<string, unknown>): boolean {
  const value = toRecord(input)[HONEYPOT_FIELD];
  return typeof value === 'string' ? value.trim() !== '' : value != null;
}
