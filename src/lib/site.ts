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

/**
 * The interior designer the company works with on selected projects. Her
 * introduction and biography are in src/content/design-partner/.
 */
export interface DesignPartner {
  name: string;
  /** The partner's own website. */
  url: string;
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
  /**
   * Years of construction experience the company's principals bring, shown
   * as "30+ years". It describes the principals, never the company's age.
   */
  principalsExperienceYears: number | null;
  /**
   * Presented on /interior-design/ and credited on project pages marked
   * `interiorDesignPartner: true`. While `null`, no credit is shown anywhere
   * and the interior design page says the partner will be introduced soon.
   */
  designPartner: DesignPartner | null;
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
  principalsExperienceYears: 30,
  designPartner: {
    name: 'Ashley Manfred',
    url: 'https://www.ashleymanfred.com/',
  },
};

/**
 * False until launch day. While false every page carries a noindex tag, so
 * a preview deployment cannot be indexed, and draft content stays visible
 * for review. Set PUBLIC_SITE_LAUNCHED=true in the production build
 * settings to launch.
 */
// `?.` because browser tests import modules that import this one outside Vite, where
// import.meta.env does not exist; there the site counts as not launched.
export const launched: boolean = import.meta.env?.PUBLIC_SITE_LAUNCHED === 'true';

/**
 * True only in the Lighthouse build in CI (PUBLIC_AUDIT_FIXTURES=true). It
 * adds one made-up project page, /portfolio/audit-example/, so the project
 * page template can be audited while every real project is still a draft.
 * Never set it for a deployment.
 */
export const auditFixtures: boolean = import.meta.env.PUBLIC_AUDIT_FIXTURES === 'true';

/** Main navigation, in display order. Paths always end in "/". */
export const navigation = [
  { label: 'Portfolio', href: '/portfolio/' },
  { label: 'Services', href: '/services/' },
  { label: 'Interior Design', href: '/interior-design/' },
  { label: 'Our Process', href: '/process/' },
  { label: 'About', href: '/about/' },
] as const;

export const contactLink = { label: 'Start a Project', href: '/contact/' } as const;

/** The index of the towns the business serves. Linked from the footer. */
export const areasLink = { label: 'Areas We Serve', href: '/areas/' } as const;
