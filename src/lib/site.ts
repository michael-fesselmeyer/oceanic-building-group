// Business facts shown across the site (header, footer, structured data).
// One place to change them. A value that is not known yet is `null`, and
// every component that shows it must render nothing for `null` instead of
// a placeholder.

export interface PostalAddress {
  street: string;
  city: string;
  region: string;
  postalCode: string;
}

export interface SiteFacts {
  name: string;
  legalName: string;
  tagline: string;
  serviceArea: string;
  address: PostalAddress;
  /** Public office line, digits only (for example "5615550100"). */
  phone: string | null;
  /** State contractor license number, shown wherever services are offered. */
  licenseNumber: string | null;
}

export const site: SiteFacts = {
  name: 'Oceanic Building Group',
  legalName: 'Oceanic Building Group LLC',
  tagline: 'Residential & Commercial Construction',
  serviceArea: 'Jupiter and the Palm Beaches',
  address: {
    street: '357 S. Cypress Drive, Suite 13',
    city: 'Tequesta',
    region: 'FL',
    postalCode: '33469',
  },
  phone: null,
  licenseNumber: null,
};

/**
 * False until launch day. While false every page carries a noindex tag, so
 * a preview deployment cannot be indexed, and draft content stays visible
 * for review. Set PUBLIC_SITE_LAUNCHED=true in the production build
 * settings to launch.
 */
export const launched: boolean = import.meta.env.PUBLIC_SITE_LAUNCHED === 'true';

/** Main navigation, in display order. Paths always end in "/". */
export const navigation = [
  { label: 'Portfolio', href: '/portfolio/' },
  { label: 'Services', href: '/services/' },
  { label: 'Interior Design', href: '/interior-design/' },
  { label: 'Our Process', href: '/process/' },
  { label: 'About', href: '/about/' },
] as const;

export const contactLink = { label: 'Start a Project', href: '/contact/' } as const;
