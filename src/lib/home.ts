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

/** A service line as the home page lists it. */
export interface HomeService {
  title: string;
  summary: string;
  href: string;
}

/** A stage of the build as the home page's short version of the process shows it. */
export interface HomeStep {
  title: string;
  /** Typical length, shown only when the stage's file supplies one. */
  duration?: string;
}

/** A client testimonial, already reduced to plain text. */
export interface HomeQuote {
  quote: string;
  attribution: string;
  /** Optional context after the attribution, for example the project name. */
  source?: string;
}

/** Two-digit numbers from position, as on Our Process: "01", "02"... */
export function listNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}
