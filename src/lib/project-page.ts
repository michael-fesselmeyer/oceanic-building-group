// Pure helpers for the project pages. Kept free of Astro imports so they can
// be unit tested without a build.

export interface Neighbors<T> {
  /** The item before this one, or undefined for the first item. */
  previous?: T;
  /** The item after this one, or undefined for the last item. */
  next?: T;
}

/**
 * The items either side of `id` in a list that is already in display order.
 * The ends do not wrap: the first item has no previous and the last has no
 * next, so a short portfolio never links a project to itself or shows the
 * same neighbor twice. An id that is not in the list has no neighbors.
 */
export function neighbors<T extends { id: string }>(items: readonly T[], id: string): Neighbors<T> {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return {};
  return { previous: items[index - 1], next: items[index + 1] };
}

/** Width divided by height, rounded so it can be written into a style attribute. */
export function aspectRatio({ width, height }: { width: number; height: number }): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.round((width / height) * 10_000) / 10_000;
}

/** The facts shown under a project's title, in display order. Empty values are left out. */
export function projectFacts(data: {
  location: string;
  style?: string;
  completedYear?: number;
}): { label: string; value: string }[] {
  const facts = [
    { label: 'Location', value: data.location },
    { label: 'Style', value: data.style },
    { label: 'Completed', value: data.completedYear?.toString() },
  ];
  return facts.flatMap(({ label, value }) => {
    const text = value?.trim();
    return text ? [{ label, value: text }] : [];
  });
}

/** The fields of a progress update that ordering and dates depend on. */
export interface Dated {
  date: Date;
}

/**
 * Progress updates newest first. Updates from the same day keep the reverse
 * of their order in the file, so the one written last, the latest, leads.
 */
export function progressNewestFirst<T extends Dated>(updates: readonly T[]): T[] {
  return updates
    .map((update, index) => ({ update, index }))
    .sort((a, b) => b.update.date.getTime() - a.update.date.getTime() || b.index - a.index)
    .map(({ update }) => update);
}

/**
 * A progress date as visitors read it: "March 4, 2026". Dates in content
 * files have no time of day and are read as midnight UTC, so they are
 * formatted in UTC to stay on the day that was written.
 */
export function formatProgressDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The machine-readable form for a <time datetime> attribute: "2026-03-04". */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The date of the latest progress update of an under-construction project,
 * or null when there is none to show. Completed projects show their gallery
 * instead, so their progress is not shown.
 */
export function latestProgressDate(data: {
  status: 'completed' | 'under-construction';
  progress: readonly Dated[];
}): Date | null {
  if (data.status !== 'under-construction') return null;
  return progressNewestFirst(data.progress)[0]?.date ?? null;
}

/** The fewest photographed stages that make a build story worth showing. */
export const BUILD_STORY_MIN_STAGES = 3;

/**
 * The stages of a finished project's "How it was built" story: its progress
 * updates that have a photograph, oldest first. Updates from the same day keep
 * their order in the file. Empty unless the project is completed and has at
 * least `BUILD_STORY_MIN_STAGES` photographed updates; under construction,
 * the updates are shown as construction progress instead.
 */
export function buildStoryStages<T extends Dated & { photo?: unknown }>(data: {
  status: 'completed' | 'under-construction';
  progress: readonly T[];
}): (T & { photo: NonNullable<T['photo']> })[] {
  if (data.status !== 'completed') return [];
  const stages = progressNewestFirst(
    data.progress.filter((update): update is T & { photo: NonNullable<T['photo']> } =>
      Boolean(update.photo),
    ),
  ).reverse();
  return stages.length >= BUILD_STORY_MIN_STAGES ? stages : [];
}
