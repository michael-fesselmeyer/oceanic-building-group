// The gallery lightbox on the style guide's project example, which has a
// three-photograph gallery. Real projects have no galleries yet.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = '/style-guide/project/';

const links = (page: Page) => page.locator('[data-gallery] [data-gallery-link]');
const dialog = (page: Page) => page.locator('dialog[data-lightbox]');
const count = (page: Page) => page.locator('[data-lightbox-count]');

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('each photograph links to a large version and the overlay stays closed', async ({
    page,
    request,
  }) => {
    await page.goto(PAGE);
    await expect(links(page)).toHaveCount(3);
    await expect(dialog(page)).toBeHidden();

    for (const link of await links(page).all()) {
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^\/_astro\/.+\.webp$/);
      const response = await request.get(href!);
      expect(response.ok(), `${href} should exist`).toBe(true);
      expect(response.headers()['content-type']).toMatch(/^image\//);
      await expect(link.locator('img')).toHaveAttribute('alt', /.{10,}/);
    }
  });
});

test.describe('with JavaScript', () => {
  test('loads no large image until a photograph is opened, then shows it with its alt text', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    await page.goto(PAGE);

    const first = links(page).first();
    const href = (await first.getAttribute('href'))!;
    await expect(dialog(page)).toBeHidden();
    await expect(dialog(page).locator('img')).not.toHaveAttribute('src', /.+/);
    expect(requested).not.toContain(href);

    await first.click();
    await expect(dialog(page)).toBeVisible();
    const large = dialog(page).locator('img');
    await expect(large).toHaveAttribute('src', new RegExp(`${href}$`));
    await expect(large).toHaveAttribute(
      'alt',
      (await first.locator('img').getAttribute('alt')) ?? '',
    );
    await expect(count(page)).toHaveText('Photo 1 of 3');
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  });

  test('the arrow keys move between photographs and wrap around', async ({ page }) => {
    await page.goto(PAGE);
    await links(page).nth(1).click();
    await expect(count(page)).toHaveText('Photo 2 of 3');

    await page.keyboard.press('ArrowRight');
    await expect(count(page)).toHaveText('Photo 3 of 3');
    await page.keyboard.press('ArrowRight');
    await expect(count(page)).toHaveText('Photo 1 of 3');
    await page.keyboard.press('ArrowLeft');
    await expect(count(page)).toHaveText('Photo 3 of 3');

    // The overlay shows the photograph named in the count, with that photograph's alt text.
    const alt = await links(page).nth(2).locator('img').getAttribute('alt');
    await expect(dialog(page).locator('img')).toHaveAttribute('alt', alt!);
  });

  test('the buttons move and close, and are big enough to touch', async ({ page }) => {
    await page.goto(PAGE);
    await links(page).first().click();

    for (const name of ['Previous photograph', 'Next photograph', 'Close']) {
      const button = dialog(page).getByRole('button', { name });
      await expect(button).toBeVisible();
      // Measured with a retry: the overlay may still be settling on the first frame.
      await expect
        .poll(async () => (await button.boundingBox())?.width, { message: name })
        .toBeGreaterThanOrEqual(44);
      await expect
        .poll(async () => (await button.boundingBox())?.height, { message: name })
        .toBeGreaterThanOrEqual(44);
    }

    await dialog(page).getByRole('button', { name: 'Next photograph' }).click();
    await expect(count(page)).toHaveText('Photo 2 of 3');
    await dialog(page).getByRole('button', { name: 'Previous photograph' }).click();
    await expect(count(page)).toHaveText('Photo 1 of 3');
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test('Escape closes, frees the large image and returns focus to the photograph that opened it', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const opener = links(page).nth(2);
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();

    // Focus is inside the overlay, not on the page behind it.
    await expect(dialog(page).getByRole('button', { name: 'Previous photograph' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(dialog(page).locator('img')).not.toHaveAttribute('src', /.+/);
  });

  test('a swipe moves to the next and previous photograph', async ({ page }) => {
    await page.goto(PAGE);
    await links(page).first().click();
    // Measure once the photograph is in, so the area is the one a visitor sees.
    await expect
      .poll(() =>
        dialog(page)
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    const box = (await dialog(page).locator('[data-lightbox-stage]').boundingBox())!;
    const y = box.y + box.height / 2;
    const swipe = async (from: number, to: number) => {
      await page.mouse.move(from, y);
      await page.mouse.down();
      await page.mouse.move(to, y, { steps: 4 });
      await page.mouse.up();
    };

    await swipe(box.x + 300, box.x + 100);
    await expect(count(page)).toHaveText('Photo 2 of 3');
    await swipe(box.x + 100, box.x + 300);
    await expect(count(page)).toHaveText('Photo 1 of 3');
  });

  test("carries the photograph's caption into the overlay when it has one", async ({ page }) => {
    await page.goto(PAGE);
    // The example gallery has no captions; give the second item one the way markup would.
    await page.evaluate(() => {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = 'The entry staircase';
      document.querySelectorAll('[data-gallery-item]')[1]!.append(figcaption);
    });

    await links(page).first().click();
    await expect(dialog(page).locator('[data-lightbox-caption]')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(dialog(page).locator('[data-lightbox-caption]')).toHaveText('The entry staircase');
  });

  test('has no accessibility violations while open', async ({ page }) => {
    await page.goto(PAGE);
    await links(page).first().click();
    await expect(dialog(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
