import { describe, expect, it } from 'vitest';
import {
  ELSEWHERE,
  HONEYPOT_FIELD,
  PHONE_PATTERN,
  followUps,
  followUpsFor,
  isHoneypotFilled,
  limits,
  messages,
  parseIntake,
  projectTypes,
  townChoices,
} from '../../src/lib/intake';

const valid = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  projectType: 'custom-home',
  message: 'A four bedroom home on a corner lot, starting next spring.',
};

/** What a successful parse returns for `valid`: the answers, trimmed, and no follow-ups. */
const parsed = { ...valid, followUps: [] };

function errorsFor(input: Record<string, unknown>) {
  const result = parseIntake(input);
  if (result.success) throw new Error('expected the submission to be rejected');
  return result.errors;
}

describe('parseIntake', () => {
  it('accepts a complete submission and trims every value', () => {
    const result = parseIntake({
      ...valid,
      name: '  Dana Rivera ',
      email: ' dana.rivera@example.test ',
      message: `  ${valid.message}  `,
    });
    expect(result).toEqual({ success: true, data: parsed });
  });

  it('accepts FormData, as the endpoint receives it', () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(valid)) form.set(key, value);
    expect(parseIntake(form)).toEqual({ success: true, data: parsed });
  });

  it('treats a blank phone number as not given', () => {
    const result = parseIntake({ ...valid, phone: '   ' });
    expect(result.success && result.data.phone).toBeUndefined();
    const withoutPhone = parseIntake({ ...valid, phone: undefined });
    expect(withoutPhone.success).toBe(true);
  });

  it('drops fields the form does not know about, including the honeypot', () => {
    const result = parseIntake({ ...valid, [HONEYPOT_FIELD]: '', extra: 'x' });
    expect(result.success && Object.keys(result.data).sort()).toEqual(
      ['email', 'followUps', 'message', 'name', 'phone', 'projectType'].sort(),
    );
  });

  it('reports every missing required field with its own message', () => {
    expect(errorsFor({})).toEqual({
      name: messages.nameRequired,
      email: messages.emailRequired,
      projectType: messages.projectTypeRequired,
      message: messages.messageRequired,
    });
  });

  it('treats whitespace-only answers as missing', () => {
    const errors = errorsFor({ ...valid, name: '   ', email: ' ', message: '\n\n' });
    expect(errors).toEqual({
      name: messages.nameRequired,
      email: messages.emailRequired,
      message: messages.messageRequired,
    });
  });

  it('rejects an email address that cannot receive a reply', () => {
    for (const email of ['dana', 'dana@', 'dana@example', 'dana example.test', '@example.test']) {
      expect(errorsFor({ ...valid, email })).toEqual({ email: messages.emailInvalid });
    }
  });

  it('accepts common ways of writing a phone number', () => {
    for (const phone of ['5615550142', '561-555-0142', '561.555.0142', '+1 (561) 555-0142']) {
      expect(parseIntake({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it('rejects phone numbers that are too short, too long or contain letters', () => {
    for (const phone of ['555-0142', '1234567890123456', '561-555-CALL', '561 555 0142 ext 2']) {
      expect(errorsFor({ ...valid, phone }), phone).toEqual({ phone: messages.phoneInvalid });
    }
  });

  it('only accepts the listed project types', () => {
    for (const { value } of projectTypes) {
      expect(parseIntake({ ...valid, projectType: value }).success).toBe(true);
    }
    expect(errorsFor({ ...valid, projectType: 'pool' })).toEqual({
      projectType: messages.projectTypeRequired,
    });
  });

  it('enforces the length limits', () => {
    expect(errorsFor({ ...valid, name: 'a'.repeat(limits.name.max + 1) })).toEqual({
      name: messages.nameTooLong,
    });
    expect(errorsFor({ ...valid, message: 'Too short' })).toEqual({
      message: messages.messageTooShort,
    });
    expect(errorsFor({ ...valid, message: 'a'.repeat(limits.message.max + 1) })).toEqual({
      message: messages.messageTooLong,
    });
    expect(parseIntake({ ...valid, message: 'a'.repeat(limits.message.max) }).success).toBe(true);
    expect(parseIntake({ ...valid, message: 'a'.repeat(limits.message.min) }).success).toBe(true);
  });

  it('rejects values that are not text', () => {
    expect(errorsFor({ ...valid, name: 42 })).toEqual({ name: messages.nameRequired });
  });
});

describe('follow-up questions', () => {
  // Synthetic towns, as townChoices would build them from the towns collection.
  const towns = townChoices([
    { id: 'harbor-point', data: { name: 'Harbor Point' } },
    { id: 'pine-ridge', data: { name: 'Pine Ridge' } },
  ]);

  function followUpsOf(input: Record<string, unknown>) {
    const result = parseIntake({ ...valid, ...input }, { towns });
    if (!result.success) throw new Error('expected the submission to be accepted');
    return result.data.followUps;
  }

  it('lists the towns in order, then somewhere else', () => {
    expect(towns).toEqual([
      { value: 'harbor-point', label: 'Harbor Point' },
      { value: 'pine-ridge', label: 'Pine Ridge' },
      { value: ELSEWHERE, label: 'Somewhere else' },
    ]);
  });

  it('asks where and when for every project type', () => {
    for (const { value } of projectTypes) {
      const fields = followUpsFor(value).map((question) => question.field);
      expect(fields, value).toEqual(expect.arrayContaining(['town', 'start']));
    }
  });

  it('asks each type its own questions, and the other types none of them', () => {
    const own = (type: Parameters<typeof followUpsFor>[0]) =>
      followUpsFor(type)
        .filter((question) => question.types !== 'every')
        .map((question) => question.field);
    expect(own('custom-home')).toEqual(['lot', 'plans']);
    expect(own('renovation')).toEqual(['renovation']);
    expect(own('commercial')).toEqual(['building']);
    expect(own('investor-partnership')).toEqual(['interest']);
    expect(own('other')).toEqual([]);
  });

  it('keeps allowed answers for the chosen type, in plain words and form order', () => {
    expect(
      followUpsOf({
        projectType: 'custom-home',
        plans: 'not-yet',
        lot: 'looking',
        start: '6-to-12-months',
        town: 'pine-ridge',
      }),
    ).toEqual([
      { field: 'town', answer: 'Pine Ridge' },
      { field: 'start', answer: '6 to 12 months' },
      { field: 'lot', answer: 'Looking for one' },
      { field: 'plans', answer: 'Not yet' },
    ]);
    expect(followUpsOf({ projectType: 'renovation', renovation: 'whole-home' })).toEqual([
      { field: 'renovation', answer: 'The whole home' },
    ]);
    expect(followUpsOf({ projectType: 'investor-partnership', interest: 'selling-land' })).toEqual([
      { field: 'interest', answer: 'Selling land' },
    ]);
    expect(followUpsOf({ projectType: 'other', town: ELSEWHERE })).toEqual([
      { field: 'town', answer: 'Somewhere else' },
    ]);
  });

  it('ignores answers to another type’s questions, left over from a changed choice', () => {
    expect(
      followUpsOf({
        projectType: 'renovation',
        lot: 'yes',
        plans: 'yes',
        building: 'Offices',
        interest: 'joint-venture',
      }),
    ).toEqual([]);
  });

  it('drops values that are not on the list, without rejecting the enquiry', () => {
    expect(
      followUpsOf({
        projectType: 'custom-home',
        town: 'atlantis',
        start: 'yesterday',
        lot: 'Yes',
        plans: '<b>yes</b>',
      }),
    ).toEqual([]);
  });

  it('knows only somewhere else when no towns are given', () => {
    const result = parseIntake({ ...valid, town: 'pine-ridge' });
    expect(result.success && result.data.followUps).toEqual([]);
  });

  it('keeps the building as one trimmed line, up to its limit', () => {
    const building = followUps.find((question) => question.field === 'building')!;
    const limit = building.kind === 'text' ? building.maxLength : 0;
    expect(limit).toBe(80);
    expect(
      followUpsOf({ projectType: 'commercial', building: '  Two-storey\r\noffices ' }),
    ).toEqual([{ field: 'building', answer: 'Two-storey offices' }]);
    expect(followUpsOf({ projectType: 'commercial', building: 'a'.repeat(limit) })).toHaveLength(1);
    expect(followUpsOf({ projectType: 'commercial', building: 'a'.repeat(limit + 1) })).toEqual([]);
  });

  it('treats blank and non-text answers as not given', () => {
    expect(followUpsOf({ projectType: 'commercial', building: '   ', town: '', start: 3 })).toEqual(
      [],
    );
  });
});

describe('PHONE_PATTERN', () => {
  it('compiles as an HTML pattern attribute, which uses the v flag', () => {
    expect(() => new RegExp(`^(?:${PHONE_PATTERN})$`, 'v')).not.toThrow();
  });
});

describe('isHoneypotFilled', () => {
  it('is false when the trap is empty or absent', () => {
    expect(isHoneypotFilled({ ...valid, [HONEYPOT_FIELD]: '' })).toBe(false);
    expect(isHoneypotFilled({ ...valid, [HONEYPOT_FIELD]: '   ' })).toBe(false);
    expect(isHoneypotFilled(valid)).toBe(false);
  });

  it('is true when anything is typed into the trap', () => {
    const form = new FormData();
    form.set(HONEYPOT_FIELD, 'https://spam.example.test');
    expect(isHoneypotFilled(form)).toBe(true);
  });
});

describe('messages', () => {
  it('are written as complete, polite sentences', () => {
    for (const text of Object.values(messages)) {
      expect(text).toMatch(/^Please .+\.$/);
    }
  });
});
