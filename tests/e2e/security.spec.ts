// The content security policy in every built page: nothing the site itself
// loads is refused, and code the site did not ship is. Pages are found in the
// build output, so new pages are covered without editing this file. The
// headers themselves are checked against the built Worker in intake.spec.ts.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const clientDir = join(process.cwd(), 'dist', 'client');

function builtPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : builtPages(full);
    if (!entry.name.endsWith('.html')) return [];
    const path = `/${relative(clientDir, full).split(sep).join('/')}`;
    return [path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path];
  });
}

/** Records every policy violation from the first byte of the page. */
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { __violations: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  // Turnstile's script would load from the network; blocking it here is a
  // failed request, not a policy violation, so it does not hide one.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

test.describe('content security policy', () => {
  test.beforeEach(async ({ page }) => watchViolations(page));

  for (const path of builtPages(clientDir)) {
    test(`${path} loads with no policy violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('load');
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      expect(await violations(page)).toEqual([]);
    });
  }

  test('the contact page runs its own form script and allows only Turnstile besides', async ({
    page,
  }) => {
    await page.goto('/contact/');
    // The inline validation script ran: it turns off the browser's bubbles.
    expect(
      await page.locator('form[data-intake]').evaluate((form: HTMLFormElement) => form.noValidate),
    ).toBe(true);
    const policy = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute('content');
    expect(policy).toMatch(/frame-src https:\/\/challenges\.cloudflare\.com/);
    const directive = (name: string) =>
      policy!
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `)) ?? '';
    expect(directive('script-src')).not.toContain('unsafe-inline');
    expect(directive('style-src')).not.toContain('unsafe-inline');
    expect(directive('style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
  });

  test('other pages do not allow Turnstile', async ({ page }) => {
    await page.goto('/process/');
    const policy = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute('content');
    expect(policy).not.toContain('challenges.cloudflare.com');
  });

  test('a script the site did not ship is refused', async ({ page }) => {
    await page.goto('/');
    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__injected = true';
      document.body.append(script);
      return (window as unknown as { __injected?: boolean }).__injected === true;
    });
    expect(ran).toBe(false);
    expect(await violations(page)).toContainEqual(expect.stringMatching(/^script-src/));
  });
});
