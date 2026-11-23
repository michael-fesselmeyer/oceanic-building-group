import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BEACON_SRC, analyticsBeacon, beacon } from '../../src/lib/analytics';

const TOKEN = 'test-token-1';

describe('analyticsBeacon', () => {
  it('adds the beacon when the site is launched and the token is set', () => {
    expect(analyticsBeacon(` ${TOKEN} `, true)).toEqual({
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      config: `{"token":"${TOKEN}"}`,
    });
  });

  it('adds nothing before launch, even with a token', () => {
    expect(analyticsBeacon(TOKEN, false)).toBeNull();
  });

  it('adds nothing without a token', () => {
    expect(analyticsBeacon(undefined, true)).toBeNull();
    expect(analyticsBeacon('  ', true)).toBeNull();
  });

  it('stops the build for a token in the wrong shape', () => {
    expect(() => analyticsBeacon('token"><script>', true)).toThrow(/PUBLIC_CF_ANALYTICS_TOKEN/);
    expect(() => analyticsBeacon('short', true)).toThrow();
  });

  it('is off in unit tests, which are neither launched nor given a token', () => {
    expect(beacon).toBeNull();
  });
});

describe('the Lighthouse job', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const lighthouse = JSON.parse(
    readFileSync(new URL('../../lighthouserc.json', import.meta.url), 'utf8'),
  );

  it('audits the launched build with the beacon on', () => {
    const job = workflow.slice(workflow.indexOf('lighthouse:'));
    expect(job).toMatch(/PUBLIC_SITE_LAUNCHED: 'true'/);
    expect(job).toMatch(/PUBLIC_CF_ANALYTICS_TOKEN: \S+/);
  });

  it('blocks only the beacon’s report, so the script itself is still measured', () => {
    const blocked: string[] = lighthouse.ci.collect.settings.blockedUrlPatterns;
    expect(blocked).toEqual(['*cloudflareinsights.com/cdn-cgi/rum*']);
    expect(blocked.some((pattern) => BEACON_SRC.includes(pattern.replaceAll('*', '')))).toBe(false);
  });
});
