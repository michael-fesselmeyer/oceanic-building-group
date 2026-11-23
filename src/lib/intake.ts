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

// Follow-up questions. All optional, each shown only for the project types
// it is about, so the form stays short. The page reveals them with CSS once
// a type is chosen; the server keeps only answers that belong to the chosen
// type and match an allowed value, and drops the rest without complaint.
// `question` is what the visitor reads; `summary` labels the answer in the
// office email. Edit the wording freely; changing a `value` only matters to
// someone halfway through filling in the form.

/** One option in a follow-up question: what the form sends and what the office reads. */
export interface Choice {
  value: string;
  label: string;
}

/** Every project type, or the listed ones. */
type AppliesTo = 'every' | readonly ProjectType[];

interface FollowUpBase {
  field: string;
  types: AppliesTo;
  question: string;
  summary: string;
}

/** Radio buttons with a fixed list of answers. */
interface ChoiceFollowUp extends FollowUpBase {
  kind: 'choice';
  choices: readonly Choice[];
}

/** The towns from the towns collection, plus "Somewhere else" (see `townChoices`). */
interface TownFollowUp extends FollowUpBase {
  kind: 'town';
}

/** A short line of text. */
interface TextFollowUp extends FollowUpBase {
  kind: 'text';
  maxLength: number;
  hint: string;
}

export type FollowUp = ChoiceFollowUp | TownFollowUp | TextFollowUp;

/** In form order; the email lists answers in the same order. */
export const followUps = [
  {
    field: 'town',
    kind: 'town',
    types: 'every',
    question: 'Where is the project?',
    summary: 'Where',
  },
  {
    field: 'building',
    kind: 'text',
    types: ['commercial'],
    question: 'What kind of building?',
    summary: 'Building',
    maxLength: 80,
    hint: 'For example, offices, a shop or a restaurant.',
  },
  {
    field: 'start',
    kind: 'choice',
    types: 'every',
    question: 'When would you like to start?',
    summary: 'Start',
    choices: [
      { value: 'within-6-months', label: 'Within 6 months' },
      { value: '6-to-12-months', label: '6 to 12 months' },
      { value: 'later', label: 'Later' },
      { value: 'not-sure', label: 'Not sure yet' },
    ],
  },
  {
    field: 'lot',
    kind: 'choice',
    types: ['custom-home'],
    question: 'Do you own the lot?',
    summary: 'Owns the lot',
    choices: [
      { value: 'yes', label: 'Yes' },
      { value: 'looking', label: 'Looking for one' },
      { value: 'not-yet', label: 'Not yet' },
    ],
  },
  {
    field: 'plans',
    kind: 'choice',
    types: ['custom-home'],
    question: 'Do you have plans or an architect yet?',
    summary: 'Plans or an architect',
    choices: [
      { value: 'yes', label: 'Yes' },
      { value: 'not-yet', label: 'Not yet' },
    ],
  },
  {
    field: 'renovation',
    kind: 'choice',
    types: ['renovation'],
    question: 'What kind of renovation?',
    summary: 'Renovation',
    choices: [
      { value: 'rooms', label: 'A room or two' },
      { value: 'whole-home', label: 'The whole home' },
      { value: 'addition', label: 'An addition' },
    ],
  },
  {
    field: 'interest',
    kind: 'choice',
    types: ['investor-partnership'],
    question: 'What are you interested in?',
    summary: 'Interested in',
    choices: [
      { value: 'selling-land', label: 'Selling land' },
      { value: 'joint-venture', label: 'A joint venture' },
      { value: 'buying-a-home', label: 'Buying a finished home' },
    ],
  },
] as const satisfies readonly FollowUp[];

export type FollowUpField = (typeof followUps)[number]['field'];

/** The value sent for "Somewhere else" in the town question. */
export const ELSEWHERE = 'elsewhere';

/** The town question's options: the towns, in their order, then "Somewhere else". */
export function townChoices(towns: readonly { id: string; data: { name: string } }[]): Choice[] {
  return [
    ...towns.map((town) => ({ value: town.id, label: town.data.name })),
    { value: ELSEWHERE, label: 'Somewhere else' },
  ];
}

/** The follow-up questions that apply to a project type. */
export function followUpsFor(type: ProjectType): FollowUp[] {
  return followUps.filter(
    (question: FollowUp) => question.types === 'every' || question.types.includes(type),
  );
}

/** A follow-up answer, in plain words, ready for the office to read. */
export interface FollowUpAnswer {
  field: FollowUpField;
  answer: string;
}

export type Intake = z.output<typeof intakeSchema> & { followUps: FollowUpAnswer[] };
export type IntakeField = keyof z.input<typeof intakeSchema>;
/** Every field a visitor can fill in, required or not. */
export type FormField = IntakeField | FollowUpField;

export type IntakeResult =
  | { success: true; data: Intake }
  | { success: false; errors: Partial<Record<IntakeField, string>> };

function toRecord(input: FormData | Record<string, unknown>): Record<string, unknown> {
  return input instanceof FormData ? Object.fromEntries(input) : input;
}

/** Control characters and runs of white space become one space. */
const oneLine = (text: string) => text.replace(/[\p{Cc}\s]+/gu, ' ').trim();

/**
 * The follow-up answers that belong to the chosen type and are allowed,
 * in plain words. Anything else is dropped: answers to another type's
 * questions (left over when a visitor changes their mind), values that are
 * not on the list and text over its limit. None of it stops the enquiry.
 */
function parseFollowUps(
  record: Record<string, unknown>,
  type: ProjectType,
  towns: readonly Choice[],
): FollowUpAnswer[] {
  const answers: FollowUpAnswer[] = [];
  for (const question of followUpsFor(type)) {
    const raw = record[question.field];
    if (typeof raw !== 'string') continue;
    const value = oneLine(raw);
    if (!value) continue;
    const field = question.field as FollowUpField;
    if (question.kind === 'text') {
      if (value.length <= question.maxLength) answers.push({ field, answer: value });
      continue;
    }
    const choices = question.kind === 'town' ? towns : question.choices;
    const choice = choices.find((option) => option.value === value);
    if (choice) answers.push({ field, answer: choice.label });
  }
  return answers;
}

export interface ParseOptions {
  /** The town question's options (`townChoices`). Without them only "Somewhere else" is known. */
  towns?: readonly Choice[];
}

/**
 * Validates a submission. On failure, returns one message per field that
 * needs fixing (the first problem found), ready to show next to the field.
 * Follow-up answers never fail: the ones that do not fit are dropped.
 * Fields the form does not know about, including the honeypot, are dropped.
 */
export function parseIntake(
  input: FormData | Record<string, unknown>,
  { towns = townChoices([]) }: ParseOptions = {},
): IntakeResult {
  const record = toRecord(input);
  const result = intakeSchema.safeParse(record);
  if (result.success) {
    const followUpAnswers = parseFollowUps(record, result.data.projectType, towns);
    return { success: true, data: { ...result.data, followUps: followUpAnswers } };
  }

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
