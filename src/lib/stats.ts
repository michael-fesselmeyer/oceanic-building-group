// Turns raw facts into the label and value pairs StatList shows. Missing
// values are dropped here, so a component never renders an empty row.
import type { Project } from './content';

export interface Stat {
  label: string;
  /** Left out, `null` or blank means unknown: the row is not shown. */
  value?: string | number | null;
}

export interface VisibleStat {
  label: string;
  value: string;
}

const numberFormat = new Intl.NumberFormat('en-US');

/** Keeps only the stats with a value, formatted for display. */
export function visibleStats(stats: readonly Stat[]): VisibleStat[] {
  return stats.flatMap(({ label, value }) => {
    if (value === null || value === undefined) return [];
    if (typeof value === 'number') {
      return Number.isFinite(value) ? [{ label, value: numberFormat.format(value) }] : [];
    }
    const text = value.trim();
    return text ? [{ label, value: text }] : [];
  });
}

/**
 * Builders write bathrooms as "full.half", so "5.2" means five full and two
 * half baths. Visitors read that as a decimal, so spell it out.
 */
export function formatBathrooms(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const match = /^\s*(\d+)(?:\.(\d+))?\s*$/.exec(value);
  if (!match) return value.trim() || undefined;
  const full = Number(match[1]);
  const half = Number(match[2] ?? 0);
  if (half === 0) return String(full);
  if (full === 0) return `${half} half`;
  return `${full} full, ${half} half`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The unit, joined by a non-breaking space so a narrow column never splits it. */
const squareFeet = 'sq\u00a0ft';

/** The stats shown for a project, in display order. */
export function projectStats(stats: Project['data']['stats']): Stat[] {
  return [
    { label: `Living area, ${squareFeet}`, value: stats.livingSqFt },
    { label: `Total area, ${squareFeet}`, value: stats.totalSqFt },
    { label: 'Bedrooms', value: stats.bedrooms },
    { label: 'Bathrooms', value: formatBathrooms(stats.bathrooms) },
    {
      label: 'Build time',
      value: stats.buildMonths === undefined ? undefined : plural(stats.buildMonths, 'month'),
    },
  ];
}
