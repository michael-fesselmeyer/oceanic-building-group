import { expect, type Page, test } from '@playwright/test';

// A page that opens with a photograph preloads that photograph's AVIF sources ahead of the font
// preloads, so the photograph is not kept waiting behind the fonts. The preloads must ask for
// exactly the files the page's <source> elements ask for, or the browser downloads the
// photograph twice. The browser tests run on a build with the draft projects, so the home page
// opens with a featured project's photograph.

const projectLink = /^\/portfolio\/[^/]+\/$/;

/** The head's image preloads and the AVIF sources of the page's first photograph. */
const heroImages = (page: Page) =>
  page.evaluate(() => {
    const preloads = [...document.head.querySelectorAll('link[rel="preload"][as="image"]')].map(
      (link) => ({
        srcset: link.getAttribute('imagesrcset'),
        sizes: link.getAttribute('imagesizes'),
        media: link.getAttribute('media'),
        type: link.getAttribute('type'),
        priority: link.getAttribute('fetchpriority'),
      }),
    );
    const picture = document.querySelector('main picture');
    const sources = [...(picture?.querySelectorAll('source[type="image/avif"]') ?? [])].map(
      (source) => ({
        srcset: source.getAttribute('srcset'),
        sizes: source.getAttribute('sizes'),
        media: source.getAttribute('media'),
      }),
    );
    const headLinks = [...document.head.querySelectorAll('link[rel="preload"]')];
    const firstFont = headLinks.findIndex((link) => link.getAttribute('as') === 'font');
    const lastImage = headLinks.findLastIndex((link) => link.getAttribute('as') === 'image');
    return { preloads, sources, imagesBeforeFonts: firstFont === -1 || lastImage < firstFont };
  });

async function expectPreloadedHero(page: Page, path: string) {
  const heroFiles = new Set<string>();
  page.on('request', (request) => {
    if (request.resourceType() === 'image') heroFiles.add(new URL(request.url()).pathname);
  });
  await page.goto(path);
  const { preloads, sources, imagesBeforeFonts } = await heroImages(page);

  expect(preloads.length).toBeGreaterThan(0);
  expect(imagesBeforeFonts).toBe(true);
  // One preload per AVIF source, asking for the same files at the same sizes.
  expect(preloads.map(({ srcset, sizes, media }) => ({ srcset, sizes, media }))).toEqual(sources);
  for (const preload of preloads) {
    expect(preload.type).toBe('image/avif');
    expect(preload.priority).toBe('high');
  }

  // Whatever the browser picked, it fetched that photograph once, not once per address.
  // decode() can reject while the browser is still switching to the source it picked, so it is
  // retried until the photograph it settles on has decoded.
  await expect
    .poll(() =>
      page
        .locator('main picture img')
        .first()
        .evaluate((img: HTMLImageElement) =>
          img.decode().then(
            () => true,
            () => false,
          ),
        ),
    )
    .toBe(true);
  const shown = new URL(
    await page
      .locator('main picture img')
      .first()
      .evaluate((img: HTMLImageElement) => img.currentSrc),
  ).pathname;
  const candidates = preloads.flatMap(({ srcset }) =>
    (srcset ?? '').split(',').map((entry) => entry.trim().split(/\s+/)[0]),
  );
  const fetchedCandidates = [...heroFiles].filter((file) => candidates.includes(file));
  if (shown.endsWith('.avif')) expect(fetchedCandidates).toEqual([shown]);
  else expect(fetchedCandidates.length).toBeLessThanOrEqual(1);
}

test.describe('the photograph a page opens with', () => {
  test('is preloaded on the home page', async ({ page }) => {
    await expectPreloadedHero(page, '/');
  });

  test('is preloaded on the portfolio', async ({ page }) => {
    await expectPreloadedHero(page, '/portfolio/');
  });

  test('is preloaded on a project page', async ({ page }) => {
    await page.goto('/portfolio/');
    const href = await page
      .locator('main a[href^="/portfolio/"]')
      .evaluateAll(
        (links, pattern) =>
          links
            .map((link) => link.getAttribute('href')!)
            .find(
              (href) =>
                new RegExp(pattern).test(href) &&
                !/\/(custom-homes|renovations|commercial|under-construction)\/$/.test(href),
            ),
        projectLink.source,
      );
    expect(href).toBeTruthy();
    await expectPreloadedHero(page, href!);
  });

  test('is not preloaded on a page that opens with text', async ({ page }) => {
    await page.goto('/about/');
    expect((await heroImages(page)).preloads).toEqual([]);
  });
});
