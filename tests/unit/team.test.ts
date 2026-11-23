import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aboutFacts } from '../../src/lib/about';
import {
  bioParagraphs,
  canShowMember,
  memberBrokerage,
  portraitAlt,
  teamCard,
} from '../../src/lib/team';

describe('canShowMember', () => {
  it('shows anyone who is not a real estate licensee', () => {
    expect(canShowMember({ realEstateLicensee: false })).toBe(true);
  });

  it('shows a licensee only once the brokerage is named', () => {
    expect(canShowMember({ realEstateLicensee: true })).toBe(false);
    expect(canShowMember({ realEstateLicensee: true, brokerage: '  ' })).toBe(false);
    expect(canShowMember({ realEstateLicensee: true, brokerage: 'Example Realty' })).toBe(true);
  });
});

describe('memberBrokerage', () => {
  it('is the brokerage for a licensee and null for everyone else', () => {
    expect(memberBrokerage({ realEstateLicensee: true, brokerage: ' Example Realty ' })).toBe(
      'Example Realty',
    );
    expect(memberBrokerage({ realEstateLicensee: false, brokerage: 'Example Realty' })).toBeNull();
    expect(memberBrokerage({ realEstateLicensee: true })).toBeNull();
  });
});

describe('bioParagraphs', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    expect(bioParagraphs('First line\nwraps here.\n\nSecond paragraph.\n')).toEqual([
      'First line wraps here.',
      'Second paragraph.',
    ]);
  });

  it('is empty for a missing or blank body', () => {
    expect(bioParagraphs(undefined)).toEqual([]);
    expect(bioParagraphs('\n  \n')).toEqual([]);
  });
});

describe('teamCard', () => {
  it('shapes an entry for the team list', () => {
    const card = teamCard(
      'sam-example',
      {
        name: ' Sam Example ',
        role: 'Real estate agent',
        realEstateLicensee: true,
        brokerage: 'Example Realty',
      },
      'One line.',
    );
    expect(card).toEqual({
      id: 'sam-example',
      name: 'Sam Example',
      role: 'Real estate agent',
      photo: undefined,
      brokerage: 'Example Realty',
      bio: ['One line.'],
    });
    expect(portraitAlt(card.name)).toBe('Portrait of Sam Example');
  });
});

describe('aboutFacts', () => {
  const base = {
    address: { street: '1 Example Way', city: 'Tequesta', region: 'FL', postalCode: '00000' },
    serviceArea: 'Jupiter and the Palm Beaches',
  };

  it('describes experience as the principals’, in years', () => {
    expect(aboutFacts({ ...base, principalsExperienceYears: 30 })).toEqual([
      { label: 'Office', value: 'Tequesta, FL' },
      { label: 'Serving', value: 'Jupiter and the Palm Beaches' },
      { label: 'Principals’ experience', value: '30+ years' },
    ]);
  });

  it('leaves out experience that is not known', () => {
    expect(aboutFacts({ ...base, principalsExperienceYears: null })).toHaveLength(2);
  });
});

describe('team content', () => {
  const folder = join(import.meta.dirname, '../../src/content/team');
  const entries = readdirSync(folder)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => {
      const front = readFileSync(join(folder, file), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1];
      const field = (name: string) =>
        front?.match(new RegExp(`^${name}: ([^#\\n]+)`, 'm'))?.[1].trim();
      return {
        file,
        licensee: field('realEstateLicensee') === 'true',
        brokerage: field('brokerage'),
        draft: field('draft') === 'true',
      };
    });

  it('keeps every licensee without a brokerage as a draft', () => {
    for (const entry of entries.filter((item) => item.licensee && !item.brokerage)) {
      expect(entry.draft, entry.file).toBe(true);
    }
  });
});
