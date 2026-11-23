import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has one main heading and a descriptive title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle(/Oceanic Building Group/);
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
