// How a service relates to the portfolio. The services collection has no
// field for this, so the link is kept here: each service file's id maps to
// the project category whose work it shows. Kept free of Astro imports so
// unit tests can use it.
import type { ProjectCategory } from './content';

/** The part of a project the services pages look at. */
export interface Categorized {
  data: { category: ProjectCategory };
}

/**
 * The project category each service shows as related work, keyed by the
 * service file's name. A service that is not listed, or maps to `null`,
 * shows no related projects: investor partnerships are about land and
 * speculative homes, which are not a project category of their own.
 */
const RELATED_CATEGORY: Readonly<Record<string, ProjectCategory | null>> = {
  'custom-homes': 'custom-home',
  renovations: 'renovation',
  commercial: 'commercial',
  investors: null,
};

/** The portfolio page that lists a service's related projects, when it has one. */
const PORTFOLIO_PAGE: Readonly<Record<string, { path: string; label: string }>> = {
  'custom-homes': { path: '/portfolio/custom-homes/', label: 'See every custom home' },
  renovations: { path: '/portfolio/renovations/', label: 'See every renovation' },
  commercial: { path: '/portfolio/commercial/', label: 'See every commercial project' },
};

/** How many related projects a service page shows before linking to the full list. */
export const RELATED_LIMIT = 2;

export const SERVICES_PATH = '/services/';

export function servicePath(id: string): string {
  return `${SERVICES_PATH}${id}/`;
}

/** The category whose projects a service shows, or `null` when it shows none. */
export function relatedCategory(serviceId: string): ProjectCategory | null {
  return RELATED_CATEGORY[serviceId] ?? null;
}

/** Every project in the service's category, in the given order. */
export function relatedProjects<T extends Categorized>(
  serviceId: string,
  projects: readonly T[],
): T[] {
  const category = relatedCategory(serviceId);
  return category ? projects.filter((project) => project.data.category === category) : [];
}

/** The link to the full list in the portfolio, or `undefined` when there is none. */
export function relatedPortfolioLink(serviceId: string) {
  return PORTFOLIO_PAGE[serviceId];
}
