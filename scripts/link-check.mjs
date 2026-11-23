// Checks that every internal link on a built site resolves. The checks work on
// plain inputs (page text and a list of built files) so the unit tests can feed
// them fixtures; reading the build folder happens in `readBuild`.
//
// What is checked, on every built page except the ones listed in
// `IGNORED_SOURCES`:
//   - links and resources: a/area href, link href, and the src or srcset of
//     img, source, script, iframe, video and audio, plus og:image and
//     twitter:image. An address on the site's own host counts as internal.
//   - each internal address must be a built page or file. Page addresses must
//     end in "/", the form the site uses everywhere.
//   - each #fragment must be the id (or anchor name) of an element on the
//     target page.
// External addresses (another host, mailto:, tel:) are listed, never fetched.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Pages whose own links are not checked: development-only pages with made-up neighbors. */
export const IGNORED_SOURCES = ['/style-guide/'];

/**
 * @typedef {object} Reference
 * @property {string} tag    The element, for example "a" or "img".
 * @property {string} attr   The attribute the address came from.
 * @property {string} url    The address as written (entities decoded).
 */

/**
 * @typedef {object} PageInfo
 * @property {Reference[]} references
 * @property {Set<string>} ids    Every id and <a name> on the page.
 */

const TAG = /<(a|area|link|img|source|script|iframe|video|audio|meta)\b([^>]*)>/gi;
const ATTRIBUTE = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const ID_ATTRIBUTE = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const SHARE_IMAGE_PROPERTIES = new Set(['og:image', 'twitter:image']);

const decodeEntities = (text) =>
  text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

/** The addresses in a srcset value ("a.jpg 1x, b.jpg 2x"). */
function srcsetUrls(value) {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * Every address a page refers to, and every id it defines.
 * @param {string} html
 * @returns {PageInfo}
 */
export function readPage(html) {
  // Script and style bodies are code and data, not markup; the opening tags stay.
  const markup = html
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, '$1$2');

  /** @type {Reference[]} */
  const references = [];
  for (const [, rawTag, attributes] of markup.matchAll(TAG)) {
    const tag = rawTag.toLowerCase();
    /** @type {Record<string, string>} */
    const found = {};
    for (const [, name, double, single, bare] of attributes.matchAll(ATTRIBUTE)) {
      found[name.toLowerCase()] = decodeEntities(double ?? single ?? bare ?? '');
    }
    const add = (attr, url) => url.trim() && references.push({ tag, attr, url: url.trim() });

    if ((tag === 'a' || tag === 'area' || tag === 'link') && found.href !== undefined) {
      add('href', found.href);
    }
    if (found.src !== undefined && tag !== 'a' && tag !== 'link' && tag !== 'meta') {
      add('src', found.src);
    }
    if (found.srcset !== undefined) {
      for (const url of srcsetUrls(found.srcset)) add('srcset', url);
    }
    if (tag === 'meta' && SHARE_IMAGE_PROPERTIES.has(found.property ?? found.name ?? '')) {
      add('content', found.content ?? '');
    }
  }

  const ids = new Set();
  for (const [, double, single, bare] of markup.matchAll(ID_ATTRIBUTE)) {
    ids.add(decodeEntities(double ?? single ?? bare ?? ''));
  }
  for (const [, , attributes] of markup.matchAll(/<(a)\b([^>]*)>/gi)) {
    const name = [...attributes.matchAll(ATTRIBUTE)].find(
      ([, key]) => key.toLowerCase() === 'name',
    );
    if (name) ids.add(decodeEntities(name[2] ?? name[3] ?? name[4] ?? ''));
  }
  return { references, ids };
}

/**
 * The address a built file is served at: "/portfolio/index.html" is "/portfolio/".
 * @param {string} file  Path inside the build folder, with "/" separators.
 */
export function pageAddress(file) {
  const path = `/${file.replace(/^\/+/, '')}`;
  return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
}

/**
 * @typedef {object} Problem
 * @property {string} page      Address of the page that holds the link.
 * @property {string} url       The link as written.
 * @property {string} reason
 */

/**
 * @typedef {object} Report
 * @property {number} pages        Pages whose links were checked.
 * @property {number} checked      Internal addresses checked.
 * @property {Problem[]} broken
 * @property {Map<string, string[]>} external  External address to the pages that use it.
 */

const isExternalScheme = (url) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('//');

/**
 * Checks every link in a build.
 * @param {object} build
 * @param {Map<string, string>} build.pages   Built page address to its HTML.
 * @param {Set<string>} build.files           Addresses of every other built file ("/robots.txt").
 * @param {string} [build.origin]             The site's own address; links to it are internal.
 * @param {readonly string[]} [build.ignoredSources]
 * @returns {Report}
 */
export function checkLinks({ pages, files, origin, ignoredSources = IGNORED_SOURCES }) {
  const parsed = new Map([...pages].map(([address, html]) => [address, readPage(html)]));
  /** @type {Report} */
  const report = { pages: 0, checked: 0, broken: [], external: new Map() };
  const ownHost = origin ? new URL(origin).host : null;
  // The same link in the header and the footer is one problem, not two.
  const seen = new Set();
  const broken = (page, url, reason) => {
    const key = `${page}\n${url}\n${reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    report.broken.push({ page, url, reason });
  };

  for (const [address, { references }] of parsed) {
    if (ignoredSources.some((prefix) => address.startsWith(prefix))) continue;
    report.pages += 1;

    for (const { url } of references) {
      /** @type {URL} */
      let target;
      try {
        target = new URL(url, `http://build.test${address}`);
      } catch {
        broken(address, url, 'not a valid address');
        continue;
      }

      const own = target.host === 'build.test' || (ownHost !== null && target.host === ownHost);
      if (isExternalScheme(url) && !own) {
        const users = report.external.get(url) ?? [];
        if (!users.includes(address)) users.push(address);
        report.external.set(url, users);
        continue;
      }

      report.checked += 1;
      let path;
      try {
        path = decodeURI(target.pathname);
      } catch {
        broken(address, url, 'not a valid address');
        continue;
      }

      const isPage = parsed.has(path);
      if (!isPage && !files.has(path)) {
        const slashless = !path.endsWith('/') && parsed.has(`${path}/`);
        broken(
          address,
          url,
          slashless ? 'page addresses end in "/"' : 'no such page or file in the build',
        );
        continue;
      }

      const fragment = target.hash.slice(1);
      if (fragment && fragment.toLowerCase() !== 'top') {
        if (!isPage) continue; // A fragment on a non-page file cannot be checked.
        const wanted = decodeURIComponent(fragment);
        if (!parsed.get(path).ids.has(wanted)) {
          broken(address, url, `no element with id "${wanted}" on ${path}`);
        }
      }
    }
  }
  return report;
}

/**
 * Reads a build folder: every .html file is a page, every other file is a file.
 * @param {string} dir
 */
export function readBuild(dir) {
  /** @type {Map<string, string>} */
  const pages = new Map();
  /** @type {Set<string>} */
  const files = new Set();
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const file = relative(dir, full).split(sep).join('/');
      if (entry.name.endsWith('.html')) pages.set(pageAddress(file), readFileSync(full, 'utf8'));
      else files.add(`/${file}`);
    }
  };
  walk(dir);

  // The site's own address, as the home page names it in its canonical link.
  const canonical = pages.get('/')?.match(/<link[^>]*rel="?canonical"?[^>]*href="([^"]+)"/i)?.[1];
  return { pages, files, origin: canonical ? new URL(canonical).origin : undefined };
}

/**
 * The report as text, for the terminal and the CI log.
 * @param {Report} report
 */
export function formatReport(report) {
  const lines = [
    `Checked ${report.checked} internal addresses on ${report.pages} pages.`,
    report.broken.length === 0
      ? 'No broken internal links.'
      : `${report.broken.length} broken internal link${report.broken.length === 1 ? '' : 's'}:`,
  ];
  for (const { page, url, reason } of report.broken)
    lines.push(`  ${page}  ->  ${url}  (${reason})`);
  lines.push(
    '',
    `External links, listed and not fetched (${report.external.size}):`,
    ...[...report.external]
      .sort()
      .map(([url, users]) => `  ${url}  (${users.length} page${users.length === 1 ? '' : 's'})`),
  );
  if (report.external.size === 0) lines.push('  none');
  return lines.join('\n');
}
