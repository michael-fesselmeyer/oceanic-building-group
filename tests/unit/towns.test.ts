import { describe, expect, it } from 'vitest';
import {
  AREAS_PATH,
  projectCountLabel,
  projectsInTown,
  townHeading,
  townPath,
} from '../../src/lib/towns';

const project = (id: string, town?: string) => ({
  id,
  data: { town: town ? { id: town } : undefined },
});

describe('townPath', () => {
  it('puts a town under /areas/ with a trailing slash', () => {
    expect(AREAS_PATH).toBe('/areas/');
    expect(townPath('example-town')).toBe('/areas/example-town/');
  });
});

describe('projectsInTown', () => {
  const projects = [project('a', 'one'), project('b', 'two'), project('c'), project('d', 'one')];

  it('keeps the projects that name the town, in order', () => {
    expect(projectsInTown('one', projects).map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('returns nothing for a town with no projects', () => {
    expect(projectsInTown('three', projects)).toEqual([]);
    expect(projectsInTown('one', [])).toEqual([]);
  });

  it('ignores projects that name no town', () => {
    expect(projectsInTown('', projects)).toEqual([]);
  });
});

describe('projectCountLabel', () => {
  it('uses the singular for one', () => {
    expect(projectCountLabel(1)).toBe('1 project');
    expect(projectCountLabel(0)).toBe('0 projects');
    expect(projectCountLabel(4)).toBe('4 projects');
  });
});

describe('townHeading', () => {
  it('names the town', () => {
    expect(townHeading('Example Town')).toBe('Building in Example Town');
    expect(townHeading(' Example Town ')).toBe('Building in Example Town');
  });
});
