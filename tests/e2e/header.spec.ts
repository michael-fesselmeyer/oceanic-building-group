import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// The header has three looks: transparent with white text over the home page's photograph,
// solid navy-on-white once that photograph has scrolled away, and solid everywhere on pages
// that open without a photograph.

/** The painted color of an element's property as [r, g, b, a], whatever notation CSS returns. */
async function paint(page: Page, selector: string, property: 'color' | 'backgroundColor') {
  return page
    .locator(selector)
    .first()
    .evaluate((el, prop) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(el)[prop as 'color'];
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }, property);
}

const isWhite = ([r, g, b]: number[]) => r > 250 && g > 250 && b > 250;
const isDark = ([r, g, b]: number[]) => r < 60 && g < 80 && b < 120;

/** Scrolls until the first element in <main> (the hero) has fully left the screen. */
const scrollPastHero = (page: Page) =>
  page.evaluate(() => {
    const hero = document.querySelector('main > :first-child')!;
    window.scrollTo(0, hero.getBoundingClientRect().bottom + window.scrollY + 40);
  });

test.describe('header over the home page hero', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    test.skip(
      !(await page.evaluate(() => CSS.supports('animation-timeline', '--hero'))),
      'needs scroll-driven animations',
    );
  });

  test('is transparent with white text at the top of the page', async ({ page }) => {
    // The scroll-driven animation takes effect on the first frame, so poll rather than read once.
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBe(0);
    await expect.poll(async () => isWhite(await paint(page, '.home-link', 'color'))).toBe(true);
    await expect.poll(async () => isWhite(await paint(page, '.site-nav li a', 'color'))).toBe(true);
  });

  test('draws a scrim behind the header text', async ({ page }) => {
    // Like the colors above, the scrim follows the scroll-driven animation, which WebKit applies
    // from its first animation frame rather than at load: poll instead of reading once.
    await expect
      .poll(async () =>
        Number(
          await page
            .locator('.site-header')
            .evaluate((el) => getComputedStyle(el, '::before').opacity),
        ),
      )
      .toBe(1);
  });

  test('turns solid navy on white once the hero has scrolled away', async ({ page }) => {
    await scrollPastHero(page);
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBeGreaterThanOrEqual(230);
    expect(isDark(await paint(page, '.home-link', 'color'))).toBe(true);
    expect(isDark(await paint(page, '.site-nav li a', 'color'))).toBe(true);
    const opacity = await page
      .locator('.site-header')
      .evaluate((el) => getComputedStyle(el, '::before').opacity);
    expect(Number(opacity)).toBe(0);
  });

  test('goes back to transparent when scrolling to the top again', async ({ page }) => {
    await scrollPastHero(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBe(0);
  });

  test('has no accessibility violations at the top and scrolled', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await scrollPastHero(page);
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBeGreaterThanOrEqual(230);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('switches in one step when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const halfway = await page.evaluate(() => {
      const hero = document.querySelector('main > :first-child')!;
      const header = document.querySelector('.site-header')!.getBoundingClientRect();
      // The hero's bottom edge one header-height below the header's own bottom edge: mid-fade.
      window.scrollTo(
        0,
        hero.getBoundingClientRect().bottom + window.scrollY - header.height * 1.5,
      );
      return true;
    });
    expect(halfway).toBe(true);
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBe(0);
  });
});

test.describe('header on a page without a hero', () => {
  test('is solid at the top and keeps the page below it', async ({ page }) => {
    await page.goto('/privacy/');
    expect((await paint(page, '.site-header', 'backgroundColor'))[3]).toBeGreaterThanOrEqual(230);
    expect(isDark(await paint(page, '.home-link', 'color'))).toBe(true);
    // It stays in the flow, so the heading starts below it instead of underneath.
    const position = await page
      .locator('.site-header')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });
});

test.describe('current page marker', () => {
  test('marks nothing in the main navigation on the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-nav [aria-current]')).toHaveCount(0);
    await expect(page.locator('.home-link')).toHaveAttribute('aria-current', 'page');
  });

  test('marks only the link of the page being shown, wherever the page exists', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('.site-nav li a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      if (!(await request.get(href)).ok()) continue; // not built yet
      await page.goto(href);
      const marked = page.locator('.site-nav [aria-current]');
      await expect(marked).toHaveCount(1);
      await expect(marked).toHaveAttribute('href', href);
      await expect(marked).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.home-link')).not.toHaveAttribute('aria-current', /.+/);
      // Not color alone: the marked link carries a thicker underline than the others.
      const thickness = (selector: string) =>
        page
          .locator(selector)
          .first()
          .evaluate((el) => getComputedStyle(el).textDecorationThickness);
      expect(await thickness('.site-nav [aria-current]')).not.toBe(
        await thickness('.site-nav li a:not([aria-current])'),
      );
    }
  });
});

test.describe('phone menu', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.isMobile, 'the menu button only shows on small screens');
    await page.goto('/');
  });

  test('opens, closes on Escape and on a tap outside, and reads well over the hero', async ({
    page,
  }) => {
    const menu = page.getByRole('navigation', { name: 'Main' });
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(menu).toBeVisible();

    // Opened over the hero, the bar turns solid so it and the sheet read as one piece.
    expect((await paint(page, '.site-header', 'backgroundColor'))[3]).toBeGreaterThanOrEqual(230);
    expect(isDark(await paint(page, '.menu-button', 'color'))).toBe(true);
    expect(isDark(await paint(page, '.site-nav li a', 'color'))).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(menu).toBeVisible();
    await page.mouse.click(400, 600);
    await expect(menu).toBeHidden();
    // Back to the transparent bar.
    await expect
      .poll(async () => (await paint(page, '.site-header', 'backgroundColor'))[3])
      .toBe(0);
  });
});

test.describe('phone menu without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still opens and closes', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.isMobile, 'the menu button only shows on small screens');
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'Main' });
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });
});

test.describe('phone menu without popover support', () => {
  // Older browsers (Safari before 17) know neither the popover attribute nor :popover-open, so
  // they drop every rule behind `@supports selector(:popover-open)`. Recreate that here: remove
  // the attribute and those rules (and the scroll-timeline ones, which such browsers lack too).
  test('shows every link under the wordmark, with no dead Menu button', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.use.isMobile, 'the menu button only shows on small screens');
    await page.goto('/');
    const removed = await page.evaluate(() => {
      document.querySelector('#site-menu')!.removeAttribute('popover');
      let count = 0;
      const strip = (list: CSSRuleList) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const rule = list[i];
          if (
            rule instanceof CSSSupportsRule &&
            /popover-open|animation-timeline|view-timeline/.test(rule.conditionText)
          ) {
            const parent = rule.parentRule as CSSGroupingRule | null;
            if (parent) parent.deleteRule(i);
            else rule.parentStyleSheet!.deleteRule(i);
            count++;
          } else if ('cssRules' in rule) {
            strip((rule as CSSGroupingRule).cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) strip(sheet.cssRules);
      return count;
    });
    expect(removed).toBeGreaterThan(0);

    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const link of await nav.getByRole('link').all()) await expect(link).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
