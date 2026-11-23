import { describe, expect, it } from 'vitest';
import {
  HONEYPOT_FIELD,
  PHONE_PATTERN,
  isHoneypotFilled,
  limits,
  messages,
  parseIntake,
  projectTypes,
} from '../../src/lib/intake';

const valid = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  projectType: 'custom-home',
  message: 'A four bedroom home on a corner lot, starting next spring.',
};

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
    expect(result).toEqual({ success: true, data: valid });
  });

  it('accepts FormData, as the endpoint receives it', () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(valid)) form.set(key, value);
    expect(parseIntake(form)).toEqual({ success: true, data: valid });
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
      ['email', 'message', 'name', 'phone', 'projectType'].sort(),
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
