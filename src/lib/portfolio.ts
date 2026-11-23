// The portfolio's filters: which projects each one shows, and the title and
// description of its page. Kept free of Astro imports so unit tests can use it.
//
// Each filter has its own static page at /portfolio/<slug>/ (see
// src/pages/portfolio/). A project page lives at /portfolio/<project id>/, so
// no project id may equal a filter slug; a unit test checks the content.
import type { ProjectCategory } from './content';

/** The part of a project the filters look at. */
export interface Filterable {
  data: { category: ProjectCategory; status: 'completed' | 'under-construction' };
}

export interface PortfolioFilter {
  slug: 'custom-homes' | 'renovations' | 'commercial' | 'under-construction';
  /** Text of the link in the filter bar. */
  label: string;
  /** Page title and heading. */
  title: string;
  /** One or two sentences for search results, 50 to 160 characters. */
  description: string;
  /** One sentence under the heading. */
  intro: string;
  /** Sentence shown when no project matches. */
  empty: string;
  matches: (project: Filterable) => boolean;
}

export const PORTFOLIO_FILTERS: readonly PortfolioFilter[] = [
  {
    slug: 'custom-homes',
    label: 'Custom homes',
    title: 'Custom Homes',
    description:
      'Custom homes built by Oceanic Building Group in Jupiter and the Palm Beaches, from the first sketch to the final walkthrough.',
    intro:
      'Houses designed around a lot, a view and the way a family lives, built from the foundation up.',
    empty: 'No custom homes are published yet.',
    matches: (project) => project.data.category === 'custom-home',
  },
  {
    slug: 'renovations',
    label: 'Renovations',
    title: 'Renovations',
    description:
      'Whole-home renovations and additions by Oceanic Building Group, rebuilding coastal homes in Jupiter and the Palm Beaches.',
    intro:
      'Existing coastal homes opened up, rebuilt and added to, with the structure and the details brought up to date.',
    empty: 'No renovations are published yet.',
    matches: (project) => project.data.category === 'renovation',
  },
  {
    slug: 'commercial',
    label: 'Commercial',
    title: 'Commercial Projects',
    description:
      'Commercial construction by Oceanic Building Group: offices, retail and mixed-use buildings in Jupiter and the Palm Beaches.',
    intro:
      'Offices, retail and mixed-use buildings, delivered on schedule for owners who need them open.',
    empty: 'No commercial projects are published yet.',
    matches: (project) => project.data.category === 'commercial',
  },
  {
    slug: 'under-construction',
    label: 'Under construction',
    title: 'Under Construction',
    description:
      'Projects Oceanic Building Group is building right now in Jupiter and the Palm Beaches, with progress photographs as they come in.',
    intro: 'Work in progress right now, from the pour to the finishes.',
    empty: 'Nothing is under construction at the moment.',
    matches: (project) => project.data.status === 'under-construction',
  },
];

export const PORTFOLIO_FILTER_SLUGS: readonly string[] = PORTFOLIO_FILTERS.map(
  (filter) => filter.slug,
);

export const PORTFOLIO_PATH = '/portfolio/';

/** Address of the page for a filter, or of the whole portfolio when none is given. */
export function portfolioPath(filter?: Pick<PortfolioFilter, 'slug'>): string {
  return filter ? `${PORTFOLIO_PATH}${filter.slug}/` : PORTFOLIO_PATH;
}

export function getPortfolioFilter(slug: string): PortfolioFilter | undefined {
  return PORTFOLIO_FILTERS.find((filter) => filter.slug === slug);
}

/** The projects a filter shows, in their given order. */
export function filterProjects<T extends Filterable>(
  projects: readonly T[],
  filter: PortfolioFilter,
): T[] {
  return projects.filter(filter.matches);
}

/** The filters that have at least one project, in display order. */
export function availableFilters(projects: readonly Filterable[]): PortfolioFilter[] {
  return PORTFOLIO_FILTERS.filter((filter) => projects.some(filter.matches));
}

/**
 * Whether the filter bar is worth showing. With one filter, or filters that
 * all list the same projects as the full portfolio, it would only repeat it.
 */
export function showsFilterBar(projects: readonly Filterable[]): boolean {
  return availableFilters(projects).some(
    (filter) => filterProjects(projects, filter).length < projects.length,
  );
}
