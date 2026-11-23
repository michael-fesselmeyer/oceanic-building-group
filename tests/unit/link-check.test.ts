// The link checker behind `npm run check:links` (scripts/link-check.mjs).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkLinks,
  formatReport,
  pageAddress,
  readBuild,
  readPage,
} from '../../scripts/link-check.mjs';

const page = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

/** A small site: a home page, one section page with ids, and one plain file. */
const site = (overrides: Record<string, string> = {}) => ({
  pages: new Map(
    Object.entries({
      '/': page(
        '<a href="/work/">Work</a><a href="#main" id="top-link">Skip</a><main id="main"></main>',
      ),
      '/work/': page('<h2 id="projects">Projects</h2><a href="/">Home</a>'),
      ...overrides,
    }),
  ),
  files: new Set(['/robots.txt', '/img/a.png']),
  origin: 'https://builders.example.test',
});

describe('pageAddress', () => {
  it('turns index files into folder addresses', () => {
    expect(pageAddress('index.html')).toBe('/');
    expect(pageAddress('work/index.html')).toBe('/work/');
    expect(pageAddress('404.html')).toBe('/404.html');
    expect(pageAddress('/work/deep/index.html')).toBe('/work/deep/');
  });
});

describe('readPage', () => {
  it('finds links and resources with their elements', () => {
    const { references } = readPage(
      page(
        `<a href="/a/">A</a><area href="/b/"><img src="/img/a.png" srcset="/img/a-1.png 1x, /img/a-2.png 2x">
         <iframe src="/frame/"></iframe><source srcset="/s.webp 480w, /t.webp 800w">`,
        `<link rel="icon" href="/favicon.svg"><script src="/app.js"></script>
         <meta property="og:image" content="https://builders.example.test/share.png">
         <meta name="description" content="/not-a-link/">`,
      ),
    );
    expect(references.map((r) => r.url)).toEqual([
      '/favicon.svg',
      '/app.js',
      'https://builders.example.test/share.png',
      '/a/',
      '/b/',
      '/img/a.png',
      '/img/a-1.png',
      '/img/a-2.png',
      '/frame/',
      '/s.webp',
      '/t.webp',
    ]);
  });

  it('reads single-quoted and unquoted attributes and decodes entities', () => {
    const { references } = readPage(
      page(`<a href='/x/'>x</a><a href=/y/>y</a><a href="/z/?a=1&amp;b=2">z</a>`),
    );
    expect(references.map((r) => r.url)).toEqual(['/x/', '/y/', '/z/?a=1&b=2']);
  });

  it('ignores what is written inside script and style elements', () => {
    const { references, ids } = readPage(
      page(
        `<script type="application/ld+json">{"a":"<a href=\\"/fake/\\" id=\\"fake\\">"}</script>
         <style>a[href="/css/"] { color: red }</style><a href="/real/" id="real">r</a>`,
      ),
    );
    expect(references.map((r) => r.url)).toEqual(['/real/']);
    expect([...ids]).toEqual(['real']);
  });

  it('collects ids and anchor names', () => {
    const { ids } = readPage(page('<h2 id="one">1</h2><div id=two></div><a name="old"></a>'));
    expect([...ids].sort()).toEqual(['old', 'one', 'two']);
  });

  it('skips empty addresses', () => {
    expect(readPage(page('<a href="">x</a><img src=" ">')).references).toEqual([]);
  });
});

describe('checkLinks', () => {
  it('passes a site whose links all resolve', () => {
    const report = checkLinks(site());
    expect(report.broken).toEqual([]);
    expect(report.pages).toBe(2);
    expect(report.checked).toBeGreaterThan(0);
  });

  it('reports a link to a page that is not built, with the page it is on', () => {
    const report = checkLinks(site({ '/work/': page('<a href="/missing/">Gone</a>') }));
    expect(report.broken).toEqual([
      { page: '/work/', url: '/missing/', reason: 'no such page or file in the build' },
    ]);
  });

  it('reports a link to a page that was a draft and is not built', () => {
    const launched = site({ '/': page('<a href="/portfolio/draft-project/">Featured</a>') });
    const report = checkLinks(launched);
    expect(report.broken.map((p) => p.url)).toEqual(['/portfolio/draft-project/']);
  });

  it('requires page addresses to end in a slash', () => {
    const report = checkLinks(site({ '/': page('<a href="/work">Work</a>') }));
    expect(report.broken).toEqual([
      { page: '/', url: '/work', reason: 'page addresses end in "/"' },
    ]);
  });

  it('accepts links to built files and to resources', () => {
    const report = checkLinks(
      site({ '/': page('<a href="/robots.txt">r</a><img src="/img/a.png">') }),
    );
    expect(report.broken).toEqual([]);
  });

  it('reports a missing resource', () => {
    const report = checkLinks(site({ '/': page('<img src="/img/none.png">') }));
    expect(report.broken.map((p) => p.url)).toEqual(['/img/none.png']);
  });

  describe('fragments', () => {
    it('accepts a fragment that exists on the same page and on another page', () => {
      const report = checkLinks(
        site({
          '/': page('<a href="#main">m</a><a href="/work/#projects">p</a><main id="main"></main>'),
        }),
      );
      expect(report.broken).toEqual([]);
    });

    it('reports a fragment that is not on the same page', () => {
      const report = checkLinks(site({ '/': page('<a href="#nowhere">x</a>') }));
      expect(report.broken).toEqual([
        { page: '/', url: '#nowhere', reason: 'no element with id "nowhere" on /' },
      ]);
    });

    it('reports a fragment that is not on the target page', () => {
      const report = checkLinks(site({ '/': page('<a href="/work/#nope">x</a>') }));
      expect(report.broken.map((p) => p.reason)).toEqual(['no element with id "nope" on /work/']);
    });

    it('allows "#" and "#top", which browsers resolve to the top of the page', () => {
      const report = checkLinks(site({ '/': page('<a href="#">a</a><a href="#top">b</a>') }));
      expect(report.broken).toEqual([]);
    });

    it('reports a good page with a bad fragment once, not as a missing page', () => {
      const report = checkLinks(site({ '/': page('<a href="/work/#nope">x</a>') }));
      expect(report.broken).toHaveLength(1);
    });

    it('does not check a fragment on a file that is not a page', () => {
      const report = checkLinks(site({ '/': page('<a href="/robots.txt#line">x</a>') }));
      expect(report.broken).toEqual([]);
    });
  });

  describe('internal and external addresses', () => {
    it('ignores query strings when finding the target', () => {
      const report = checkLinks(site({ '/': page('<a href="/work/?filter=a&amp;x=1">w</a>') }));
      expect(report.broken).toEqual([]);
    });

    it('resolves relative links against the page they are on', () => {
      const report = checkLinks(
        site({
          '/work/': page(
            '<h2 id="projects">p</h2><a href="../">up</a><a href="./#projects">same</a><a href="missing/">no</a>',
          ),
        }),
      );
      expect(report.broken.map((p) => p.url)).toEqual(['missing/']);
    });

    it("treats an address on the site's own host as internal", () => {
      const report = checkLinks(
        site({
          '/': page(
            '<a href="https://builders.example.test/work/">ok</a><a href="https://builders.example.test/gone/">bad</a>',
          ),
        }),
      );
      expect(report.broken.map((p) => p.url)).toEqual(['https://builders.example.test/gone/']);
      expect(report.external.size).toBe(0);
    });

    it('lists external addresses, with the pages that use them, and does not check them', () => {
      const report = checkLinks(
        site({
          '/': page(
            '<a href="https://elsewhere.example.test/">e</a><a href="mailto:hi@example.test">m</a><a href="tel:+15555550100">t</a>',
          ),
          '/work/': page('<a href="https://elsewhere.example.test/">e</a>'),
        }),
      );
      expect(report.broken).toEqual([]);
      expect([...report.external.keys()].sort()).toEqual([
        'https://elsewhere.example.test/',
        'mailto:hi@example.test',
        'tel:+15555550100',
      ]);
      expect(report.external.get('https://elsewhere.example.test/')).toEqual(['/', '/work/']);
    });

    it('treats a protocol-relative address as external', () => {
      const report = checkLinks(
        site({ '/': page('<script src="//cdn.example.test/a.js"></script>') }),
      );
      expect([...report.external.keys()]).toEqual(['//cdn.example.test/a.js']);
    });

    it('checks share images named in meta tags', () => {
      const report = checkLinks(
        site({
          '/': page(
            '',
            '<meta property="og:image" content="https://builders.example.test/nope.png">',
          ),
        }),
      );
      expect(report.broken.map((p) => p.url)).toEqual(['https://builders.example.test/nope.png']);
    });

    it('reports an address that cannot be read', () => {
      const report = checkLinks(site({ '/': page('<a href="/%E0%A4%A/">bad</a>') }));
      expect(report.broken.map((p) => p.reason)).toEqual(['not a valid address']);
    });
  });

  it('reports the same problem once when a link is repeated, as in a header and footer', () => {
    const link = '<a href="/gone/">x</a>';
    const report = checkLinks(site({ '/': page(link + link) }));
    expect(report.broken).toHaveLength(1);
  });

  it('does not check pages in ignored areas, such as the style guide', () => {
    const report = checkLinks({
      ...site({ '/style-guide/': page('<a href="/example-neighbor/">made up</a>') }),
    });
    expect(report.broken).toEqual([]);
    expect(report.pages).toBe(2);
  });

  it('still checks a link that points into an ignored area', () => {
    const report = checkLinks(site({ '/': page('<a href="/style-guide/">sg</a>') }));
    expect(report.broken.map((p) => p.url)).toEqual(['/style-guide/']);
  });
});

describe('readBuild', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  it('reads pages by address, other files by path, and the site origin from the home page', () => {
    const dir = mkdtempSync(join(tmpdir(), 'link-check-'));
    folders.push(dir);
    mkdirSync(join(dir, 'work'));
    mkdirSync(join(dir, '_astro'));
    writeFileSync(
      join(dir, 'index.html'),
      page('', '<link rel="canonical" href="https://builders.example.test/">'),
    );
    writeFileSync(join(dir, 'work', 'index.html'), page(''));
    writeFileSync(join(dir, '404.html'), page(''));
    writeFileSync(join(dir, 'robots.txt'), 'User-agent: *');
    writeFileSync(join(dir, '_astro', 'app.js'), '');

    const build = readBuild(dir);
    expect([...build.pages.keys()].sort()).toEqual(['/', '/404.html', '/work/']);
    expect([...build.files].sort()).toEqual(['/_astro/app.js', '/robots.txt']);
    expect(build.origin).toBe('https://builders.example.test');
    expect(checkLinks(build).broken).toEqual([]);
  });
});

describe('formatReport', () => {
  it('says so when nothing is broken and lists external links', () => {
    const text = formatReport(
      checkLinks(site({ '/': page('<a href="https://elsewhere.example.test/">e</a>') })),
    );
    expect(text).toContain('No broken internal links.');
    expect(text).toContain('https://elsewhere.example.test/  (1 page)');
  });

  it('lists each broken link with its page and reason', () => {
    const text = formatReport(checkLinks(site({ '/': page('<a href="/gone/">x</a>') })));
    expect(text).toContain('1 broken internal link:');
    expect(text).toContain('/  ->  /gone/  (no such page or file in the build)');
  });
});
