// How a town relates to the portfolio and the rest of the site. Kept free of
// Astro imports so unit tests can use it.

export const AREAS_PATH = '/areas/';

export function townPath(id: string): string {
  return `${AREAS_PATH}${id}/`;
}

/** The part of a project the town pages look at. `town` is the content reference, when set. */
export interface InTown {
  data: { town?: { id: string } | undefined };
}

/** Every project that names the town, in the given order. */
export function projectsInTown<T extends InTown>(townId: string, projects: readonly T[]): T[] {
  return projects.filter((project) => project.data.town?.id === townId);
}

/** "1 project" or "3 projects". */
export function projectCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}

/** The page title: "Building in Jupiter". */
export function townHeading(name: string): string {
  return `Building in ${name.trim()}`;
}
