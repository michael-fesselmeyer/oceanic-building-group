// Every built page carries exactly one JSON-LD block with exactly one business.
// Nested pages (a project, a service, a town) also carry breadcrumbs that end
// at the page itself, and project pages describe their main photograph.
// Pages are found in the build output, so new pages are covered without
// editing this file.
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
// Pages that sit one level below a section index.
const nested = /^\/(portfolio|services|areas)\/[^/]+\/$/;
// Portfolio category pages are filters of the index, not nested pages.
const filters = new Set([
  '/portfolio/custom-homes/',
  '/portfolio/renovations/',
  '/portfolio/commercial/',
  '/portfolio/under-construction/',
]);

interface Node {
  '@type': string;
  [key: string]: unknown;
}

test('the build has pages to check', () => {
  expect(pages).toContain('/');
  expect(pages.some((path) => nested.test(path) && !filters.has(path))).toBe(true);
});

for (const path of pages) {
  test(`${path} carries one business and the right breadcrumbs`, async ({ page }) => {
    await page.goto(path);
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(1);

    const data = JSON.parse((await scripts.textContent()) ?? '');
    expect(data['@context']).toBe('https://schema.org');
    const nodes: Node[] = data['@graph'];
    const ofType = (type: string) => nodes.filter((node) => node['@type'] === type);

    const [business] = ofType('GeneralContractor');
    expect(ofType('GeneralContractor')).toHaveLength(1);
    expect(business).toMatchObject({
      name: expect.any(String),
      url: expect.stringMatching(/^https:\/\//),
    });
    expect(JSON.stringify(data)).not.toMatch(/"(null|undefined)"|:null/);
    expect(ofType('WebSite')).toHaveLength(path === '/' ? 1 : 0);

    const hasTrail = nested.test(path) && !filters.has(path);
    const trails = ofType('BreadcrumbList');
    expect(trails).toHaveLength(hasTrail ? 1 : 0);
    if (hasTrail) {
      const items = trails[0]!.itemListElement as {
        position: number;
        name: string;
        item: string;
      }[];
      expect(items[0]).toMatchObject({ position: 1, name: 'Home' });
      // The trail ends at this page, and every step is an absolute address.
      expect(new URL(items.at(-1)!.item).pathname).toBe(path);
      expect(items.map((step) => step.position)).toEqual(items.map((_, index) => index + 1));
      for (const step of items) expect(step.item).toMatch(/^https:\/\//);
    }

    const isProject = path.startsWith('/portfolio/') && hasTrail;
    const webPages = ofType('WebPage');
    expect(webPages).toHaveLength(isProject ? 1 : 0);
    if (isProject) {
      const photo = webPages[0]!.primaryImageOfPage as { url: string; width: number };
      expect(photo.url).toMatch(/^https:\/\//);
      expect(photo.width).toBeGreaterThan(0);
      // The address names the production host; the file must be in this build.
      const response = await page.request.get(new URL(photo.url).pathname);
      expect(response.ok(), `${photo.url} should exist`).toBe(true);
    }
  });
}
