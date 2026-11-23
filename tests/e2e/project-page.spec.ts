import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The project page template is checked three ways:
//   - /style-guide/project/         a made-up project with every part filled in
//   - /style-guide/project/sparse/  a made-up project with only the required fields
//   - a real project page, whichever project file comes first
// The style guide pages exist because CI builds this job without
// PUBLIC_SITE_LAUNCHED, so drafts and development pages are present.

async function expectSharedBasics(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('project page with every part', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/project/');
  });

  test('has one main heading, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expectSharedBasics(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Example Riverfront Residence',
    );
  });

  test('shows the category, facts, stats and features', async ({ page }) => {
    const hero = page.locator('.project .hero');
    await expect(hero.locator('.kicker')).toHaveText('Custom Home');
    await expect(hero.getByText('Under construction')).toHaveCount(0);
    await expect(hero.locator('.facts dd')).toHaveText(['Jupiter', 'Coastal Contemporary', '2024']);
    await expect(hero.locator('.cover img')).toHaveAttribute('loading', 'eager');

    const stats = page.getByRole('definition').filter({ hasText: '5 full, 2 half' });
    await expect(stats).toBeVisible();

    const features = page.getByRole('region', { name: 'Features' }).getByRole('listitem');
    await expect(features).toHaveCount(5);
  });

  test('credits the design partner with a link to the interior design page', async ({ page }) => {
    const credit = page.getByRole('region', { name: 'Interiors' });
    await expect(credit.getByRole('link', { name: 'Example Interiors Studio' })).toHaveAttribute(
      'href',
      '/interior-design/',
    );
  });

  test('stacks the gallery and leaves the hooks the lightbox needs', async ({ page }) => {
    const gallery = page.locator('[data-gallery]');
    await expect(gallery).toHaveAttribute(
      'aria-label',
      'Photographs of Example Riverfront Residence',
    );

    const items = gallery.locator('[data-gallery-item]');
    await expect(items).toHaveCount(3);
    for (const [index, item] of (await items.all()).entries()) {
      await expect(item).toHaveAttribute('id', `photo-${index + 1}`);
      await expect(item).toHaveAttribute('data-gallery-index', String(index));
      await expect(item.locator('img')).toHaveAttribute('alt', /.{10,}/);
    }

    // One photograph per row: each item starts below the one before it.
    const boxes = await Promise.all((await items.all()).map((item) => item.boundingBox()));
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
    }

    // Wide photographs fill the column; the portrait one is never taller than the screen.
    const viewport = page.viewportSize()!;
    const [wide, portrait] = boxes;
    expect(portrait!.height).toBeLessThanOrEqual(viewport.height);
    expect(portrait!.width).toBeLessThanOrEqual(wide!.width);
  });

  test('links to the previous and next projects', async ({ page }) => {
    const pager = page.getByRole('navigation', { name: 'More projects' });
    await expect(pager.getByRole('link')).toHaveCount(2);
    await expect(pager.getByRole('link', { name: /Previous project/ })).toHaveAttribute(
      'href',
      '/portfolio/example-previous/',
    );
    await expect(pager.getByRole('link', { name: /Next project/ })).toHaveAttribute(
      'href',
      '/portfolio/example-next/',
    );
  });
});

test.describe('project page with only the required fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/project/sparse/');
  });

  test('has one main heading, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expectSharedBasics(page);
  });

  test('is labelled as under construction', async ({ page }) => {
    await expect(page.locator('.project .kicker')).toContainText('Under construction');
    await expect(page.locator('.project .kicker').getByText('Under construction')).toBeVisible();
  });

  test('leaves out every empty part instead of rendering empty wrappers', async ({ page }) => {
    const article = page.locator('article.project');
    await expect(article.locator('.facts')).toHaveCount(0);
    await expect(article.locator('dl.stat-list')).toHaveCount(0);
    await expect(article.locator('aside')).toHaveCount(0);
    await expect(article.locator('[data-gallery]')).toHaveCount(0);
    await expect(article.locator('.gallery-band')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'More projects' })).toHaveCount(0);
    await expect(article.locator('.story')).toContainText('A short story');
  });
});

// File names in src/content/projects become the page addresses. Templates
// start with "_" and are never built.
const projectsDir = join(process.cwd(), 'src', 'content', 'projects');
const projectIds = readdirSync(projectsDir)
  .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
  .map((name) => name.slice(0, -'.md'.length))
  .sort();

test.describe('a real project page', () => {
  test.skip(projectIds.length === 0, 'there are no project files yet');

  test('renders with its own share image and working neighbor links', async ({ page, request }) => {
    await page.goto(`/portfolio/${projectIds[0]}/`);
    await expectSharedBasics(page);
    await expect(page.locator('article.project .cover img')).toBeVisible();

    // Link previews show the cover, not the default brand card.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).not.toMatch(/og-default/);

    // While no design partner is set, no project shows a credit.
    await expect(page.getByRole('region', { name: 'Interiors' })).toHaveCount(0);

    for (const link of await page
      .getByRole('navigation', { name: 'More projects' })
      .getByRole('link')
      .all()) {
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^\/portfolio\/[^/]+\/$/);
      expect((await request.get(href!)).ok(), `${href} should exist`).toBe(true);
    }
  });
});
