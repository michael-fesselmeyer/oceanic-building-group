import { readdirSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  availableFilters,
  filterProjects,
  getPortfolioFilter,
  PORTFOLIO_FILTER_SLUGS,
  PORTFOLIO_FILTERS,
  portfolioPath,
  showsFilterBar,
  type Filterable,
} from '../../src/lib/portfolio';

const project = (
  category: Filterable['data']['category'],
  status: Filterable['data']['status'] = 'completed',
): Filterable => ({ data: { category, status } });

const house = project('custom-home');
const remodel = project('renovation');
const office = project('commercial');
const newHouse = project('custom-home', 'under-construction');

describe('filter definitions', () => {
  it('have unique slugs, titles and descriptions of a search-friendly length', () => {
    expect(new Set(PORTFOLIO_FILTER_SLUGS).size).toBe(PORTFOLIO_FILTERS.length);
    expect(new Set(PORTFOLIO_FILTERS.map((filter) => filter.title)).size).toBe(
      PORTFOLIO_FILTERS.length,
    );
    for (const { description } of PORTFOLIO_FILTERS) {
      expect(description.length).toBeGreaterThanOrEqual(50);
      expect(description.length).toBeLessThanOrEqual(160);
    }
  });

  it('are found by slug', () => {
    expect(getPortfolioFilter('renovations')?.title).toBe('Renovations');
    expect(getPortfolioFilter('missing')).toBeUndefined();
  });

  it('give every filter its own page address', () => {
    expect(portfolioPath()).toBe('/portfolio/');
    expect(portfolioPath({ slug: 'commercial' })).toBe('/portfolio/commercial/');
  });
});

describe('filterProjects', () => {
  const projects = [house, remodel, office, newHouse];

  it('filters by category', () => {
    expect(filterProjects(projects, getPortfolioFilter('custom-homes')!)).toEqual([
      house,
      newHouse,
    ]);
    expect(filterProjects(projects, getPortfolioFilter('renovations')!)).toEqual([remodel]);
    expect(filterProjects(projects, getPortfolioFilter('commercial')!)).toEqual([office]);
  });

  it('filters by status across categories', () => {
    expect(filterProjects(projects, getPortfolioFilter('under-construction')!)).toEqual([newHouse]);
  });

  it('returns nothing for a filter no project matches', () => {
    expect(filterProjects([house], getPortfolioFilter('commercial')!)).toEqual([]);
    expect(filterProjects([], getPortfolioFilter('commercial')!)).toEqual([]);
  });
});

describe('availableFilters', () => {
  it('hides filters that have no projects and keeps the display order', () => {
    expect(availableFilters([office, newHouse]).map((filter) => filter.slug)).toEqual([
      'custom-homes',
      'commercial',
      'under-construction',
    ]);
  });

  it('is empty when there are no projects', () => {
    expect(availableFilters([])).toEqual([]);
  });
});

describe('showsFilterBar', () => {
  it('is hidden when there are no projects', () => {
    expect(showsFilterBar([])).toBe(false);
  });

  it('is hidden when every filter would repeat the whole portfolio', () => {
    expect(showsFilterBar([house])).toBe(false);
    expect(showsFilterBar([house, house])).toBe(false);
  });

  it('is shown once a filter narrows the list', () => {
    expect(showsFilterBar([house, remodel])).toBe(true);
    expect(showsFilterBar([house, newHouse])).toBe(true);
  });
});

describe('route collisions', () => {
  it('no project id equals a filter slug, so a project page never shadows a filter page', () => {
    const folder = new URL('../../src/content/projects/', import.meta.url);
    const ids = readdirSync(folder, { recursive: true, encoding: 'utf8' })
      .filter((file) => extname(file) === '.md' && !basename(file).startsWith('_'))
      .map((file) => file.slice(0, -'.md'.length).replaceAll('\\', '/'));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(PORTFOLIO_FILTER_SLUGS).not.toContain(id);
    }
  });
});
