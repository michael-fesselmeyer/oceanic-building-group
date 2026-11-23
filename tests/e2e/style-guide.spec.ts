import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The style guide exists in development and preview builds only. CI builds
// without PUBLIC_SITE_LAUNCHED for this job, so the page is present.
test.describe('style guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/');
  });

  test('has one main heading and stays out of search engines', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
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

  test('renders buttons as links or buttons', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Start a Project' }).first()).toHaveAttribute(
      'href',
      '/contact/',
    );
    await expect(page.getByRole('button', { name: 'Send enquiry' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  test('project cards link to their project page once each', async ({ page }) => {
    const cards = page.locator('.project-card');
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      const links = card.getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAttribute('href', /^\/portfolio\/[^/]+\/$/);
    }
  });

  test('leaves out empty parts instead of rendering empty wrappers', async ({ page }) => {
    // The card without a location has no location line.
    const noLocation = page.locator('.project-card', { hasText: 'Commercial Build-Out' });
    await expect(noLocation.locator('.location')).toHaveCount(0);

    // Two stat lists have values; the empty one renders nothing.
    await expect(page.locator('dl.stat-list')).toHaveCount(2);

    // Only the quote with an attribution has a caption.
    await expect(page.locator('.pull-quote')).toHaveCount(2);
    await expect(page.locator('.pull-quote figcaption')).toHaveCount(1);

    // Only the captioned photograph is wrapped in a figure.
    await expect(page.locator('figure.photo')).toHaveCount(1);
    await expect(page.locator('figure.photo figcaption')).not.toBeEmpty();
  });

  test('shows bathrooms the way visitors read them', async ({ page }) => {
    await expect(
      page.getByRole('definition').filter({ hasText: '5 full, 2 half' }).first(),
    ).toBeVisible();
  });
});
