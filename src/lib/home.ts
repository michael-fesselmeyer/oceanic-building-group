// How the home page uses the featured projects.
import type { Project } from './content';

export interface HomeFeatured {
  /** Its cover is the hero photograph, and the hero credits it. `null` when nothing is featured. */
  lead: Project | null;
  /** The rest, shown under "Selected work". The lead is left out so no photograph repeats. */
  rest: Project[];
}

/** Splits the featured projects, already in portfolio order, into the hero's and the rest. */
export function splitFeatured(featured: Project[]): HomeFeatured {
  const [lead = null, ...rest] = featured;
  return { lead, rest };
}
