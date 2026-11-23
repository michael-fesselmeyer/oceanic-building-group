// Shortened forms of personal details for logs. A log line may say that an
// enquiry arrived and roughly what it was, but never carries a full email
// address, phone number or message.

/** `dana.rivera@example.test` becomes `d***@***.test`. */
export function redactEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const topLevel = dot >= 0 ? domain.slice(dot) : '';
  return `${email[0]}***@***${topLevel}`;
}

/** Keeps only the last two digits: `(561) 555-0142` becomes `***42`. */
export function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 2 ? `***${digits.slice(-2)}` : '***';
}

/** Keeps only the first letter: `Dana Rivera` becomes `D.` */
export function redactName(name: string): string {
  const first = name.trim()[0];
  return first ? `${first}.` : '***';
}
