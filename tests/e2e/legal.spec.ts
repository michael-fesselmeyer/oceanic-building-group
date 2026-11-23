import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { path: '/privacy/', heading: 'Privacy Policy', footerLink: 'Privacy Policy' },
  { path: '/terms/', heading: 'Terms of Use', footerLink: 'Terms of Use' },
];

for (const { path, heading, footerLink } of pages) {
  test.describe(`${path} page`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test('has one main heading and a matching title', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page).toHaveTitle(new RegExp(`^${heading} \\| Oceanic Building Group`));
    });

    test('shows when it was last updated', async ({ page }) => {
      const updated = page.locator('time');
      await expect(updated).toHaveCount(1);
      await expect(updated).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    });

    test('lists every section in the contents and each link lands on a heading', async ({
      page,
    }) => {
      const links = page.getByRole('navigation', { name: `${heading} sections` }).getByRole('link');
      const targets = await links.evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute('href')?.slice(1) ?? ''),
      );
      const headingIds = await page
        .locator('h2')
        .evaluateAll((nodes) => nodes.map((node) => node.id));
      expect(targets.length).toBeGreaterThan(0);
      expect(targets).toEqual(headingIds);
    });

    test('is linked from the footer', async ({ page }) => {
      const link = page
        .getByRole('contentinfo')
        .getByRole('navigation', { name: 'Legal' })
        .getByRole('link', { name: footerLink });
      await expect(link).toHaveAttribute('href', path);
    });

    test('has no accessibility violations', async ({ page }) => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('never scrolls sideways', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('unknown business facts never show as placeholders', async ({ page }) => {
  await page.goto('/privacy/');
  const text = await page.locator('article').innerText();
  expect(text).not.toMatch(/null|undefined/);
});
