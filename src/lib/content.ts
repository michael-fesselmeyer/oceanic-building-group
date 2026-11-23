// Every page reads content through this file, never through astro:content
// directly, so the draft rule and the sort order are applied in one place.
import { getCollection, render, type CollectionEntry } from 'astro:content';
import { launched } from './site';

type Draftable = { data: { draft: boolean } };
type Ordered = { data: { order: number } };

/** Drafts are visible in development and previews, hidden once the site is launched. */
const isVisible = (entry: Draftable) => !launched || !entry.data.draft;

const byOrder = (a: Ordered, b: Ordered) => a.data.order - b.data.order;

export type Project = CollectionEntry<'projects'>;
export type ProjectCategory = Project['data']['category'];

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  'custom-home': 'Custom Home',
  renovation: 'Renovation',
  commercial: 'Commercial',
};

export async function getProjects(): Promise<Project[]> {
  return (await getCollection('projects', isVisible)).sort(byOrder);
}

/** A project's Markdown story, as a component to place on the page. */
export async function renderProjectStory(project: Project) {
  return (await render(project)).Content;
}

export async function getFeaturedProjects(): Promise<Project[]> {
  return (await getProjects()).filter((project) => project.data.featured);
}

export type Service = CollectionEntry<'services'>;

export async function getServices(): Promise<Service[]> {
  return (await getCollection('services', isVisible)).sort(byOrder);
}

/** A service's Markdown description, as a component to place on the page. */
export async function renderServiceBody(service: Service) {
  return (await render(service)).Content;
}

export type Town = CollectionEntry<'towns'>;

export async function getTowns(): Promise<Town[]> {
  return (await getCollection('towns', isVisible)).sort(byOrder);
}

/** A town's Markdown description, as a component to place on the page. */
export async function renderTownBody(town: Town) {
  return (await render(town)).Content;
}

export async function getTeam() {
  return (await getCollection('team', isVisible)).sort(byOrder);
}

export type Testimonial = CollectionEntry<'testimonials'>;

/** Testimonials about the builder. Quotes about the design partner are left out. */
export async function getTestimonials(): Promise<Testimonial[]> {
  return (await getCollection('testimonials', isVisible))
    .filter((testimonial) => !testimonial.data.aboutDesignPartner)
    .sort(byOrder);
}

/** Testimonials about the interior design partner, for /interior-design/. */
export async function getDesignPartnerTestimonials(): Promise<Testimonial[]> {
  return (await getCollection('testimonials', isVisible))
    .filter((testimonial) => testimonial.data.aboutDesignPartner)
    .sort(byOrder);
}

/**
 * A testimonial's words: the Markdown body as plain text on one line. Quotes
 * are short, so Markdown formatting is not supported in them.
 */
export function testimonialQuote(testimonial: Testimonial): string {
  return (testimonial.body ?? '').replace(/\s+/g, ' ').trim();
}

export async function getProcessSteps() {
  return (await getCollection('processSteps', isVisible)).sort(byOrder);
}

export type ProcessStep = CollectionEntry<'processSteps'>;

/** The stage's description, rendered from the Markdown body. */
export async function renderProcessStep(step: ProcessStep) {
  return (await render(step)).Content;
}

/** Projects marked `interiorDesignPartner: true`, in portfolio order. */
export async function getDesignPartnerProjects(): Promise<Project[]> {
  return (await getProjects()).filter((project) => project.data.interiorDesignPartner);
}

export type DesignPartnerProfile = CollectionEntry<'designPartner'>;

/**
 * The partner's introduction from src/content/design-partner/, or `null`
 * when there is no published file. The folder holds one file; a second one
 * stops the build so it is never silently ignored.
 */
export async function getDesignPartnerProfile(): Promise<DesignPartnerProfile | null> {
  const profiles = await getCollection('designPartner', isVisible);
  if (profiles.length > 1) {
    throw new Error(
      `src/content/design-partner/ should hold one file, but it has ${profiles.length}: ` +
        `${profiles.map((profile) => profile.id).join(', ')}. Delete the extras, or start their names with "_" to keep them as notes.`,
    );
  }
  return profiles[0] ?? null;
}

/** The partner's biography, rendered from the Markdown body. */
export async function renderDesignPartnerBio(profile: DesignPartnerProfile) {
  return (await render(profile)).Content;
}
