// The launch gates behind `npm run launch-check` (scripts/launch-gates.mjs).
// tests/fixtures/launch-ready is a made-up checkout that passes every gate;
// each failure case changes one input.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkContent,
  checkDomain,
  checkLicense,
  checkLighthouse,
  checkPhone,
  checkTeam,
  configuredHosts,
  formatReport,
  gatherInputs,
  pageTypes,
  parseFrontmatter,
  parseJsonc,
  readLighthouseUrls,
  readPageFiles,
  readSiteFact,
  resolveRoute,
  routeOf,
  runGates,
} from '../../scripts/launch-gates.mjs';

const ready = fileURLToPath(new URL('../fixtures/launch-ready', import.meta.url));

const passingCi = {
  available: true,
  status: 'completed',
  conclusion: 'success',
  lighthouse: 'success',
  sha: 'abc1234def',
  url: 'https://github.example.test/runs/1',
} as const;

const inputs = () => gatherInputs(ready, { readCi: () => passingCi });

const siteSource = (phone: string, license: string) => `
export interface SiteFacts {
  phone: string | null;
  licenseNumber: string | null;
}
export const site: SiteFacts = {
  name: 'Harbor Test Builders',
  phone: ${phone},
  licenseNumber: ${license},
};
`;

function content(path: string, text: string) {
  return { path, collection: path.split('/')[2]!, ...parseFrontmatter(text) };
}

describe('the made-up ready checkout', () => {
  it('passes every gate and says so', () => {
    const results = runGates(inputs());
    expect(results.map((result) => [result.name, result.ok])).toEqual([
      ['Contractor license number', true],
      ['Office phone number', true],
      ['Domain', true],
      ['Team brokerage details', true],
      ['No draft or sample content', true],
      ['Lighthouse on every page type', true],
    ]);
    expect(formatReport(results)).toMatch(/All 6 gates pass\. The site is ready to launch\.$/);
  });

  it('reads content without templates and pages without unlaunched ones', () => {
    const { content: files, pageFiles } = inputs();
    expect(files.map((file) => file.path)).toEqual([
      'src/content/projects/dune-cottage.md',
      'src/content/projects/river-house.md',
      'src/content/services/custom-homes.md',
      'src/content/team/casey-morgan.md',
      'src/content/team/jordan-lee.md',
    ]);
    expect(pageFiles).toEqual(readPageFiles(ready));
    expect(pageFiles).toEqual([
      '404.astro',
      'contact.astro',
      'index.astro',
      'portfolio/[project].astro',
      'portfolio/index.astro',
    ]);
  });
});

describe('audited addresses', () => {
  it('come from both Lighthouse configs, indexed pages first', () => {
    expect(readLighthouseUrls(ready)).toEqual([
      'http://localhost/',
      'http://localhost/portfolio/',
      'http://localhost/portfolio/river-house/',
      'http://localhost/contact/',
      'http://localhost/404.html',
    ]);
  });

  it('cover every page type of this repository', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const result = checkLighthouse({
      pageFiles: readPageFiles(root),
      lighthouseUrls: readLighthouseUrls(root),
      ci: passingCi,
    });
    expect(result.ok, result.detail).toBe(true);
  });
});

describe('business facts', () => {
  it('reads a fact that is set, ignoring the type declaration', () => {
    expect(readSiteFact(siteSource("'5615550142'", 'null'), 'phone')).toBe('5615550142');
    expect(readSiteFact(siteSource("'5615550142'", 'null'), 'licenseNumber')).toBeNull();
  });

  it('treats an empty string as not set', () => {
    expect(readSiteFact(siteSource("''", 'null'), 'phone')).toBeNull();
  });

  it('fails loudly when the fact is missing from the file', () => {
    expect(() => readSiteFact('export const site = {};', 'phone')).toThrow(/phone/);
  });

  it('fails the license gate until the number is set', () => {
    const result = checkLicense(siteSource('null', 'null'));
    expect(result).toMatchObject({ ok: false, next: expect.stringMatching(/licenseNumber/) });
    expect(checkLicense(siteSource('null', "'CBC0000000'")).ok).toBe(true);
  });

  it('fails the phone gate when unset or not ten digits', () => {
    expect(checkPhone(siteSource('null', 'null')).ok).toBe(false);
    expect(checkPhone(siteSource("'(561) 555-0142'", 'null'))).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/not ten digits/),
    });
    expect(checkPhone(siteSource("'5615550142'", 'null')).ok).toBe(true);
  });
});

describe('domain', () => {
  const config = (site: string) => `export default defineConfig({\n  site: '${site}',\n});`;
  const wrangler = (routes: string) => `{
    // comment with "quotes" and a // slash
    "name": "site", /* block */
    ${routes}
  }`;

  it('parses wrangler.jsonc with comments and trailing commas', () => {
    expect(parseJsonc('{ "a": "http://x.test", // note\n "b": [1, 2,], }')).toEqual({
      a: 'http://x.test',
      b: [1, 2],
    });
  });

  it('collects the hosts in routes', () => {
    expect(
      configuredHosts({
        routes: ['shop.example.test/*', { pattern: 'www.example.test' }, '*.example.test/*'],
      }),
    ).toEqual(['shop.example.test', 'www.example.test']);
    expect(configuredHosts({})).toEqual([]);
  });

  it('fails when no domain is configured', () => {
    const result = checkDomain(config('https://www.example.test'), wrangler(''));
    expect(result).toMatchObject({ ok: false, detail: expect.stringMatching(/no domain/) });
  });

  it('fails when site and the configured domain differ', () => {
    const result = checkDomain(
      config('https://example.test'),
      wrangler('"routes": [{ "pattern": "www.example.test", "custom_domain": true }],'),
    );
    expect(result).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/serves www\.example\.test/),
    });
  });

  it('fails when astro.config.mjs has no site', () => {
    expect(checkDomain('export default {};', wrangler('')).ok).toBe(false);
  });

  it('passes when they match', () => {
    const result = checkDomain(
      config('https://www.example.test'),
      wrangler('"routes": [{ "pattern": "www.example.test", "custom_domain": true }],'),
    );
    expect(result.ok).toBe(true);
  });
});

describe('content', () => {
  it('reads top-level fields and leaves nested ones in the raw text', () => {
    const parsed = parseFrontmatter(
      "---\ntitle: 'River House'\ndraft: true # until photos\ngallery:\n  - alt: Kitchen\n---\nBody\n",
    );
    expect(parsed.fields).toEqual({ title: 'River House', draft: 'true', gallery: '' });
    expect(parsed.frontmatter).toContain('alt: Kitchen');
    expect(parsed.body).toBe('Body\n');
  });

  it('fails when a published file uses a placeholder photograph', () => {
    const result = checkContent([
      content(
        'src/content/projects/a.md',
        '---\ncover: ../../assets/placeholders/placeholder-wide.jpg\ncoverAlt: Placeholder for a house\n---\n',
      ),
    ]);
    expect(result).toMatchObject({ ok: false, next: expect.stringMatching(/draft: true/) });
    expect(result.detail).toContain('src/content/projects/a.md (a placeholder image, alt text');
  });

  it('fails on placeholder alt text in a gallery, lorem ipsum and made-up addresses', () => {
    for (const text of [
      '---\ngallery:\n  - src: ./a.jpg\n    alt: Placeholder kitchen\n---\n',
      '---\ntitle: A\n---\nLorem ipsum dolor sit amet.\n',
      '---\ntitle: A\n---\nWrite to someone@example.test.\n',
    ]) {
      expect(checkContent([content('src/content/projects/a.md', text)]).ok).toBe(false);
    }
  });

  it('ignores sample material in drafts and counts them', () => {
    const result = checkContent([
      content(
        'src/content/projects/a.md',
        '---\ncover: ../../assets/placeholders/x.jpg\ndraft: true\n---\n',
      ),
      content('src/content/projects/b.md', '---\ntitle: B\n---\nReal text.\n'),
    ]);
    expect(result).toEqual({
      name: 'No draft or sample content',
      ok: true,
      detail:
        '1 published file uses no sample material. 1 draft stays hidden on the launched site.',
    });
  });
});

describe('team', () => {
  it('passes with no published team members', () => {
    expect(checkTeam([]).ok).toBe(true);
  });

  it('passes for a licensee with the flag and a brokerage', () => {
    const result = checkTeam([
      content(
        'src/content/team/a.md',
        "---\nname: A\nrole: 'Real estate agent'\nrealEstateLicensee: true\nbrokerage: Harbor Test Realty LLC\n---\n",
      ),
    ]);
    expect(result.ok).toBe(true);
  });

  it('fails for a licensee flagged without a brokerage', () => {
    const result = checkTeam([
      content(
        'src/content/team/a.md',
        '---\nname: A\nrole: Agent\nrealEstateLicensee: true\n---\n',
      ),
    ]);
    expect(result.ok).toBe(false);
  });

  it('fails for a licensee without a brokerage', () => {
    const result = checkTeam([
      content('src/content/team/a.md', "---\nname: A\nrole: 'Sales associate'\n---\nSells land.\n"),
    ]);
    expect(result).toMatchObject({
      ok: false,
      detail: expect.stringContaining('src/content/team/a.md'),
    });
  });

  it('spots a licensee from the text as well as the role', () => {
    const result = checkTeam([
      content(
        'src/content/team/a.md',
        '---\nname: A\nrole: Partner\n---\nA licensed realtor since 2010.\n',
      ),
    ]);
    expect(result.ok).toBe(false);
  });

  it('ignores drafts and people who are not licensees', () => {
    const result = checkTeam([
      content('src/content/team/a.md', '---\nname: A\nrole: Realtor\ndraft: true\n---\n'),
      content('src/content/team/b.md', '---\nname: B\nrole: Site superintendent\n---\n'),
    ]);
    expect(result).toMatchObject({
      ok: true,
      detail: '1 team member, none described as a real-estate licensee.',
    });
  });
});

describe('lighthouse', () => {
  const pages = [
    'index.astro',
    'process.astro',
    '404.astro',
    'portfolio/index.astro',
    'portfolio/custom-homes.astro',
    'portfolio/[project].astro',
    'privacy.astro',
    'terms.astro',
  ];
  const routes = pages.map(routeOf);

  it('resolves an address to its page file the way Astro does', () => {
    expect(resolveRoute('/', routes)).toBe('index.astro');
    expect(resolveRoute('/process/', routes)).toBe('process.astro');
    expect(resolveRoute('/process', routes)).toBe('process.astro');
    expect(resolveRoute('/404.html', routes)).toBe('404.astro');
    expect(resolveRoute('/portfolio/custom-homes/', routes)).toBe('portfolio/custom-homes.astro');
    expect(resolveRoute('/portfolio/river-house/', routes)).toBe('portfolio/[project].astro');
    expect(resolveRoute('/nowhere/', routes)).toBeNull();
    expect(resolveRoute('/guide/a/b/', [routeOf('guide/[...page].astro')])).toBe(
      'guide/[...page].astro',
    );
    expect(resolveRoute('/guide/', [routeOf('guide/[...page].astro')])).toBe(
      'guide/[...page].astro',
    );
  });

  it('groups pages built from one template', () => {
    expect(pageTypes(pages).map((type) => type.name)).toEqual([
      'Portfolio index and filters',
      'Legal pages',
      '/',
      '/process/',
      '/404/',
      '/portfolio/[project]/',
    ]);
  });

  it('fails and names each page type the audit misses', () => {
    const result = checkLighthouse({
      pageFiles: pages,
      // A filter page covers its group; any one legal page covers both.
      lighthouseUrls: [
        'http://localhost/',
        'http://localhost/portfolio/custom-homes/',
        'http://localhost/terms/',
      ],
      ci: passingCi,
    });
    expect(result).toMatchObject({
      ok: false,
      detail:
        'The audit covers 3 of 6 page types; missing: /process/, /404/, /portfolio/[project]/.',
      next: expect.stringMatching(/lighthouserc\.json/),
    });
  });

  const covered = {
    pageFiles: ['index.astro'],
    lighthouseUrls: ['http://localhost/'],
  };

  it('fails when CI cannot be read', () => {
    const result = checkLighthouse({
      ...covered,
      ci: { available: false, reason: 'gh is not installed' },
    });
    expect(result).toMatchObject({ ok: false, next: expect.stringMatching(/gh auth login/) });
  });

  it('fails while CI is still running', () => {
    const result = checkLighthouse({
      ...covered,
      ci: { ...passingCi, status: 'in_progress', lighthouse: null },
    });
    expect(result.detail).toMatch(/still running/);
  });

  it('fails when the Lighthouse job did not pass', () => {
    const result = checkLighthouse({
      ...covered,
      ci: { ...passingCi, conclusion: 'failure', lighthouse: 'failure' },
    });
    expect(result).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/ended with "failure"/),
    });
  });

  it('passes with full coverage and a passing job', () => {
    expect(checkLighthouse({ ...covered, ci: passingCi })).toEqual({
      name: 'Lighthouse on every page type',
      ok: true,
      detail:
        'The audit covers 1 of 1 page types. The Lighthouse budget job passed on main (abc1234).',
    });
  });
});

describe('report', () => {
  it('prints one line per gate, what to do next, and a summary', () => {
    const report = formatReport([
      { name: 'Phone', ok: true, detail: 'Set.' },
      { name: 'License', ok: false, detail: 'Not set.', next: 'Set it.' },
    ]);
    expect(report).toBe(
      [
        'Launch check',
        '',
        'PASS  Phone: Set.',
        'FAIL  License: Not set.',
        '      Next: Set it.',
        '',
        '1 of 2 gates pass. The site is not ready to launch.',
      ].join('\n'),
    );
  });
});
