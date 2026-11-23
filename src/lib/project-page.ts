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
