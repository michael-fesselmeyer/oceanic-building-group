// Security headers and the content security policy, in one place.
//
// Where each part ends up:
//   - SECURITY_HEADERS go on every static response through public/_headers
//     (a unit test keeps the file and this object identical) and on every
//     response from the Worker through src/middleware.ts, because Cloudflare
//     does not apply _headers to responses the Worker generates.
//   - cspConfig() is Astro's `security.csp` setting (astro.config.mjs). Astro
//     hashes every script and style it renders and writes the policy into a
//     <meta> tag on each page, so no inline code needs 'unsafe-inline'.
//   - allowTurnstile() adds Turnstile only on the pages that render the spam
//     check: /contact/ and the form the endpoint sends back.
//
// What each header is for: docs/architecture.md#security-headers.

/** Cloudflare Turnstile serves its script and its iframe from here. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Cloudflare Web Analytics: where the beacon loads from and where it reports. */
export const ANALYTICS_SCRIPT_ORIGIN = 'https://static.cloudflareinsights.com';
export const ANALYTICS_REPORT_ORIGIN = 'https://cloudflareinsights.com';

/**
 * The parts of the policy that cannot live in a <meta> tag (frame-ancestors)
 * plus the ones worth repeating there in case the tag were ever lost.
 */
export const HEADER_CSP =
  "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': HEADER_CSP,
} as const;

/** The `/*` rule of public/_headers, as the file must read. */
export function headersRule(): string {
  const lines = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`);
  return ['/*', ...lines].join('\n');
}

/**
 * Whether the analytics beacon is on, by the same rule the beacon itself
 * uses (src/lib/analytics.ts): the site is launched and the token is set.
 * Read from the build environment by astro.config.mjs.
 */
export function analyticsEnabled(env: Record<string, string | undefined>): boolean {
  return env.PUBLIC_SITE_LAUNCHED === 'true' && Boolean(env.PUBLIC_CF_ANALYTICS_TOKEN?.trim());
}

type Resource = string | { resource: string; kind: 'element' | 'attribute' | 'default' };

/** The directives this site sets, typed the way Astro's `security.csp` expects them. */
type Directive =
  `${'default-src' | 'img-src' | 'font-src' | 'connect-src' | 'object-src' | 'base-uri' | 'form-action'} ${string}`;

export interface CspConfig {
  directives: Directive[];
  scriptDirective: { resources: Resource[] };
  styleDirective: { resources: Resource[] };
}

/**
 * Astro's `security.csp` setting. Everything comes from the site itself
 * except the analytics beacon, which is allowed only when it is on.
 * `style` attributes are allowed (style-src-attr) because components set CSS
 * custom properties with them, such as a photograph's aspect ratio; they
 * cannot run code, and every <style> element is still checked by hash.
 */
export function cspConfig({ analytics }: { analytics: boolean }): CspConfig {
  const connect = ["'self'", ...(analytics ? [ANALYTICS_REPORT_ORIGIN] : [])];
  return {
    directives: [
      "default-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      `connect-src ${connect.join(' ')}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ],
    scriptDirective: {
      resources: ["'self'", ...(analytics ? [ANALYTICS_SCRIPT_ORIGIN] : [])],
    },
    styleDirective: {
      resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
    },
  };
}

/** Added to the policy of a page that renders the Turnstile widget. */
export const TURNSTILE_DIRECTIVES = [
  `frame-src ${TURNSTILE_ORIGIN}`,
  `connect-src ${TURNSTILE_ORIGIN}`,
] as const;

/** The part of Astro's `Astro.csp` this file uses. */
interface CspControls {
  insertScriptResource(resource: string): void;
  insertDirective(directive: string): void;
}

/**
 * Lets Turnstile's script, iframe and requests through on the current page.
 * Call it from the page's own frontmatter: the policy is written into <head>
 * before any component in the page body runs.
 */
export function allowTurnstile(csp: CspControls | undefined): void {
  if (!csp) return;
  csp.insertScriptResource(TURNSTILE_ORIGIN);
  for (const directive of TURNSTILE_DIRECTIVES) csp.insertDirective(directive);
}

/**
 * Copies a response with the security headers added. A header the response
 * already sets is kept, except the policy: if Astro already wrote one, this
 * one is appended as a second policy (a browser enforces both), so the
 * frame-ancestors rule is never lost.
 */
export function withSecurityHeaders(response: Response): Response {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'Content-Security-Policy') copy.headers.append(name, value);
    else if (!copy.headers.has(name)) copy.headers.set(name, value);
  }
  return copy;
}
