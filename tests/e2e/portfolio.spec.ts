import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The filters, as the site defines them. Which of them show in the filter bar
// depends on the published projects, so every test works for any content.
const filters = [
  { slug: 'custom-homes', title: 'Custom Homes', cardText: /Custom Home/i },
  { slug: 'renovations', title: 'Renovations', cardText: /Renovation/i },
  { slug: 'commercial', title: 'Commercial Projects', cardText: /Commercial/i },
  { slug: 'under-construction', title: 'Under Construction', cardText: /Under construction/i },
];

const cards = (page: Page) => page.getByRole('article');

test.describe('portfolio index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio/');
  });

  test('has one main heading and a title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio');
    await expect(page).toHaveTitle(/^Portfolio \| Oceanic Building Group/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://oceanicbuildinggroup.com/portfolio/',
    );
  });

  test('lists projects as cards that link to their pages, or shows an empty state', async ({
    page,
  }) => {
    const count = await cards(page).count();
    if (count === 0) {
      await expect(page.getByText('Projects will be published here soon.')).toBeVisible();
      return;
    }
    const hrefs = await cards(page)
      .getByRole('heading', { level: 2 })
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toHaveLength(count);
    for (const href of hrefs) expect(href).toMatch(/^\/portfolio\/[a-z0-9-]+\/$/);
    await expect(page.getByText(`${count} project${count === 1 ? '' : 's'}`)).toBeVisible();
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

  test('is in the main navigation', async ({ page }) => {
    // On phones the navigation sits behind the menu button, so check the markup.
    const link = page.locator('nav[aria-label="Main"] a[href="/portfolio/"]');
    await expect(link).toHaveAttribute('href', '/portfolio/');
  });
});

test.describe('filters', () => {
  test('are links in a filter bar, and only for filters that have projects', async ({ page }) => {
    await page.goto('/portfolio/');
    const bar = page.getByRole('navigation', { name: 'Filter projects' });
    const total = await cards(page).count();

    if ((await bar.count()) === 0) {
      // Hidden when no filter would narrow the list.
      return;
    }

    const links = bar.getByRole('link');
    await expect(links.first()).toHaveText('All projects');
    await expect(links.first()).toHaveAttribute('aria-current', 'page');
    await expect(bar.locator('[aria-current]')).toHaveCount(1);

    const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs.slice(1)) {
      const filter = filters.find((item) => href === `/portfolio/${item.slug}/`);
      expect(filter, `unknown filter link ${href}`).toBeDefined();

      // Filters are plain links: following one needs no script.
      await page.goto(href!);
      const shown = await cards(page).count();
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThanOrEqual(total);
      for (const text of await cards(page).allInnerTexts()) {
        expect(text).toMatch(filter!.cardText);
      }
      await expect(bar.locator('[aria-current="page"]')).toHaveAttribute('href', href!);
      await expect(bar.locator('[aria-current]')).toHaveCount(1);
    }
  });

  for (const { slug, title } of filters) {
    test.describe(`/portfolio/${slug}/`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/portfolio/${slug}/`);
      });

      test('has its own heading, title, description and canonical address', async ({ page }) => {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
        await expect(page).toHaveTitle(new RegExp(`^${title} \\| Oceanic Building Group`));
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://oceanicbuildinggroup.com/portfolio/${slug}/`,
        );
        const description = await page.locator('meta[name="description"]').getAttribute('content');
        expect(description?.length).toBeGreaterThanOrEqual(50);
        expect(description?.length).toBeLessThanOrEqual(160);
      });

      test('shows projects or an empty state with a way back', async ({ page }) => {
        if ((await cards(page).count()) > 0) return;
        await expect(page.getByRole('link', { name: 'See every project' })).toHaveAttribute(
          'href',
          '/portfolio/',
        );
        // A filter with no projects is never offered in the filter bar.
        await expect(
          page.getByRole('navigation', { name: 'Filter projects' }).locator(`a[href$="/${slug}/"]`),
        ).toHaveCount(0);
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
});
