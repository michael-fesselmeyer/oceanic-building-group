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

export async function getTowns() {
  return (await getCollection('towns', isVisible)).sort(byOrder);
}

export async function getTeam() {
  return (await getCollection('team', isVisible)).sort(byOrder);
}

export async function getTestimonials() {
  return (await getCollection('testimonials', isVisible)).sort(byOrder);
}

export async function getProcessSteps() {
  return (await getCollection('processSteps', isVisible)).sort(byOrder);
}

export type ProcessStep = CollectionEntry<'processSteps'>;

/** The stage's description, rendered from the Markdown body. */
export async function renderProcessStep(step: ProcessStep) {
  return (await render(step)).Content;
}
