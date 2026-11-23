import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The four service lines, as the site defines them.
const services = [
  { slug: 'custom-homes', title: 'Custom Homes', related: true },
  { slug: 'renovations', title: 'Renovations', related: true },
  { slug: 'commercial', title: 'Commercial Construction', related: true },
  { slug: 'investors', title: 'Investor Partnerships', related: false },
];

const noSidewaysScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('services overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services/');
  });

  test('has one main heading, a title and a description', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Services');
    await expect(page).toHaveTitle(/^Services \| Oceanic Building Group/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(50);
    expect(description?.length).toBeLessThanOrEqual(160);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://oceanicbuildinggroup.com/services/',
    );
  });

  test('introduces each service and links to its page', async ({ page }) => {
    for (const { slug, title } of services) {
      await expect(
        page.getByRole('heading', { level: 2 }).getByRole('link', { name: title }),
      ).toHaveAttribute('href', `/services/${slug}/`);
    }
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('never scrolls sideways', async ({ page }) => {
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
  });

  test('is in the main navigation', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Main"] a[href="/services/"]')).toHaveCount(1);
  });
});

for (const { slug, title, related } of services) {
  test.describe(`/services/${slug}/`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/services/${slug}/`);
    });

    test('has one main heading, its own title, description and canonical address', async ({
      page,
    }) => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(new RegExp(`^${title} \\| Oceanic Building Group`));
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://oceanicbuildinggroup.com/services/${slug}/`,
      );
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length).toBeGreaterThanOrEqual(50);
      expect(description?.length).toBeLessThanOrEqual(160);
    });

    test('lists every service, marking the current one', async ({ page }) => {
      const list = page.getByRole('navigation', { name: 'All services' });
      await expect(list.getByRole('link')).toHaveCount(services.length);
      await expect(list.locator('[aria-current="page"]')).toHaveText(title);
    });

    test('shows related projects only when there are some', async ({ page }) => {
      const section = page.getByRole('region', { name: 'Related projects' });
      if (!related) {
        // Investor partnerships have no project category of their own.
        await expect(section).toHaveCount(0);
        return;
      }
      const count = await section.count();
      if (count === 0) {
        // No empty heading or placeholder when the portfolio has nothing to show.
        await expect(page.getByText('Related projects')).toHaveCount(0);
        return;
      }
      const cards = section.getByRole('article');
      expect(await cards.count()).toBeGreaterThan(0);
      const hrefs = await cards
        .getByRole('heading', { level: 3 })
        .getByRole('link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      for (const href of hrefs) expect(href).toMatch(/^\/portfolio\/[a-z0-9-]+\/$/);
    });

    test('ends with a way to start a project', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Start a Project' }).last()).toHaveAttribute(
        'href',
        '/contact/',
      );
    });

    test('has no accessibility violations', async ({ page }) => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('never scrolls sideways', async ({ page }) => {
      expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
    });
  });
}
