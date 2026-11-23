import { describe, expect, it } from 'vitest';
import {
  aspectRatio,
  buildStoryStages,
  formatProgressDate,
  isoDay,
  latestProgressDate,
  neighbors,
  progressNewestFirst,
  projectFacts,
} from '../../src/lib/project-page';

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

describe('progress updates', () => {
  const day = (iso: string, caption: string) => ({ date: new Date(iso), caption });
  const updates = [
    day('2026-01-12', 'foundation'),
    day('2026-03-20', 'roof'),
    day('2026-02-14', 'walls'),
    day('2026-03-20', 'pool'),
  ];

  it('are listed newest first, the later one in the file first on the same day', () => {
    expect(progressNewestFirst(updates).map((update) => update.caption)).toEqual([
      'pool',
      'roof',
      'walls',
      'foundation',
    ]);
  });

  it('leave the original list untouched and handle an empty one', () => {
    progressNewestFirst(updates);
    expect(updates[0]!.caption).toBe('foundation');
    expect(progressNewestFirst([])).toEqual([]);
  });

  it('show the day that was written, whatever the time zone', () => {
    expect(formatProgressDate(new Date('2026-03-04'))).toBe('March 4, 2026');
    expect(formatProgressDate(new Date('2026-01-01'))).toBe('January 1, 2026');
    expect(isoDay(new Date('2026-03-04'))).toBe('2026-03-04');
  });

  it('give a latest date only for an under-construction project with updates', () => {
    const latest = latestProgressDate({ status: 'under-construction', progress: updates });
    expect(latest && isoDay(latest)).toBe('2026-03-20');
    expect(latestProgressDate({ status: 'under-construction', progress: [] })).toBeNull();
    expect(latestProgressDate({ status: 'completed', progress: updates })).toBeNull();
  });
});

describe('build story', () => {
  const shot = (iso: string, caption: string, photo = true) => ({
    date: new Date(iso),
    caption,
    ...(photo ? { photo: `${caption}.jpg` } : {}),
  });
  const progress = [
    shot('2025-06-02', 'framing'),
    shot('2025-03-10', 'slab'),
    shot('2025-09-15', 'trim', false),
    shot('2025-06-02', 'roof'),
    shot('2025-11-20', 'handover'),
  ];

  it('tells the stages of a finished project oldest first, same-day stages in file order', () => {
    expect(
      buildStoryStages({ status: 'completed', progress }).map((stage) => stage.caption),
    ).toEqual(['slab', 'framing', 'roof', 'handover']);
  });

  it('needs at least three photographed stages', () => {
    const two = [
      shot('2025-03-10', 'slab'),
      shot('2025-06-02', 'roof'),
      shot('2025-09-15', 'trim', false),
    ];
    expect(buildStoryStages({ status: 'completed', progress: two })).toEqual([]);
    expect(buildStoryStages({ status: 'completed', progress: [] })).toEqual([]);
    expect(buildStoryStages({ status: 'completed', progress: progress.slice(0, 3) })).toHaveLength(
      0,
    );
    expect(buildStoryStages({ status: 'completed', progress: progress.slice(0, 4) })).toHaveLength(
      3,
    );
  });

  it('is never told while the project is under construction', () => {
    expect(buildStoryStages({ status: 'under-construction', progress })).toEqual([]);
  });

  it('leaves the original list untouched', () => {
    buildStoryStages({ status: 'completed', progress });
    expect(progress[0]!.caption).toBe('framing');
  });
});
