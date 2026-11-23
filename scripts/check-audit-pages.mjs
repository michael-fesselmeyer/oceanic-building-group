// Checks the Lighthouse page lists against the launched build in dist/client:
//
//   - every address in either list was built (a typo would otherwise be
//     audited as a 404 page)
//   - pages in lighthouserc.json are indexable
//   - pages in lighthouserc.noindex.json carry a noindex tag, which is the
//     only reason that list may skip Lighthouse's "is-crawlable" audit
//
// Run after `astro build` with PUBLIC_SITE_LAUNCHED=true, as the Lighthouse
// job in CI does.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist', 'client');

const NOINDEX = /<meta\s+name="robots"\s+content="[^"]*noindex/i;

/** @param {string} config */
function urls(config) {
  return JSON.parse(readFileSync(join(root, config), 'utf8')).ci.collect.url;
}

/** @param {string} url */
function builtFile(url) {
  const { pathname } = new URL(url);
  return join(dist, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
}

const problems = [];
for (const [config, wantNoindex] of [
  ['lighthouserc.json', false],
  ['lighthouserc.noindex.json', true],
]) {
  for (const url of urls(config)) {
    const file = builtFile(url);
    if (!existsSync(file)) {
      problems.push(`${config}: ${url} was not built (looked for ${file}).`);
      continue;
    }
    const noindex = NOINDEX.test(readFileSync(file, 'utf8'));
    if (noindex !== wantNoindex) {
      problems.push(
        wantNoindex
          ? `${config}: ${url} is indexable, so it belongs in lighthouserc.json.`
          : `${config}: ${url} carries noindex. Build with PUBLIC_SITE_LAUNCHED=true, or move it to lighthouserc.noindex.json if that is intended.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Every audited page was built, and each list holds only the pages it should.');
