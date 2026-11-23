import { describe, expect, it } from 'vitest';
import { aspectRatio, neighbors, projectFacts } from '../../src/lib/project-page';

const list = [{ id: 'first' }, { id: 'middle' }, { id: 'last' }];

describe('neighbors', () => {
  it('returns the items either side', () => {
    expect(neighbors(list, 'middle')).toEqual({ previous: { id: 'first' }, next: { id: 'last' } });
  });

  it('does not wrap at either end', () => {
    expect(neighbors(list, 'first')).toEqual({ previous: undefined, next: { id: 'middle' } });
    expect(neighbors(list, 'last')).toEqual({ previous: { id: 'middle' }, next: undefined });
  });

  it('gives a single item no neighbors, so it never links to itself', () => {
    expect(neighbors([{ id: 'only' }], 'only')).toEqual({ previous: undefined, next: undefined });
  });

  it('gives an unknown id no neighbors', () => {
    expect(neighbors(list, 'missing')).toEqual({});
    expect(neighbors([], 'missing')).toEqual({});
  });
});

describe('aspectRatio', () => {
  it('divides width by height', () => {
    expect(aspectRatio({ width: 2400, height: 1600 })).toBe(1.5);
    expect(aspectRatio({ width: 1066, height: 1600 })).toBe(0.6663);
  });

  it('falls back to square for impossible sizes', () => {
    expect(aspectRatio({ width: 0, height: 1600 })).toBe(1);
    expect(aspectRatio({ width: 1200, height: 0 })).toBe(1);
    expect(aspectRatio({ width: Number.NaN, height: 10 })).toBe(1);
  });
});

describe('projectFacts', () => {
  it('lists location, style and year in that order', () => {
    expect(
      projectFacts({ location: 'Tequesta', style: 'Coastal Contemporary', completedYear: 2024 }),
    ).toEqual([
      { label: 'Location', value: 'Tequesta' },
      { label: 'Style', value: 'Coastal Contemporary' },
      { label: 'Completed', value: '2024' },
    ]);
  });

  it('leaves out blank and missing facts', () => {
    expect(projectFacts({ location: '  ', style: undefined })).toEqual([]);
    expect(projectFacts({ location: 'Juno Beach' })).toEqual([
      { label: 'Location', value: 'Juno Beach' },
    ]);
  });
});
