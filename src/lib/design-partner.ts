// Helpers for the interior design page (/interior-design/): the facts shown
// beside the partner's name and the page's title and description. Kept apart
// from the page so they can be unit tested.
import type { DesignPartner } from './site';

export const DESIGN_PARTNER_PATH = '/interior-design/';

/** What the page needs from the partner's content file. */
export interface DesignPartnerIntro {
  summary: string;
  seoDescription?: string;
  basedIn?: string;
  worksIn: string[];
}

export interface PartnerFact {
  label: string;
  value: string;
  /** Set when the value is a link. */
  href?: string;
}

/** A website address as people say it: "https://www.studio.example/" becomes "studio.example". */
export function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A list of places in a sentence: "New York, Boston and Florida". */
export function placeList(places: string[]): string {
  const clean = places.map((place) => place.trim()).filter(Boolean);
  if (clean.length <= 1) return clean.join('');
  return `${clean.slice(0, -1).join(', ')} and ${clean.at(-1)}`;
}

/** The facts beside the partner's name. Missing ones are left out. */
export function partnerFacts(
  partner: DesignPartner,
  intro: DesignPartnerIntro | null,
): PartnerFact[] {
  const facts: PartnerFact[] = [];
  const basedIn = intro?.basedIn?.trim();
  if (basedIn) facts.push({ label: 'Based in', value: basedIn });
  const worksIn = placeList(intro?.worksIn ?? []);
  if (worksIn) facts.push({ label: 'Works in', value: worksIn });
  facts.push({ label: 'Website', value: websiteLabel(partner.url), href: partner.url });
  return facts;
}

/** The page title, the same as its navigation label. */
export const DESIGN_PARTNER_TITLE = 'Interior Design';

/** Search description: the content file's, or a plain fallback. */
export function designPartnerDescription(
  partner: DesignPartner | null,
  intro: DesignPartnerIntro | null,
): string {
  if (!partner) {
    return 'Oceanic Building Group works with an interior design partner on selected homes. Their introduction will be published here soon.';
  }
  return (
    intro?.seoDescription ??
    `Meet ${partner.name}, the interior designer Oceanic Building Group works with on selected homes.`
  );
}
