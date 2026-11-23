import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_PARTNER_TITLE,
  designPartnerDescription,
  partnerFacts,
  placeList,
  websiteLabel,
} from '../../src/lib/design-partner';
import { MAX_DESCRIPTION_LENGTH } from '../../src/lib/seo';
import { navigation } from '../../src/lib/site';

const partner = { name: 'Example Interiors Studio', url: 'https://www.interiors.example.test/' };
const intro = {
  summary: 'A made-up studio used only by these tests to check the interior design page.',
  basedIn: 'Palm Beach Gardens',
  worksIn: ['Jupiter', 'Tequesta', 'Stuart'],
};

describe('websiteLabel', () => {
  it('shows the address without the scheme, www or path', () => {
    expect(websiteLabel('https://www.interiors.example.test/')).toBe('interiors.example.test');
    expect(websiteLabel('https://studio.example.test/about')).toBe('studio.example.test');
  });

  it('returns anything that is not an address unchanged', () => {
    expect(websiteLabel('not a url')).toBe('not a url');
  });
});

describe('placeList', () => {
  it('joins places the way a sentence does', () => {
    expect(placeList(['Jupiter', 'Tequesta', 'Stuart'])).toBe('Jupiter, Tequesta and Stuart');
    expect(placeList(['Jupiter', 'Stuart'])).toBe('Jupiter and Stuart');
    expect(placeList(['Jupiter'])).toBe('Jupiter');
  });

  it('skips blank entries and is empty for an empty list', () => {
    expect(placeList([' ', 'Jupiter', ''])).toBe('Jupiter');
    expect(placeList([])).toBe('');
  });
});

describe('partnerFacts', () => {
  it('lists where the partner is based, where they work and their website', () => {
    expect(partnerFacts(partner, intro)).toEqual([
      { label: 'Based in', value: 'Palm Beach Gardens' },
      { label: 'Works in', value: 'Jupiter, Tequesta and Stuart' },
      { label: 'Website', value: 'interiors.example.test', href: partner.url },
    ]);
  });

  it('leaves out facts the content file does not give', () => {
    expect(partnerFacts(partner, { summary: intro.summary, worksIn: [] })).toEqual([
      { label: 'Website', value: 'interiors.example.test', href: partner.url },
    ]);
    expect(partnerFacts(partner, null)).toHaveLength(1);
  });
});

describe('page title and description', () => {
  it('uses the navigation label as the title', () => {
    const item = navigation.find((link) => link.href === '/interior-design/');
    expect(item?.label).toBe(DESIGN_PARTNER_TITLE);
  });

  it('prefers the content file description', () => {
    const seoDescription = 'A made-up description from the content file, long enough to pass.';
    expect(designPartnerDescription(partner, { ...intro, seoDescription })).toBe(seoDescription);
  });

  it('falls back to a description that fits search results, even for a long name', () => {
    const longName = { ...partner, name: 'A'.repeat(60) };
    for (const description of [
      designPartnerDescription(partner, intro),
      designPartnerDescription(longName, null),
      designPartnerDescription(null, null),
    ]) {
      expect(description.length).toBeGreaterThanOrEqual(50);
      expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    }
  });
});

describe('design partner content', () => {
  it('has exactly one published file', () => {
    const folder = join(import.meta.dirname, '../../src/content/design-partner');
    const files = readdirSync(folder).filter(
      (file) => file.endsWith('.md') && !file.startsWith('_'),
    );
    expect(files).toHaveLength(1);
  });
});
