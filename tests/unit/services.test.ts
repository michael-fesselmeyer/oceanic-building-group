import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RELATED_LIMIT,
  relatedCategory,
  relatedPortfolioLink,
  relatedProjects,
  servicePath,
  type Categorized,
} from '../../src/lib/services';

const project = (category: Categorized['data']['category']): Categorized => ({
  data: { category },
});

const projects = [
  project('custom-home'),
  project('renovation'),
  project('custom-home'),
  project('commercial'),
];

describe('related projects', () => {
  it('match the service by category, keeping their order', () => {
    expect(relatedProjects('custom-homes', projects)).toEqual([projects[0], projects[2]]);
    expect(relatedProjects('renovations', projects)).toEqual([projects[1]]);
    expect(relatedProjects('commercial', projects)).toEqual([projects[3]]);
  });

  it('are empty when the portfolio has none in the category', () => {
    expect(relatedProjects('commercial', [project('custom-home')])).toEqual([]);
    expect(relatedProjects('custom-homes', [])).toEqual([]);
  });

  it('are always empty for investor partnerships and for unknown services', () => {
    expect(relatedCategory('investors')).toBeNull();
    expect(relatedProjects('investors', projects)).toEqual([]);
    expect(relatedProjects('not-a-service', projects)).toEqual([]);
  });

  it('link to the matching portfolio page, and only where there is one', () => {
    expect(relatedPortfolioLink('custom-homes')?.path).toBe('/portfolio/custom-homes/');
    expect(relatedPortfolioLink('renovations')?.path).toBe('/portfolio/renovations/');
    expect(relatedPortfolioLink('commercial')?.path).toBe('/portfolio/commercial/');
    expect(relatedPortfolioLink('investors')).toBeUndefined();
  });

  it('show at least one card', () => {
    expect(RELATED_LIMIT).toBeGreaterThanOrEqual(1);
  });
});

describe('service addresses', () => {
  it('end in a slash under /services/', () => {
    expect(servicePath('custom-homes')).toBe('/services/custom-homes/');
  });
});

describe('service content files', () => {
  const folder = new URL('../../src/content/services/', import.meta.url);
  const files = readdirSync(folder).filter((name) => extname(name) === '.md' && name[0] !== '_');
  const ids = files.map((name) => basename(name, '.md'));

  it('exist for the four service lines', () => {
    expect(ids.sort()).toEqual(['commercial', 'custom-homes', 'investors', 'renovations']);
  });

  it('are mapped to a related category or deliberately to none', () => {
    for (const id of ids) {
      const category = relatedCategory(id);
      if (id === 'investors') expect(category).toBeNull();
      else expect(category, id).not.toBeNull();
    }
  });

  it('never state the company age or make a promise about returns', () => {
    for (const name of files) {
      const text = readFileSync(new URL(name, folder), 'utf8').toLowerCase();
      expect(text, name).not.toMatch(/years in business|since 19|since 20|guarantee/);
    }
  });
});
