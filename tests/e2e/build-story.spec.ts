import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// "How it was built" on a finished project's page, checked on the style guide's made-up projects:
//   /style-guide/project/              completed, five photographed updates out of order, one
//                                      more without a photograph
//   /style-guide/project/short-story/  completed, only two photographed updates
//   /style-guide/project/progress/     under construction, three photographed updates
//   /style-guide/project/sparse/       under construction, no updates
// The audit fixture (/portfolio/audit-example/) is the first of these, so Lighthouse measures it.

const PAGE = '/style-guide/project/';
const SECTION = 'How it was built';

const story = (page: Page) => page.getByRole('region', { name: SECTION });
const stages = (page: Page) =>
  story(page)
    .getByRole('list', { name: 'How Example Riverfront Residence was built' })
    .getByRole('listitem');

const supportsStory = (page: Page) =>
  page.evaluate(
    () => CSS.supports('animation-timeline', 'view()') && CSS.supports('timeline-scope', '--stage'),
  );

/** Opacity of each stage's photograph, in list order. */
const photoOpacity = (page: Page) =>
  page
    .locator('.build-band .stage-photo')
    .evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).opacity)));

test.describe('a finished project with enough progress photographs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('has headings in order, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(story(page).getByRole('heading', { level: 2 })).toHaveText(SECTION);
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
    await story(page).scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('follows the gallery and tells the photographed stages oldest first', async ({ page }) => {
    const followsGallery = await page.evaluate(() => {
      const gallery = document.querySelector('.gallery-band');
      const build = document.querySelector('.build-band');
      return Boolean(
        gallery &&
        build &&
        gallery.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
    expect(followsGallery).toBe(true);

    await expect(stages(page)).toHaveCount(5);
    await expect(stages(page).locator('time')).toHaveText([
      'March 14, 2023',
      'June 8, 2023',
      'September 21, 2023',
      'September 21, 2023',
      'February 16, 2024',
    ]);
    await expect(stages(page).locator('time').first()).toHaveAttribute('datetime', '2023-03-14');
    // Same-day stages keep their order in the file; the update without a photograph is left out.
    await expect(stages(page).locator('.caption')).toHaveText([
      'Site cleared, pilings driven and the slab poured.',
      'Block walls up on the first floor and the tie beam poured.',
      'Roof dried in and the impact windows set.',
      'Dock pilings set along the seawall.',
      'Landscaping finished and the keys handed over.',
    ]);
    await expect(story(page).getByText('Drywall hung on both floors.')).toHaveCount(0);
    // Progress belongs to projects under construction; a finished one shows none.
    await expect(page.getByRole('region', { name: 'Construction progress' })).toHaveCount(0);
  });

  test('gives every photograph real alt text, responsive sources and lazy loading', async ({
    page,
  }) => {
    const images = stages(page).locator('img');
    await expect(images).toHaveCount(5);
    await expect(images.first()).toHaveAttribute(
      'alt',
      'Placeholder for a photograph of the poured slab on the cleared lot',
    );
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('alt', /.{10,}/);
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('sizes', /.+/);
    }
    const sources = stages(page).locator('picture source[srcset]');
    expect(await sources.count()).toBeGreaterThanOrEqual(5);
    // Each photograph is captioned by its own date and words.
    await expect(stages(page).locator('figure figcaption')).toHaveCount(5);
  });

  test('on a wide screen, keeps the photograph in view and brings each one forward in turn', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'phones get the plain sequence');
    test.skip(!(await supportsStory(page)), 'needs scroll-driven animations');

    const photos = page.locator('.build-band .stage-photo');
    const captions = page.locator('.build-band figcaption .text');
    await captions.first().scrollIntoViewIfNeeded();
    // The photographs share one place.
    const tops = await photos.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    // Only the first is showing while its own caption is beside it.
    await expect.poll(() => photoOpacity(page)).toEqual([1, 0, 0, 0, 0]);

    // Scroll the third caption to the middle of the photograph: its photograph is in front.
    const scrollCaptionTo = (index: number) =>
      captions.nth(index).evaluate((el) => {
        const photo = document.querySelector('.build-band .stage-photo')!.getBoundingClientRect();
        const text = el.getBoundingClientRect();
        window.scrollBy(0, text.top + text.height / 2 - (photo.top + photo.height / 2));
      });
    await scrollCaptionTo(2);
    await expect.poll(async () => (await photoOpacity(page))[2]).toBe(1);
    await expect.poll(async () => (await photoOpacity(page))[3]).toBe(0);
    const stillTogether = await photos.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(stillTogether).size).toBe(1);
    expect(stillTogether[0]).toBeGreaterThanOrEqual(0);

    // Scrolling back sends it away again.
    await scrollCaptionTo(0);
    await expect.poll(async () => (await photoOpacity(page))[2]).toBe(0);
  });

  test('on a phone, is a plain sequence of photograph and caption pairs', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'wide screens tell it in place');
    await expectPlainSequence(page);
  });

  test('the motion sits behind the feature check and the motion preference', async ({ page }) => {
    const rules = await page.evaluate(() => {
      const found: string[][] = [];
      const walk = (list: CSSRuleList, conditions: string[]) => {
        for (const rule of Array.from(list)) {
          if (
            rule instanceof CSSStyleRule &&
            (rule.style.animationName.includes('stage-forward') ||
              rule.style.position === 'sticky') &&
            rule.selectorText.includes('stage-photo')
          ) {
            found.push(conditions);
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
    for (const conditions of rules) {
      expect(conditions.some((c) => c.includes('animation-timeline'))).toBe(true);
      expect(conditions.some((c) => c.includes('prefers-reduced-motion: no-preference'))).toBe(
        true,
      );
    }
  });
});

/** Every photograph is shown, in the page flow, above or beside its own caption. */
async function expectPlainSequence(page: Page) {
  await expect.poll(() => photoOpacity(page)).toEqual([1, 1, 1, 1, 1]);
  const layout = await page.locator('.build-band .stage').evaluateAll((items) =>
    items.map((item) => {
      const photo = item.querySelector('.stage-photo')!;
      const caption = item.querySelector('figcaption')!.getBoundingClientRect();
      const box = photo.getBoundingClientRect();
      return {
        position: getComputedStyle(photo).position,
        animation: getComputedStyle(photo).animationName,
        top: box.top + window.scrollY,
        captionTop: caption.top + window.scrollY,
        bottom: box.bottom + window.scrollY,
      };
    }),
  );
  for (const [index, stage] of layout.entries()) {
    expect(stage.position).toBe('static');
    expect(stage.animation).toBe('none');
    expect(stage.captionTop).toBeGreaterThanOrEqual(stage.top);
    if (index > 0) expect(stage.top).toBeGreaterThanOrEqual(layout[index - 1]!.bottom);
  }
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('is a plain sequence on every screen, with every photograph showing', async ({ page }) => {
    await page.goto(PAGE);
    await expectPlainSequence(page);
    const results = await new AxeBuilder({ page }).include('.build-band').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('pages without a build story', () => {
  for (const [path, why] of [
    ['/style-guide/project/short-story/', 'a finished project with only two progress photographs'],
    ['/style-guide/project/progress/', 'a project still under construction'],
    ['/style-guide/project/sparse/', 'a project with no progress updates'],
  ] as const) {
    test(`${why} has none`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(story(page)).toHaveCount(0);
      await expect(page.locator('.build-band')).toHaveCount(0);
    });
  }

  test('the under-construction page still lists its progress newest first', async ({ page }) => {
    await page.goto('/style-guide/project/progress/');
    const updates = page
      .getByRole('region', { name: 'Construction progress' })
      .getByRole('listitem');
    await expect(updates.locator('time').first()).toHaveText('March 20, 2026');
  });
});
