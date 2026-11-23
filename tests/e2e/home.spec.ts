import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// The home page in CI is built without PUBLIC_SITE_LAUNCHED, so the draft projects are present
// and four of them are featured. The cases the real content does not have (nothing featured,
// a single featured project) are checked on the style guide's copies of the same sections.

const projectLink = /^\/portfolio\/[^/]+\/$/;

/** The header's background alpha (0 to 255), whatever color notation CSS returns. */
const headerAlpha = (page: Page) =>
  page.locator('.site-header').evaluate((el) => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.fillStyle = getComputedStyle(el).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3];
  });

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has one main heading and a descriptive title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle(/Oceanic Building Group/);
  });

  test('opens with the hero: headline, one call to action and the photograph', async ({ page }) => {
    const hero = page.locator('main > :first-child');
    await expect(hero).toHaveClass(/hero/);
    await expect(hero.getByRole('heading', { level: 1 })).toContainText('Jupiter');
    await expect(hero.getByRole('link', { name: 'Start a Project' })).toHaveAttribute(
      'href',
      '/contact/',
    );
    await expect(hero.locator('.button')).toHaveCount(1);

    const photo = hero.locator('.hero-photo img');
    await expect(photo).toHaveAttribute('loading', 'eager');
    await expect(photo).toHaveAttribute('fetchpriority', 'high');
    await expect(photo).toHaveAttribute('alt', /\S{10,}/);
  });

  test('serves a crop that suits the screen', async ({ page }, testInfo) => {
    const photo = page.locator('.hero-photo img');
    // decode() settles once the chosen source is loaded, so its own size can be read.
    const shape = await photo.evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      return img.naturalWidth / img.naturalHeight;
    });
    if (testInfo.project.name === 'phone') expect(shape).toBeLessThan(1);
    else expect(shape).toBeGreaterThan(1);
  });

  test('links every featured project to its page once', async ({ page }) => {
    const credit = page.locator('.hero .credit').getByRole('link');
    await expect(credit).toHaveAttribute('href', projectLink);

    const cards = page.locator('[data-featured-project]');
    expect(await cards.count()).toBeGreaterThan(0);
    const hrefs = [await credit.getAttribute('href')];
    for (const card of await cards.all()) {
      await expect(card.getByRole('link')).toHaveCount(1);
      hrefs.push(await card.getByRole('link').getAttribute('href'));
    }
    hrefs.forEach((href) => expect(href).toMatch(projectLink));
    expect(new Set(hrefs).size).toBe(hrefs.length);

    for (const href of hrefs) {
      expect((await page.request.get(href!)).status()).toBe(200);
    }
  });

  test('lays out the featured projects in varied sizes', async ({ page }) => {
    const widths = await page
      .locator('[data-featured-project]')
      .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  test('loads every image below the hero lazily', async ({ page }) => {
    const loading = await page
      .locator('main img')
      .evaluateAll((images) =>
        images.filter((img) => !img.closest('.hero')).map((img) => img.getAttribute('loading')),
      );
    expect(loading.length).toBeGreaterThan(0);
    loading.forEach((value) => expect(value).toBe('lazy'));
  });

  test('keeps the header transparent over the hero', async ({ page }) => {
    test.skip(
      !(await page.evaluate(() => CSS.supports('animation-timeline', '--hero'))),
      'needs scroll-driven animations',
    );
    await expect.poll(() => headerAlpha(page)).toBe(0);
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

  test('offers the navigation in a form that fits the screen', async ({ page }, testInfo) => {
    const menuButton = page.getByRole('button', { name: 'Menu' });
    const portfolioLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
      name: 'Portfolio',
    });

    if (testInfo.project.name === 'phone') {
      await expect(portfolioLink).toBeHidden();
      await menuButton.click();
      await expect(portfolioLink).toBeVisible();
    } else {
      await expect(menuButton).toBeHidden();
      await expect(portfolioLink).toBeVisible();
    }
  });
});

test.describe('home page sections with other content', () => {
  test('with nothing featured: a navy hero and no featured section', async ({ page }) => {
    await page.goto('/style-guide/home/none/');
    const hero = page.locator('main > :first-child');
    await expect(hero).toHaveClass(/no-photo/);
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Start a Project' })).toBeVisible();
    await expect(hero.locator('img, .credit')).toHaveCount(0);
    await expect(page.locator('.featured')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('with one featured project: the hero credits it and the list is left out', async ({
    page,
  }) => {
    await page.goto('/style-guide/home/one/');
    await expect(page.locator('.hero-photo img')).toHaveCount(1);
    await expect(page.locator('.hero .credit').getByRole('link')).toHaveAttribute(
      'href',
      projectLink,
    );
    await expect(page.locator('.featured')).toHaveCount(0);
  });

  test('with a long title and no location: the cards still fit', async ({ page }) => {
    await page.goto('/style-guide/home/');
    await expect(page.locator('[data-featured-project]')).toHaveCount(3);
    await expect(page.getByRole('link', { name: /Deliberately Long Title/ })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
