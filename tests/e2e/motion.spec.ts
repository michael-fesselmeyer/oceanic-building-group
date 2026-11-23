import { expect, type Page, test } from '@playwright/test';

// Motion is CSS only (src/styles/motion.css): scroll-driven reveals for section headings and lazy
// photographs, and cross-document view transitions that carry a project photograph from its card
// to its page. Content must never stay hidden: not with reduced motion, and not in a browser
// without scroll-driven animations.

const opacity = (page: Page, selector: string, index: number) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((el) => Number(getComputedStyle(el).opacity));

/** Records whether the next page was revealed with a view transition (true or false). */
const recordTransition = (page: Page) =>
  page.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      (window as unknown as { transitioned: boolean }).transitioned = Boolean(
        (event as Event & { viewTransition?: unknown }).viewTransition,
      );
    });
  });

/** Waits until the current page has been revealed, then says whether it transitioned. */
const transitioned = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(() => typeof (window as { transitioned?: boolean }).transitioned))
    .toBe('boolean');
  return page.evaluate(() => (window as unknown as { transitioned: boolean }).transitioned);
};

/** Index of the first revealed element that starts well below the screen. */
const firstBelowFold = (page: Page) =>
  page
    .locator('[data-reveal]')
    .evaluateAll((els) =>
      els.findIndex((el) => el.getBoundingClientRect().top > window.innerHeight + 100),
    );

test.describe('scroll-driven reveals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio/');
    test.skip(
      !(await page.evaluate(() => CSS.supports('animation-timeline', 'view()'))),
      'needs scroll-driven animations',
    );
  });

  test('fade a photograph in as it scrolls into view', async ({ page }) => {
    const index = await firstBelowFold(page);
    expect(index).toBeGreaterThanOrEqual(0);
    // Hidden while below the screen: proves the reveal follows the page, not a box around it.
    await expect.poll(() => opacity(page, '[data-reveal]', index)).toBe(0);
    await page.locator('[data-reveal]').nth(index).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
    await expect.poll(() => opacity(page, '[data-reveal]', index)).toBe(1);
  });

  test('leave everything already on screen fully revealed', async ({ page }) => {
    // The style guide opens with section headings on the first screen.
    await page.goto('/style-guide/');
    const progress = await page
      .locator('[data-reveal]')
      .evaluateAll((els) =>
        els
          .filter((el) => el.getBoundingClientRect().bottom <= window.innerHeight)
          .flatMap((el) => el.getAnimations().map((a) => a.effect?.getComputedTiming().progress)),
      );
    expect(progress.length).toBeGreaterThan(0);
    progress.forEach((value) => expect(value).toBe(1));
  });

  test('never fade text, so its contrast holds while it is revealed', async ({ page }) => {
    await page.goto('/style-guide/');
    const textOpacity = await page
      .locator('[data-reveal="text"]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    expect(textOpacity.length).toBeGreaterThan(0);
    textOpacity.forEach((value) => expect(value).toBe('1'));
  });

  test('never touch the photograph a page opens with', async ({ page }) => {
    await page.goto(await page.locator('.project-card a').first().getAttribute('href')!);
    await expect(page.locator('.project .cover [data-reveal]')).toHaveCount(0);
  });
});

test.describe('without scroll-driven animations', () => {
  test('nothing starts hidden: every reveal rule sits behind @supports and the motion query', async ({
    page,
  }) => {
    await page.goto('/portfolio/');
    const rules = await page.evaluate(() => {
      const found: { selector: string; conditions: string[] }[] = [];
      const walk = (list: CSSRuleList, conditions: string[]) => {
        for (const rule of Array.from(list)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('data-reveal')) {
            found.push({ selector: rule.selectorText, conditions });
          }
          if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
            walk(rule.cssRules, [...conditions, rule.conditionText]);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, []);
      return found;
    });
    expect(rules.length).toBeGreaterThan(0);
    for (const { conditions } of rules) {
      expect(conditions.some((c) => c.includes('animation-timeline'))).toBe(true);
      expect(conditions.some((c) => c.includes('prefers-reduced-motion: no-preference'))).toBe(
        true,
      );
    }
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing animates and everything is visible from the start', async ({ page }) => {
    await page.goto('/portfolio/');
    const states = await page
      .locator('[data-reveal]')
      .evaluateAll((els) =>
        els.map((el) => [getComputedStyle(el).animationName, getComputedStyle(el).opacity]),
      );
    expect(states.length).toBeGreaterThan(0);
    states.forEach(([name, value]) => {
      expect(name).toBe('none');
      expect(value).toBe('1');
    });
  });

  test('pages change without a transition', async ({ page }) => {
    await recordTransition(page);
    await page.goto('/portfolio/');
    await page.locator('.project-card a').first().click();
    await page.waitForURL(/\/portfolio\/[^/]+\/$/);
    expect(await transitioned(page)).toBe(false);
  });
});

test.describe('page transitions', () => {
  test('carry the project photograph from its card to its page', async ({ page }) => {
    await recordTransition(page);
    await page.goto('/portfolio/');
    test.skip(
      !(await page.evaluate(() => 'onpagereveal' in window)),
      'needs cross-document view transitions',
    );

    const card = page.locator('.project-card').first();
    const name = await card
      .locator('.photo')
      .evaluate((el) => getComputedStyle(el).viewTransitionName);
    expect(name).toMatch(/^project-[a-z0-9-]+$/);

    await card.getByRole('link').click();
    await page.waitForURL(/\/portfolio\/[^/]+\/$/);
    expect(await transitioned(page)).toBe(true);
    await expect
      .poll(() =>
        page
          .locator('.project .cover .photo')
          .evaluate((el) => getComputedStyle(el).viewTransitionName),
      )
      .toBe(name);
  });

  test('give every project photograph on a page its own name', async ({ page }) => {
    for (const path of ['/', '/portfolio/', '/interior-design/']) {
      await page.goto(path);
      const names = await page
        .locator('main *')
        .evaluateAll((els) =>
          els
            .map((el) => getComputedStyle(el).viewTransitionName)
            .filter((name) => name.startsWith('project-')),
        );
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
