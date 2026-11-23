// The launch gates from docs/roadmap.md, as checks that `npm run launch-check`
// runs (scripts/launch-check.mjs). Each check takes plain inputs (file text,
// lists of files, a CI result) and returns a result, so the unit tests can feed
// it fixtures. Reading the repository and asking GitHub happen in
// `gatherInputs` and `readLatestCi`.
//
// Nothing here runs Astro. Business facts are read from the source of
// src/lib/site.ts, and content files are read with a small frontmatter reader
// that looks at top-level `key: value` lines only, which is all the gates need.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * @typedef {object} GateResult
 * @property {string} name      Short name of the gate.
 * @property {boolean} ok
 * @property {string} detail    What was found, in one or two sentences.
 * @property {string} [next]    What to do about a failure.
 */

// ---------------------------------------------------------------------------
// Business facts (src/lib/site.ts)

/**
 * Reads a top-level string-or-null fact such as `phone: null,` or
 * `licenseNumber: 'CBC1234567',` from the source of src/lib/site.ts.
 * @param {string} source
 * @param {string} name
 * @returns {string | null}
 */
export function readSiteFact(source, name) {
  const match = source.match(
    new RegExp(`(?:^|[\\s{,])${name}:\\s*(null|'([^']*)'|"([^"]*)")\\s*[,}]`, 'm'),
  );
  if (!match) throw new Error(`"${name}" was not found in src/lib/site.ts`);
  if (match[1] === 'null') return null;
  const value = (match[2] ?? match[3] ?? '').trim();
  return value === '' ? null : value;
}

/** @param {string} siteSource @returns {GateResult} */
export function checkLicense(siteSource) {
  const name = 'Contractor license number';
  const license = readSiteFact(siteSource, 'licenseNumber');
  return license
    ? { name, ok: true, detail: `Set to ${license}; the footer and contact page show it.` }
    : {
        name,
        ok: false,
        detail: 'Not set, so the footer and contact page show no license.',
        next: 'Once the license is issued, put its number in licenseNumber in src/lib/site.ts.',
      };
}

/** @param {string} siteSource @returns {GateResult} */
export function checkPhone(siteSource) {
  const name = 'Office phone number';
  const phone = readSiteFact(siteSource, 'phone');
  if (!phone) {
    return {
      name,
      ok: false,
      detail: 'Not set, so no page shows a phone number.',
      next: 'Put the public office number, digits only, in phone in src/lib/site.ts.',
    };
  }
  if (!/^\d{10}$/.test(phone)) {
    return {
      name,
      ok: false,
      detail: `Set to "${phone}", which is not ten digits.`,
      next: 'Write the number as ten digits with no spaces or punctuation, for example 5615550100.',
    };
  }
  return { name, ok: true, detail: 'Set.' };
}

// ---------------------------------------------------------------------------
// Domain (astro.config.mjs and wrangler.jsonc)

/** @param {string} source @returns {string | null} */
export function readSiteUrl(source) {
  return source.match(/(?:^|[\s{,])site:\s*['"]([^'"]+)['"]/m)?.[1] ?? null;
}

/**
 * Parses JSON with comments and trailing commas, as wrangler.jsonc allows.
 * @param {string} text
 */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      out += char;
      if (char === '\\') out += text[++i] ?? '';
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) break;
      i += 1;
    } else {
      out += char;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * Host names the Worker is served on, from `routes` in wrangler.jsonc.
 * @param {{ routes?: Array<string | { pattern?: string }> }} config
 * @returns {string[]}
 */
export function configuredHosts(config) {
  const routes = Array.isArray(config.routes) ? config.routes : [];
  return routes
    .map((route) => (typeof route === 'string' ? route : route?.pattern))
    .filter((pattern) => typeof pattern === 'string')
    .map((pattern) =>
      pattern
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .toLowerCase(),
    )
    .filter((host) => host && !host.includes('*'));
}

/**
 * @param {string} astroConfigSource
 * @param {string} wranglerSource
 * @returns {GateResult}
 */
export function checkDomain(astroConfigSource, wranglerSource) {
  const name = 'Domain';
  const site = readSiteUrl(astroConfigSource);
  if (!site) {
    return {
      name,
      ok: false,
      detail: 'astro.config.mjs has no site address.',
      next: 'Set site in astro.config.mjs to the address the site will live at.',
    };
  }
  const host = new URL(site).hostname.toLowerCase();
  const hosts = configuredHosts(parseJsonc(wranglerSource));
  const fix =
    'Once the domain is registered and on Cloudflare (owner approval needed), add it to routes ' +
    'in wrangler.jsonc as a custom domain and make site in astro.config.mjs match it.';

  if (hosts.length === 0) {
    return {
      name,
      ok: false,
      detail: `site is ${site}, but wrangler.jsonc serves the Worker on no domain of its own.`,
      next: fix,
    };
  }
  if (!hosts.includes(host)) {
    return {
      name,
      ok: false,
      detail: `site is ${site}, but wrangler.jsonc serves ${hosts.join(', ')}.`,
      next: 'Make site in astro.config.mjs and the routes in wrangler.jsonc name the same domain.',
    };
  }
  return { name, ok: true, detail: `site is ${site}, and wrangler.jsonc serves ${host}.` };
}

// ---------------------------------------------------------------------------
// Content (src/content)

/**
 * @typedef {object} ContentFile
 * @property {string} path        Relative to the repository root, with forward slashes.
 * @property {string} collection  The folder under src/content.
 * @property {Record<string, string>} fields  Top-level frontmatter values, unquoted.
 * @property {string} frontmatter The raw frontmatter text.
 * @property {string} body
 */

/**
 * Splits a Markdown file into its top-level frontmatter fields and body.
 * Nested values (lists, objects) are kept only in the raw text.
 * @param {string} text
 */
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fields: {}, frontmatter: '', body: text };
  const [, frontmatter, body] = match;
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].replace(/\s+#.*$/, '').trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    fields[field[1]] = value;
  }
  return { fields, frontmatter, body };
}

/**
 * Every content file the site would load: Markdown under src/content, except
 * files whose names start with "_" (the templates).
 * @param {string} root
 * @returns {ContentFile[]}
 */
export function readContent(root) {
  const base = join(root, 'src', 'content');
  if (!existsSync(base)) return [];
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.md'))
    .filter((file) => !file.split(sep).at(-1)?.startsWith('_'))
    .sort()
    .map((file) => {
      const parsed = parseFrontmatter(readFileSync(join(base, file), 'utf8'));
      return {
        path: relative(root, join(base, file)).split(sep).join('/'),
        collection: file.split(sep)[0],
        ...parsed,
      };
    });
}

/** @param {ContentFile} file */
export const isDraft = (file) => file.fields.draft === 'true';

/** Signs that a file still holds stand-in material rather than the business's own. */
export const SAMPLE_MARKERS = [
  { label: 'a placeholder image', pattern: /assets\/placeholders\// },
  {
    label: 'alt text that says "Placeholder"',
    pattern: /^\s*-?\s*(?:\w*alt):\s*['"]?placeholder\b/im,
  },
  { label: 'lorem ipsum', pattern: /lorem ipsum/i },
  { label: 'a made-up example.test address', pattern: /@example\.test\b/i },
];

/** @param {ContentFile[]} files @returns {GateResult} */
export function checkContent(files) {
  const name = 'No draft or sample content';
  const published = files.filter((file) => !isDraft(file));
  const drafts = files.length - published.length;
  const samples = published
    .map((file) => ({
      file,
      found: SAMPLE_MARKERS.filter(({ pattern }) =>
        pattern.test(`${file.frontmatter}\n${file.body}`),
      ),
    }))
    .filter(({ found }) => found.length > 0);

  const hidden =
    drafts === 0
      ? 'No drafts.'
      : `${drafts} draft${drafts === 1 ? '' : 's'} stay${drafts === 1 ? 's' : ''} hidden on the launched site.`;

  if (samples.length > 0) {
    const list = samples
      .map(({ file, found }) => `${file.path} (${found.map((marker) => marker.label).join(', ')})`)
      .join('; ');
    return {
      name,
      ok: false,
      detail: `Published files still use sample material: ${list}.`,
      next: 'Replace it with the real photographs and text, or set draft: true until they arrive.',
    };
  }
  return {
    name,
    ok: true,
    detail: `${published.length} published file${published.length === 1 ? ' uses' : 's use'} no sample material. ${hidden}`,
  };
}

/** Roles and wording that suggest a real-estate licence. */
const LICENSEE = /\b(?:real estate|realtor|realty|broker|sales associate)\b/i;
/** The line a licensee's team file carries, for example "Brokerage: Coastal Realty LLC". */
const BROKERAGE_LINE = /^Brokerage:[ \t]*\S/m;

/** @param {ContentFile[]} files @returns {GateResult} */
export function checkTeam(files) {
  const name = 'Team brokerage details';
  const team = files.filter((file) => file.collection === 'team' && !isDraft(file));
  if (team.length === 0) {
    return {
      name,
      ok: true,
      detail:
        'No team members are published yet. When they are, a real-estate licensee needs a "Brokerage:" line.',
    };
  }
  const licensees = team.filter((file) => LICENSEE.test(`${file.fields.role ?? ''}\n${file.body}`));
  const missing = licensees.filter((file) => !BROKERAGE_LINE.test(file.body));
  if (missing.length > 0) {
    return {
      name,
      ok: false,
      detail: `Real-estate licensees without brokerage details: ${missing.map((file) => file.path).join(', ')}.`,
      next:
        'Add a line "Brokerage: <the brokerage firm\'s name>" to each file\'s text, as Florida ' +
        'advertising rules require for a licensee, or check the role if they are not licensed.',
    };
  }
  return {
    name,
    ok: true,
    detail:
      licensees.length === 0
        ? `${team.length} team member${team.length === 1 ? '' : 's'}, none described as a real-estate licensee.`
        : `${licensees.length} real-estate licensee${licensees.length === 1 ? '' : 's'}, each with brokerage details.`,
  };
}

// ---------------------------------------------------------------------------
// Lighthouse (lighthouserc.json, lighthouserc.noindex.json and the latest CI run on main)

/**
 * The Lighthouse configs CI runs: pages meant to be indexed, then pages that
 * are noindex on purpose. A file that does not exist is skipped.
 */
export const LIGHTHOUSE_CONFIGS = ['lighthouserc.json', 'lighthouserc.noindex.json'];

/**
 * Every address the Lighthouse job audits, across its configs.
 * @param {string} root
 * @returns {string[]}
 */
export function readLighthouseUrls(root) {
  return LIGHTHOUSE_CONFIGS.map((file) => join(root, file))
    .filter((path) => existsSync(path))
    .flatMap((path) => JSON.parse(readFileSync(path, 'utf8'))?.ci?.collect?.url ?? []);
}

/** Page files that are never part of the launched site, or are not pages. */
const NOT_LAUNCHED = [/^api\//, /^style-guide\//];

/**
 * Pages built from one template count as one page type. Files listed here
 * that do not exist are ignored; every other page is a type of its own.
 */
export const PAGE_TYPE_GROUPS = [
  {
    name: 'Portfolio index and filters',
    files: [
      'portfolio/index.astro',
      'portfolio/custom-homes.astro',
      'portfolio/renovations.astro',
      'portfolio/commercial.astro',
      'portfolio/under-construction.astro',
    ],
  },
  { name: 'Legal pages', files: ['privacy.astro', 'terms.astro'] },
];

/**
 * Page files under src/pages that the launched site builds, relative to it.
 * @param {string} root
 * @returns {string[]}
 */
export function readPageFiles(root) {
  const base = join(root, 'src', 'pages');
  if (!existsSync(base)) return [];
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => /\.(astro|md|mdx)$/.test(file))
    .filter((file) => !NOT_LAUNCHED.some((pattern) => pattern.test(file)))
    .sort();
}

/**
 * The address pattern a page file answers, following Astro's routing: a
 * static file beats `[param]`, which beats `[...rest]`.
 * @param {string} file
 */
export function routeOf(file) {
  const segments = file.replace(/\.(astro|md|mdx)$/, '').split('/');
  if (segments.at(-1) === 'index') segments.pop();
  const rank = segments.some((s) => s.startsWith('[...'))
    ? 2
    : segments.some((s) => s.startsWith('['))
      ? 1
      : 0;
  const source = segments
    .map((segment) =>
      segment.startsWith('[...')
        ? '.*'
        : segment.startsWith('[')
          ? '[^/]+'
          : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  const path = source ? `/${source}/` : '/';
  // The 404 page is written as 404.html.
  const pattern =
    file === '404.astro'
      ? /^\/404(?:\/|\.html)$/
      : new RegExp(`^${path.replace('/.*/', '(?:/.*)?/')}$`);
  return { file, pattern, rank };
}

/**
 * Which page file an address is built from, or null.
 * @param {string} pathname
 * @param {ReturnType<typeof routeOf>[]} routes
 */
export function resolveRoute(pathname, routes) {
  const path = pathname.endsWith('/') || pathname.endsWith('.html') ? pathname : `${pathname}/`;
  const matches = routes.filter((route) => route.pattern.test(path));
  matches.sort((a, b) => a.rank - b.rank);
  return matches[0]?.file ?? null;
}

/**
 * How a page file is named in the report: its address, such as `/process/`
 * or `/portfolio/[project]/`.
 * @param {string} file
 */
export function displayRoute(file) {
  const segments = file.replace(/\.(astro|md|mdx)$/, '').split('/');
  if (segments.at(-1) === 'index') segments.pop();
  return segments.length > 0 ? `/${segments.join('/')}/` : '/';
}

/**
 * Page types: groups from PAGE_TYPE_GROUPS, then one per remaining file.
 * @param {string[]} files
 * @returns {{ name: string, files: string[] }[]}
 */
export function pageTypes(files) {
  const grouped = new Set();
  const types = [];
  for (const group of PAGE_TYPE_GROUPS) {
    const present = group.files.filter((file) => files.includes(file));
    if (present.length === 0) continue;
    present.forEach((file) => grouped.add(file));
    types.push({ name: group.name, files: present });
  }
  for (const file of files) {
    if (!grouped.has(file)) types.push({ name: displayRoute(file), files: [file] });
  }
  return types;
}

/**
 * @typedef {{ available: false, reason: string }
 *   | { available: true, status: string, conclusion: string | null, lighthouse: string | null,
 *       sha: string, url: string }} CiResult
 */

/**
 * @param {{ pageFiles: string[], lighthouseUrls: string[], ci: CiResult }} input
 * @returns {GateResult}
 */
export function checkLighthouse({ pageFiles, lighthouseUrls, ci }) {
  const name = 'Lighthouse on every page type';
  const routes = pageFiles.map(routeOf);
  const audited = new Set(
    lighthouseUrls.map((url) => resolveRoute(new URL(url, 'http://localhost').pathname, routes)),
  );
  const types = pageTypes(pageFiles);
  const missing = types.filter((type) => !type.files.some((file) => audited.has(file)));
  const coverage = `The audit covers ${types.length - missing.length} of ${types.length} page types`;

  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const next = [];
  if (missing.length > 0) {
    problems.push(`${coverage}; missing: ${missing.map((type) => type.name).join(', ')}.`);
    next.push(
      'Add an address for each missing page type to collect.url in lighthouserc.json ' +
        '(or lighthouserc.noindex.json for a page that is noindex on purpose).',
    );
  }

  let ciLine = '';
  if (!ci.available) {
    problems.push(`Could not read the latest CI run on main: ${ci.reason}.`);
    next.push(
      'Install and sign in to the GitHub CLI (gh auth login) and run this again, or open the ' +
        'latest CI run on main and check that the Lighthouse budget job passed.',
    );
  } else if (ci.status !== 'completed') {
    problems.push(`CI on main (${ci.sha.slice(0, 7)}) is still running.`);
    next.push(`Wait for it to finish, then run this again: ${ci.url}`);
  } else if (ci.lighthouse !== 'success') {
    problems.push(
      `The Lighthouse budget job on main (${ci.sha.slice(0, 7)}) ${ci.lighthouse ? `ended with "${ci.lighthouse}"` : 'did not run'}.`,
    );
    next.push(`Fix the pages it flagged: ${ci.url}`);
  } else {
    ciLine = `The Lighthouse budget job passed on main (${ci.sha.slice(0, 7)}).`;
  }

  if (problems.length > 0) {
    return { name, ok: false, detail: problems.join(' '), next: next.join(' ') };
  }
  return { name, ok: true, detail: `${coverage}. ${ciLine}` };
}

// ---------------------------------------------------------------------------
// Reading the repository and CI

/**
 * Asks the GitHub CLI for the newest CI run on main and its Lighthouse job.
 * @param {string} root
 * @returns {CiResult}
 */
export function readLatestCi(root) {
  const gh = (/** @type {string[]} */ args) =>
    execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [run] = JSON.parse(
      gh([
        'run',
        'list',
        '--workflow',
        'ci.yml',
        '--branch',
        'main',
        '--limit',
        '1',
        '--json',
        'databaseId,status,conclusion,headSha,url',
      ]),
    );
    if (!run) return { available: false, reason: 'no CI run on main yet' };
    const { jobs } = JSON.parse(gh(['run', 'view', String(run.databaseId), '--json', 'jobs']));
    const job = jobs.find(
      (/** @type {{ name: string }} */ item) => item.name === 'Lighthouse budget',
    );
    return {
      available: true,
      status: run.status,
      conclusion: run.conclusion || null,
      lighthouse: job?.conclusion || null,
      sha: run.headSha,
      url: run.url,
    };
  } catch (error) {
    const code = /** @type {{ code?: string }} */ (error).code;
    return {
      available: false,
      reason:
        code === 'ENOENT'
          ? 'the GitHub CLI (gh) is not installed'
          : 'the GitHub CLI could not reach GitHub',
    };
  }
}

/**
 * Reads everything the gates need from a checkout.
 * @param {string} root
 * @param {{ readCi?: (root: string) => CiResult }} [options]
 */
export function gatherInputs(root, { readCi = readLatestCi } = {}) {
  const read = (/** @type {string} */ file) => readFileSync(join(root, file), 'utf8');
  return {
    siteSource: read('src/lib/site.ts'),
    astroConfigSource: read('astro.config.mjs'),
    wranglerSource: read('wrangler.jsonc'),
    content: readContent(root),
    pageFiles: readPageFiles(root),
    lighthouseUrls: readLighthouseUrls(root),
    ci: readCi(root),
  };
}

/**
 * Runs every gate, in the order of docs/roadmap.md.
 * @param {ReturnType<typeof gatherInputs>} input
 * @returns {GateResult[]}
 */
export function runGates(input) {
  return [
    checkLicense(input.siteSource),
    checkPhone(input.siteSource),
    checkDomain(input.astroConfigSource, input.wranglerSource),
    checkTeam(input.content),
    checkContent(input.content),
    checkLighthouse(input),
  ];
}

/**
 * The report printed by `npm run launch-check`.
 * @param {GateResult[]} results
 */
export function formatReport(results) {
  const lines = ['Launch check', ''];
  for (const result of results) {
    lines.push(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}: ${result.detail}`);
    if (!result.ok && result.next) lines.push(`      Next: ${result.next}`);
  }
  const passed = results.filter((result) => result.ok).length;
  lines.push('');
  lines.push(
    passed === results.length
      ? `All ${results.length} gates pass. The site is ready to launch.`
      : `${passed} of ${results.length} gates pass. The site is not ready to launch.`,
  );
  return lines.join('\n');
}
