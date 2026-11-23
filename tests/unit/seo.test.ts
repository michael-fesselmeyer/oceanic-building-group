import { describe, expect, it } from 'vitest';
import { canonicalUrl, formatPhone, pageTitle } from '../../src/lib/seo';

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
