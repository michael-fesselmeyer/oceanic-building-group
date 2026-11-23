// Share tags per page type, read from the build output. Every page has an
// absolute 1200 x 630 share image with a description. Project pages use their
// own cover, a service uses its photograph once it has one, and every other
// page uses the default brand card. Pages are found in the build output, so
// new pages are covered without editing this file.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const clientDir = join(process.cwd(), 'dist', 'client');

function builtPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : builtPages(full);
    if (!entry.name.endsWith('.html')) return [];
    return [`/${relative(clientDir, full).split(sep).join('/')}`];
  });
}

/** The content of the first <meta> whose property or name is `key`. */
function meta(html: string, key: string): string | undefined {
  const tag = [...html.matchAll(/<meta\s[^>]*>/g)]
    .map((m) => m[0])
    .find((t) => t.includes(`property="${key}"`) || t.includes(`name="${key}"`));
  return tag?.match(/content="([^"]*)"/)?.[1];
}

const pages = builtPages(clientDir);
const portfolioFilters = ['custom-homes', 'renovations', 'commercial', 'under-construction'];
const isProject = (path: string) => {
  const [, section, slug, rest] = path.split('/');
  return (
    section === 'portfolio' && !!slug && !portfolioFilters.includes(slug) && rest === 'index.html'
  );
};
const isService = (path: string) => /^\/services\/[^/]+\/index\.html$/.test(path);

test('the build has every page type to check', () => {
  expect(pages).toContain('/index.html');
  expect(pages.some(isProject)).toBe(true);
  expect(pages.some(isService)).toBe(true);
});

for (const path of pages) {
  test(`${path} has complete share tags`, () => {
    const html = readFileSync(join(clientDir, path), 'utf8');
    const image = meta(html, 'og:image')!;
    expect(image).toMatch(/^https:\/\//);
    expect(meta(html, 'twitter:image')).toBe(image);
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:alt')?.trim().length).toBeGreaterThan(9);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');

    // The tag names the production address; the file must be in this build.
    const imagePath = new URL(image).pathname;
    expect(existsSync(join(clientDir, imagePath)), `${imagePath} should exist`).toBe(true);
    if (isProject(path)) {
      // The project's own cover, cropped to the card size.
      expect(imagePath).toMatch(/^\/_astro\/.+\.jpg$/);
    } else if (isService(path)) {
      // A service shares its photograph once it has one, and the brand card until then.
      expect(imagePath).toMatch(/^(\/og-default\.png|\/_astro\/.+\.jpg)$/);
    } else {
      expect(imagePath).toBe('/og-default.png');
    }
  });
}
