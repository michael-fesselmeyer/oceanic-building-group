// Pure helpers for the <head>. Kept free of Astro imports so they can be
// unit tested without a build.

const TITLE_SEPARATOR = ' | ';

/** Search engines truncate titles near this length. */
export const MAX_TITLE_LENGTH = 60;
/** Search engines truncate descriptions near this length. */
export const MAX_DESCRIPTION_LENGTH = 160;

/**
 * Browser-tab and search-result title. The home page passes no page title
 * and gets the site name with its tagline.
 */
export function pageTitle(siteName: string, title?: string, tagline?: string): string {
  const page = title?.trim();
  if (page) return `${page}${TITLE_SEPARATOR}${siteName}`;
  const suffix = tagline?.trim();
  return suffix ? `${siteName}${TITLE_SEPARATOR}${suffix}` : siteName;
}

/**
 * Absolute canonical address for a path. Always ends in "/" unless the
 * path names a file, and never carries a query string or fragment.
 */
export function canonicalUrl(pathname: string, siteUrl: URL | string): string {
  const url = new URL(pathname, siteUrl);
  url.search = '';
  url.hash = '';
  const lastSegment = url.pathname.split('/').pop() ?? '';
  const isFile = lastSegment.includes('.');
  if (!isFile && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

/** Formats ten digits as "(561) 555-0100". Returns the input if it is not ten digits. */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.length !== 10) return digits;
  return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
}
