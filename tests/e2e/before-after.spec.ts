import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// The style guide's full example project has one before-and-after pair; the
// sparse example has none.

const fullExample = '/style-guide/project/';
const sparseExample = '/style-guide/project/sparse/';

/** How much of the "before" photograph shows, from its clip, as a percentage. */
const shownBefore = (page: Page) =>
  page.locator('.compare .side-before').evaluate((side) => {
    const width = side.getBoundingClientRect().width;
    // The computed clip reads like "inset(0px 50% 0px 0px)" or "inset(0px 612px 0px 0px)".
    const right = getComputedStyle(side).clipPath.match(/inset\(\S+ (-?[\d.]+)(px|%)/);
    if (!right) return 100;
    const hidden = right[2] === '%' ? (Number(right[1]) / 100) * width : Number(right[1]);
    return Math.round(((width - hidden) / width) * 100);
  });

test.describe('before and after', () => {
  test('shows each pair under its own heading, with both descriptions and the caption', async ({
    page,
  }) => {
    await page.goto(fullExample);
    const section = page.getByRole('region', { name: 'Before and after' });
    await expect(section).toBeVisible();
    const figure = section.locator('figure.compare');
    await expect(figure).toHaveCount(1);
    await expect(figure.getByRole('img', { name: /before the renovation/ })).toHaveCount(1);
    await expect(figure.getByRole('img', { name: /after the renovation/ })).toHaveCount(1);
    await expect(figure.locator('figcaption')).toHaveText(
      'The kitchen, opened up to the family room.',
    );
  });

  test('is left out of a project without pairs', async ({ page }) => {
    await page.goto(sparseExample);
    await expect(page.getByRole('region', { name: 'Before and after' })).toHaveCount(0);
  });

  test('moves the split with the keyboard', async ({ page }) => {
    await page.goto(fullExample);
    const range = page.getByRole('slider', { name: 'Show more of the before photograph' });
    await expect(range).toBeVisible();
    await expect(range).toHaveValue('50');
    await expect.poll(() => shownBefore(page)).toBe(50);

    await range.focus();
    await page.keyboard.press('End');
    await expect(range).toHaveValue('100');
    await expect(range).toHaveAttribute('aria-valuetext', '100% before');
    await expect.poll(() => shownBefore(page)).toBe(100);

    await page.keyboard.press('Home');
    await expect(range).toHaveValue('0');
    await expect.poll(() => shownBefore(page)).toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect(range).toHaveValue('1');
  });

  test('stacks the two photographs into one frame', async ({ page }) => {
    await page.goto(fullExample);
    const [before, after] = await Promise.all(
      ['.side-before', '.side-after'].map((side) =>
        page.locator(`.compare ${side}`).evaluate((el) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
          };
        }),
      ),
    );
    expect(before).toEqual(after);
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(fullExample);
    const results = await new AxeBuilder({ page }).include('.compare-band').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('before and after without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the pair side by side, labeled, with no slider', async ({ page }, testInfo) => {
    await page.goto(fullExample);
    const figure = page.locator('figure.compare');
    await expect(figure.getByRole('slider')).toHaveCount(0);
    await expect(figure.getByText('Before', { exact: true })).toBeVisible();
    await expect(figure.getByText('After', { exact: true })).toBeVisible();

    const before = await figure.locator('.side-before').boundingBox();
    const after = await figure.locator('.side-after').boundingBox();
    expect(before && after).toBeTruthy();
    // Beside each other on wide screens, one above the other on phones; never on top.
    if (testInfo.project.use.isMobile)
      expect(after!.y).toBeGreaterThanOrEqual(before!.y + before!.height);
    else expect(after!.x).toBeGreaterThanOrEqual(before!.x + before!.width);
  });
});
