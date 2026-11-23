import { expect, type Page, test } from '@playwright/test';

// The footer keeps one section gap above itself. A page that also ends with that gap doubles it,
// which reads as a blank band before the footer. One page of each type is checked here.

const pages = [
  '/about/',
  '/process/',
  '/interior-design/',
  '/contact/',
  '/contact/thanks/',
  '/portfolio/',
  '/portfolio/custom-homes/',
  '/services/',
  '/services/custom-homes/',
  '/areas/',
  '/areas/jupiter/',
  '/privacy/',
  '/404.html',
  '/',
];

/**
 * The space between the lowest thing a visitor can see in the main content (text, an image, a
 * form control, a filled or bordered box) and the top of the footer, and the footer's own margin.
 */
const footerSpace = (page: Page) =>
  page.evaluate(() => {
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    };
    const drawn = (el: Element) => {
      const style = getComputedStyle(el);
      const filled = !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor);
      const bordered = parseFloat(style.borderBottomWidth) > 0;
      return (
        filled || bordered || el.matches('img, picture, video, input, textarea, select, button')
      );
    };

    let lowest = 0;
    const main = document.querySelector('main')!;
    for (const el of main.querySelectorAll('*')) {
      if (!visible(el) || el.closest('script, style, template')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (drawn(el)) lowest = Math.max(lowest, box.bottom);
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        lowest = Math.max(lowest, range.getBoundingClientRect().bottom);
      }
    }

    const footer = document.querySelector('.site-footer')!;
    const footerTop = footer.getBoundingClientRect().top;
    const footerMargin = parseFloat(getComputedStyle(footer).marginTop);
    return { space: footerTop - lowest, footerMargin };
  });

// Room for the line spacing below the last line of text.
const lineSpacing = 40;

async function expectOneGap(page: Page) {
  const { space, footerMargin } = await footerSpace(page);
  expect(space).toBeGreaterThanOrEqual(0);
  expect(space).toBeLessThanOrEqual(footerMargin + lineSpacing);
}

test.describe('space above the footer', () => {
  for (const path of pages) {
    test(`${path} leaves one section gap at most`, async ({ page }) => {
      await page.goto(path);
      await expectOneGap(page);
    });
  }

  test('a project page leaves one section gap at most', async ({ page }) => {
    await page.goto('/portfolio/');
    const href = await page
      .locator('main a[href^="/portfolio/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute('href')!)
          .find(
            (href) =>
              !/^\/portfolio\/(custom-homes|renovations|commercial|under-construction)?\/?$/.test(
                href,
              ),
          ),
      );
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expectOneGap(page);
  });
});
