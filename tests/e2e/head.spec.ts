// Every built page must name its icons and an absolute share image, and every
// file those tags point to must exist. Pages are found in the build output,
// so new pages are covered without editing this file.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const clientDir = join(process.cwd(), 'dist', 'client');

function builtPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : builtPages(full);
    if (!entry.name.endsWith('.html')) return [];
    const path = `/${relative(clientDir, full).split(sep).join('/')}`;
    return [path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path];
  });
}

const pages = builtPages(clientDir);

test('the build has pages to check', () => {
  expect(pages).toContain('/');
});

for (const path of pages) {
  test(`${path} has a favicon set and an absolute share image`, async ({ page, request }) => {
    await page.goto(path);
    const head = page.locator('head');

    const links = {
      svgIcon: head.locator('link[rel="icon"][type="image/svg+xml"]'),
      pngIcon: head.locator('link[rel="icon"][type="image/png"]'),
      appleIcon: head.locator('link[rel="apple-touch-icon"]'),
      manifest: head.locator('link[rel="manifest"]'),
    };
    for (const link of Object.values(links)) {
      await expect(link).toHaveCount(1);
      const href = await link.getAttribute('href');
      const response = await request.get(href!);
      expect(response.ok(), `${href} should exist`).toBe(true);
    }

    const ogImage = await head.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/^https:\/\//);
    // The tag names the production address; the file must be in this build.
    const imageResponse = await request.get(new URL(ogImage!).pathname);
    expect(imageResponse.ok(), `${ogImage} should exist`).toBe(true);
  });
}
