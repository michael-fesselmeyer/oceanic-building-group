import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_REPORT_ORIGIN,
  ANALYTICS_SCRIPT_ORIGIN,
  SECURITY_HEADERS,
  TURNSTILE_ORIGIN,
  allowTurnstile,
  analyticsEnabled,
  cspConfig,
  headersRule,
  withSecurityHeaders,
} from '../../src/lib/security-headers';

const headersFile = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');

/** The headers public/_headers sets for one rule, as name → value. */
function rule(text: string, pattern: string): Record<string, string> {
  const lines = text.split('\n').filter((line) => !line.startsWith('#'));
  const start = lines.indexOf(pattern);
  if (start === -1) return {};
  const headers: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\s+([\w-]+):\s*(.+)$/);
    if (!match) break;
    headers[match[1]!] = match[2]!;
  }
  return headers;
}

describe('public/_headers', () => {
  const all = rule(headersFile, '/*');

  it.each([
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Frame-Options',
  ])('sets %s for every path', (name) => {
    expect(all[name]).toBeTruthy();
  });

  it('matches src/lib/security-headers.ts exactly, so static and Worker responses agree', () => {
    expect(all).toEqual(SECURITY_HEADERS);
    expect(headersFile).toContain(headersRule());
  });

  it('forbids framing and plug-ins and pins form posts to the site', () => {
    expect(all['Content-Security-Policy']).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    expect(all['X-Frame-Options']).toBe('DENY');
  });

  it('keeps every line within Cloudflare’s 2,000 character limit', () => {
    for (const line of headersFile.split('\n')) expect(line.length).toBeLessThanOrEqual(2000);
  });

  it('sets no Cache-Control, which the build adds for /_astro/* on its own', () => {
    expect(headersFile).not.toMatch(/cache-control/i);
  });
});

describe('cspConfig', () => {
  it('allows only the site itself when analytics are off', () => {
    const config = cspConfig({ analytics: false });
    expect(config.directives).toEqual([
      "default-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]);
    expect(config.scriptDirective.resources).toEqual(["'self'"]);
    expect(JSON.stringify(config)).not.toMatch(/cloudflareinsights|challenges/);
  });

  it('adds the beacon’s script and report origins only when analytics are on', () => {
    const config = cspConfig({ analytics: true });
    expect(config.scriptDirective.resources).toEqual(["'self'", ANALYTICS_SCRIPT_ORIGIN]);
    expect(config.directives).toContain(`connect-src 'self' ${ANALYTICS_REPORT_ORIGIN}`);
  });

  it('never allows inline scripts or <style> elements, only style attributes', () => {
    const config = cspConfig({ analytics: true });
    expect(config.scriptDirective.resources).not.toContain("'unsafe-inline'");
    expect(config.styleDirective.resources).toEqual([
      "'self'",
      { resource: "'unsafe-inline'", kind: 'attribute' },
    ]);
  });
});

describe('analyticsEnabled', () => {
  it('follows the beacon’s rule: launched and a token', () => {
    expect(
      analyticsEnabled({ PUBLIC_SITE_LAUNCHED: 'true', PUBLIC_CF_ANALYTICS_TOKEN: 'test-token-1' }),
    ).toBe(true);
    expect(analyticsEnabled({ PUBLIC_SITE_LAUNCHED: 'true', PUBLIC_CF_ANALYTICS_TOKEN: ' ' })).toBe(
      false,
    );
    expect(analyticsEnabled({ PUBLIC_CF_ANALYTICS_TOKEN: 'test-token-1' })).toBe(false);
    expect(analyticsEnabled({})).toBe(false);
  });
});

describe('allowTurnstile', () => {
  it('adds Turnstile’s script, iframe and request origin to the page', () => {
    const csp = { insertScriptResource: vi.fn(), insertDirective: vi.fn() };
    allowTurnstile(csp);
    expect(csp.insertScriptResource).toHaveBeenCalledWith(TURNSTILE_ORIGIN);
    expect(csp.insertDirective.mock.calls.map(([directive]) => directive)).toEqual([
      `frame-src ${TURNSTILE_ORIGIN}`,
      `connect-src ${TURNSTILE_ORIGIN}`,
    ]);
  });

  it('does nothing when the policy is off', () => {
    expect(() => allowTurnstile(undefined)).not.toThrow();
  });
});

describe('withSecurityHeaders', () => {
  it('adds every header to a Worker response', () => {
    const response = withSecurityHeaders(new Response('ok', { status: 422 }));
    expect(response.status).toBe(422);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it('works on a redirect, whose headers cannot be changed in place', () => {
    const response = withSecurityHeaders(
      Response.redirect('https://site.example.test/thanks/', 303),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('https://site.example.test/thanks/');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('keeps a header the response sets, but adds the frame rule as a second policy', () => {
    const response = withSecurityHeaders(
      new Response('ok', {
        headers: {
          'Content-Security-Policy': "default-src 'self'",
          'Referrer-Policy': 'no-referrer',
        },
      }),
    );
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Content-Security-Policy')).toBe(
      `default-src 'self', ${SECURITY_HEADERS['Content-Security-Policy']}`,
    );
  });
});
