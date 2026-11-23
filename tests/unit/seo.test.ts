import { describe, expect, it } from 'vitest';
import {
  canonicalUrl,
  DEFAULT_SHARE_IMAGE,
  formatPhone,
  pageTitle,
  shareImageUrl,
} from '../../src/lib/seo';

describe('pageTitle', () => {
  it('puts the page name before the site name', () => {
    expect(pageTitle('Example Builders', 'Portfolio')).toBe('Portfolio | Example Builders');
  });

  it('uses the site name and tagline on the home page', () => {
    expect(pageTitle('Example Builders', undefined, 'Custom Homes')).toBe(
      'Example Builders | Custom Homes',
    );
  });

  it('falls back to the site name alone', () => {
    expect(pageTitle('Example Builders')).toBe('Example Builders');
    expect(pageTitle('Example Builders', '   ', '  ')).toBe('Example Builders');
  });
});

describe('canonicalUrl', () => {
  const site = 'https://builders.example.test';

  it('adds a trailing slash to page addresses', () => {
    expect(canonicalUrl('/portfolio', site)).toBe('https://builders.example.test/portfolio/');
    expect(canonicalUrl('/portfolio/', site)).toBe('https://builders.example.test/portfolio/');
  });

  it('keeps the home page as the bare origin with a slash', () => {
    expect(canonicalUrl('/', site)).toBe('https://builders.example.test/');
  });

  it('leaves file addresses alone', () => {
    expect(canonicalUrl('/robots.txt', site)).toBe('https://builders.example.test/robots.txt');
  });

  it('drops query strings and fragments', () => {
    expect(canonicalUrl('/contact/?ref=ad#form', site)).toBe(
      'https://builders.example.test/contact/',
    );
  });
});

describe('shareImageUrl', () => {
  const site = 'https://builders.example.test';

  it('falls back to the default card as an absolute address', () => {
    expect(shareImageUrl(undefined, site)).toBe(
      `https://builders.example.test${DEFAULT_SHARE_IMAGE.path}`,
    );
    expect(shareImageUrl('  ', site)).toBe(
      `https://builders.example.test${DEFAULT_SHARE_IMAGE.path}`,
    );
  });

  it('resolves a root-relative image against the site', () => {
    expect(shareImageUrl('/_astro/porch.abc123.jpg', site)).toBe(
      'https://builders.example.test/_astro/porch.abc123.jpg',
    );
  });

  it('keeps an absolute image as it is', () => {
    expect(shareImageUrl('https://cdn.example.test/porch.jpg', site)).toBe(
      'https://cdn.example.test/porch.jpg',
    );
  });
});

describe('formatPhone', () => {
  it('formats ten digits', () => {
    expect(formatPhone('5615550100')).toBe('(561) 555-0100');
  });

  it('ignores punctuation in the input', () => {
    expect(formatPhone('561.555.0100')).toBe('(561) 555-0100');
  });

  it('returns anything else unchanged', () => {
    expect(formatPhone('555-0100')).toBe('555-0100');
  });
});
