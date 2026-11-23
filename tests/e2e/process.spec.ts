import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const stages = [
  'First meeting',
  'Plan and budget',
  'Design',
  'Permits and approvals',
  'Construction',
  'Finishes and interior design',
  'Handover',
];

test.describe('/process/ page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/process/');
  });

  test('has one main heading, a matching title and a search description', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our Process');
    await expect(page).toHaveTitle(/^Our Process \| Oceanic Building Group/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(50);
    expect(description?.length).toBeLessThanOrEqual(160);
  });

  test('lists the stages in order, numbered from one', async ({ page }) => {
    const items = page.getByRole('list').filter({ has: page.getByRole('heading', { level: 2 }) });
    const steps = items.first().getByRole('listitem');
    await expect(steps).toHaveCount(stages.length);
    await expect(steps.getByRole('heading', { level: 2 })).toHaveText(stages);
    const numerals = await steps.locator('.numeral').allInnerTexts();
    expect(numerals).toEqual(stages.map((_, index) => String(index + 1).padStart(2, '0')));
  });

  test('shows a duration only where one was supplied', async ({ page }) => {
    const durations = page.locator('.duration');
    await expect(durations).toHaveCount(1);
    const construction = page.getByRole('listitem').filter({
      has: page.getByRole('heading', { name: 'Construction', exact: true }),
    });
    await expect(construction.locator('.duration')).toContainText('11 to 12 months');
  });

  test('ends with a link to the contact page', async ({ page }) => {
    const closing = page.getByRole('region', { name: 'Start with a conversation' });
    await expect(closing.getByRole('link')).toHaveAttribute('href', '/contact/');
    const lastLink = page.locator('main a').last();
    await expect(lastLink).toHaveAttribute('href', '/contact/');
  });

  test('headings stay in order', async ({ page }) => {
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
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
