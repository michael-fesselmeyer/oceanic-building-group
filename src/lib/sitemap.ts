// Pure helpers for the sitemap and robots.txt. Kept free of Astro imports so
// they can be unit tested without a build, and so astro.config.mjs can use them.

/** The sitemap file @astrojs/sitemap writes: an index that points at the page lists. */
export const SITEMAP_PATH = '/sitemap-index.xml';

/**
 * Page paths that never belong in a sitemap, matched at the start of the path:
 * the 404 page, the style guide, and server routes such as the intake form
 * endpoint (`/api/intake/`), which answer form posts rather than show a page.
 */
const EXCLUDED_PREFIXES = ['/404', '/style-guide', '/api'];

/**
 * Whether a built page is listed in the sitemap. The 404 page, the style
 * guide and server routes under `/api/` are left out. Drafts need no rule here: they are not built once the
 * site is launched, and the sitemap is only written once it is launched.
 * Accepts a full address or a path.
 */
export function isSitemapPage(page: string): boolean {
  const { pathname } = new URL(page, 'https://example.test');
  return !EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * robots.txt. Crawling is always allowed: before launch each page carries its
 * own noindex tag (see Seo.astro), and search engines can only obey that tag
 * if they are allowed to read the page. The sitemap is named only once the
 * site is launched, because before then there is none.
 */
export function robotsTxt(siteUrl: URL | string, launched: boolean): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (launched) lines.push('', `Sitemap: ${new URL(SITEMAP_PATH, siteUrl).href}`);
  return `${lines.join('\n')}\n`;
}
