import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Construction progress, checked on the style guide's made-up projects:
//   /style-guide/project/progress/  under construction, four updates written out of order
//   /style-guide/project/sparse/    under construction, no updates
//   /style-guide/project/           completed
// No real project is under construction yet, so the style guide stands in.

const PAGE = '/style-guide/project/progress/';

test.describe('project page with progress updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('has one main heading, headings in order, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('lists the updates newest first, with their dates', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Construction progress' });
    await expect(section.getByText('Last updated March 20, 2026')).toBeVisible();

    const updates = section.getByRole('list', { name: 'Progress at Example Beach Road Residence' });
    const items = updates.getByRole('listitem');
    await expect(items).toHaveCount(4);
    await expect(items.locator('time')).toHaveText([
      'March 20, 2026',
      'March 20, 2026',
      'February 14, 2026',
      'January 12, 2026',
    ]);
    await expect(items.locator('time').first()).toHaveAttribute('datetime', '2026-03-20');
    await expect(items.locator('.caption')).toHaveText([
      'Pool shell excavated beside the covered loggia.',
      'Roof dried in and the impact windows set.',
      'Block walls up on both floors and the roof trusses delivered.',
      'Site cleared and the foundation poured.',
    ]);
    await expect(items.first()).toHaveAttribute('id', 'progress-1');
  });

  test('shows an update without a photograph as text only', async ({ page }) => {
    const textOnly = page.locator('#progress-3');
    await expect(textOnly.locator('img')).toHaveCount(0);
    await expect(textOnly.getByRole('link')).toHaveCount(0);
    await expect(page.locator('[data-gallery] [data-gallery-link]')).toHaveCount(3);
  });

  test('opens a progress photograph in the lightbox with its date and caption', async ({
    page,
  }) => {
    await page.locator('#progress-2 [data-gallery-link]').click();
    const dialog = page.locator('dialog[data-lightbox]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-lightbox-caption]')).toHaveText(
      'March 20, 2026. Roof dried in and the impact windows set.',
    );
    await expect(dialog.locator('[data-lightbox-count]')).toHaveText('Photo 2 of 3');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#progress-2 [data-gallery-link]')).toBeFocused();
  });
});

test.describe('pages without progress to show', () => {
  test('an under-construction project with no updates has no progress section', async ({
    page,
  }) => {
    await page.goto('/style-guide/project/sparse/');
    await expect(page.locator('.project .kicker')).toContainText('Under construction');
    await expect(page.getByRole('region', { name: 'Construction progress' })).toHaveCount(0);
    await expect(page.locator('.progress-band')).toHaveCount(0);
  });

  test('a completed project shows its gallery and no progress section', async ({ page }) => {
    await page.goto('/style-guide/project/');
    await expect(page.getByRole('region', { name: 'Construction progress' })).toHaveCount(0);
    await expect(page.locator('[data-gallery]')).toHaveCount(1);
  });
});

test('a project card says when an under-construction project was last updated', async ({
  page,
}) => {
  await page.goto('/style-guide/');
  const card = page.locator('.project-card').filter({ hasText: 'Under construction' });
  await expect(card.locator('.updated')).toHaveText('Updated February 10, 2026');
  await expect(card.locator('.updated time')).toHaveAttribute('datetime', '2026-02-10');
  await expect(page.locator('.project-card .updated')).toHaveCount(1);
});
