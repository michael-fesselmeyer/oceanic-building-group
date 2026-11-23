// Visitor statistics through Cloudflare Web Analytics, which sets no cookies
// and stores nothing in the browser. Why this tool, its limits and what it
// collects: docs/adr/0003-cookieless-analytics.md.
//
// The beacon is added only when both are true:
//   - the site is launched (PUBLIC_SITE_LAUNCHED=true), so previews and local
//     builds never count visits, and
//   - PUBLIC_CF_ANALYTICS_TOKEN holds the site's token from the Cloudflare
//     dashboard. The token is public: it appears in every page.
// Otherwise no script is added and the privacy page leaves out its
// analytics paragraph.
import { launched } from './site';

export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** Cloudflare's tokens are 32 hexadecimal characters; this also allows test values. */
const TOKEN_SHAPE = /^[A-Za-z0-9-]{8,64}$/;

export interface Beacon {
  src: string;
  /** The value of the script's `data-cf-beacon` attribute. */
  config: string;
}

/**
 * The beacon to add to every page, or null for none. A token in the wrong
 * shape stops the build rather than shipping a beacon that counts nothing.
 */
export function analyticsBeacon(token: string | undefined, isLaunched: boolean): Beacon | null {
  const value = token?.trim();
  if (!isLaunched || !value) return null;
  if (!TOKEN_SHAPE.test(value)) {
    throw new Error(
      'PUBLIC_CF_ANALYTICS_TOKEN does not look like a Cloudflare Web Analytics token. ' +
        'Copy it from the site’s snippet in the Cloudflare dashboard.',
    );
  }
  return { src: BEACON_SRC, config: JSON.stringify({ token: value }) };
}

/** The beacon for this build. */
export const beacon = analyticsBeacon(import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN, launched);
