// The sitemap and robots.txt in the build output. Before launch there is no
// sitemap (every page is noindex, so there is nothing to list) and robots.txt
// names none. A build with PUBLIC_SITE_LAUNCHED=true must list every built page
// except the 404, with absolute addresses, and robots.txt must point at it.
// CI runs this file against both kinds of build.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const clientDir = join(process.cwd(), 'dist', 'client');
const launched = process.env.PUBLIC_SITE_LAUNCHED === 'true';

function builtPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : builtPages(full);
    if (!entry.name.endsWith('.html')) return [];
    const path = `/${relative(clientDir, full).split(sep).join('/')}`;
    return [path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path];
  });
}

const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const robots = readFileSync(join(clientDir, 'robots.txt'), 'utf8');

if (!launched) {
  test('before launch there is no sitemap and robots.txt names none', () => {
    expect(existsSync(join(clientDir, 'sitemap-index.xml'))).toBe(false);
    expect(existsSync(join(clientDir, 'sitemap-0.xml'))).toBe(false);
    expect(robots).not.toMatch(/sitemap/i);
    expect(robots).toContain('Allow: /');
  });
} else {
  const indexXml = readFileSync(join(clientDir, 'sitemap-index.xml'), 'utf8');
  const [listUrl] = locations(indexXml);
  const urls = locations(readFileSync(join(clientDir, new URL(listUrl!).pathname), 'utf8'));
  const pages = builtPages(clientDir).filter((path) => path !== '/404.html');

  test('robots.txt points at the sitemap and still allows crawling', () => {
    expect(robots).toContain('Allow: /');
    const line = robots.split('\n').find((l) => l.startsWith('Sitemap: '));
    expect(line).toBe(`Sitemap: ${new URL('/sitemap-index.xml', urls[0]).href}`);
  });

  test('lists every built page except the 404, once each, with absolute addresses', () => {
    expect(urls.every((url) => /^https:\/\//.test(url))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.map((url) => new URL(url).pathname).sort()).toEqual([...pages].sort());
  });

  test('has one of each page type and leaves out the 404 and the style guide', () => {
    const paths = urls.map((url) => new URL(url).pathname);
    expect(paths).toContain('/');
    expect(paths).toContain('/portfolio/');
    expect(paths.some((p) => /^\/portfolio\/[^/]+\/$/.test(p))).toBe(true);
    expect(paths.some((p) => /^\/services\/[^/]+\/$/.test(p))).toBe(true);
    expect(paths.some((p) => p.startsWith('/404'))).toBe(false);
    expect(paths.some((p) => p.startsWith('/style-guide'))).toBe(false);
  });
}
