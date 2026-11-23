import { describe, expect, it } from 'vitest';
import { isSitemapPage, robotsTxt, SITEMAP_PATH } from '../../src/lib/sitemap';

describe('isSitemapPage', () => {
  it.each(['/', '/portfolio/', '/portfolio/harbor-house/', '/services/renovations/', '/contact/'])(
    'lists %s',
    (path) => {
      expect(isSitemapPage(path)).toBe(true);
      expect(isSitemapPage(`https://builders.example.test${path}`)).toBe(true);
    },
  );

  it('leaves out the 404 page', () => {
    expect(isSitemapPage('/404/')).toBe(false);
    expect(isSitemapPage('/404')).toBe(false);
    expect(isSitemapPage('https://builders.example.test/404/')).toBe(false);
  });

  it('leaves out the style guide and every page under it', () => {
    expect(isSitemapPage('/style-guide/')).toBe(false);
    expect(isSitemapPage('/style-guide/project/sparse/')).toBe(false);
    expect(isSitemapPage('https://builders.example.test/style-guide/project/')).toBe(false);
  });

  it('does not mistake a page that merely starts with the same letters', () => {
    expect(isSitemapPage('/style-guidelines/')).toBe(true);
    expect(isSitemapPage('/4040/')).toBe(true);
  });
});

describe('robotsTxt', () => {
  const site = 'https://builders.example.test';

  it('always allows crawling', () => {
    expect(robotsTxt(site, false)).toContain('User-agent: *\nAllow: /\n');
    expect(robotsTxt(site, true)).toContain('User-agent: *\nAllow: /\n');
  });

  it('names no sitemap before launch, because none is written', () => {
    expect(robotsTxt(site, false)).not.toMatch(/sitemap/i);
  });

  it('names the sitemap by absolute address once launched', () => {
    expect(robotsTxt(site, true)).toContain(`Sitemap: ${site}${SITEMAP_PATH}\n`);
    expect(robotsTxt(new URL(site), true)).toContain(`Sitemap: ${site}${SITEMAP_PATH}\n`);
  });

  it('ends with a single newline', () => {
    expect(robotsTxt(site, true).endsWith('\n')).toBe(true);
    expect(robotsTxt(site, false).endsWith('\n\n')).toBe(false);
  });
});
