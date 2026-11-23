// Rules for showing the team on the About page, kept free of Astro imports
// so they can be unit tested.
import type { ImageMetadata } from 'astro';

/** The fields these rules read from a team entry. */
export interface LicenseFields {
  realEstateLicensee: boolean;
  brokerage?: string;
}

/**
 * Florida requires a real estate licensee's advertising to name their
 * brokerage. The schema stops a licensee without one from being published;
 * this keeps such an entry off every page, previews included, so the site
 * never shows a licensee without the brokerage.
 */
export function canShowMember(member: LicenseFields): boolean {
  return !member.realEstateLicensee || Boolean(member.brokerage?.trim());
}

/** The brokerage to show beside a licensee, or null for everyone else. */
export function memberBrokerage(member: LicenseFields): string | null {
  const brokerage = member.brokerage?.trim();
  return member.realEstateLicensee && brokerage ? brokerage : null;
}

/**
 * A biography's paragraphs, as plain text. Paragraphs are separated by a
 * blank line; Markdown formatting is not supported. Empty for no biography.
 */
export function bioParagraphs(body: string | undefined): string[] {
  return (body ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Alt text for a portrait. */
export function portraitAlt(name: string): string {
  return `Portrait of ${name.trim()}`;
}

/** What the team list shows for one person. */
export interface TeamCard {
  id: string;
  name: string;
  role: string;
  photo?: ImageMetadata;
  brokerage: string | null;
  bio: string[];
}

/** A team entry's fields and Markdown body, shaped for the team list. */
export function teamCard(
  id: string,
  data: LicenseFields & { name: string; role: string; photo?: ImageMetadata },
  body: string | undefined,
): TeamCard {
  return {
    id,
    name: data.name.trim(),
    role: data.role.trim(),
    photo: data.photo,
    brokerage: memberBrokerage(data),
    bio: bioParagraphs(body),
  };
}
