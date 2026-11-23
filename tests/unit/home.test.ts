import { describe, expect, it } from 'vitest';
import { listNumber, splitFeatured } from '../../src/lib/home';
import type { Project } from '../../src/lib/content';

const project = (id: string) => ({ id }) as Project;

describe('splitFeatured', () => {
  it('gives the hero nothing and shows no section when nothing is featured', () => {
    expect(splitFeatured([])).toEqual({ lead: null, rest: [] });
  });

  it('puts a single featured project in the hero only', () => {
    const only = project('only');
    expect(splitFeatured([only])).toEqual({ lead: only, rest: [] });
  });

  it('keeps the order and never repeats the hero project in the list', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(project);
    const { lead, rest } = splitFeatured([a, b, c, d]);
    expect(lead).toBe(a);
    expect(rest).toEqual([b, c, d]);
  });
});

describe('listNumber', () => {
  it('numbers from one with two digits, as Our Process does', () => {
    expect([0, 6, 9, 11].map(listNumber)).toEqual(['01', '07', '10', '12']);
  });
});
