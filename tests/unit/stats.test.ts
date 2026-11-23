import { describe, expect, it } from 'vitest';
import { formatBathrooms, projectStats, visibleStats } from '../../src/lib/stats';

describe('visibleStats', () => {
  it('drops missing, null and blank values', () => {
    expect(
      visibleStats([
        { label: 'Bedrooms', value: 4 },
        { label: 'Bathrooms' },
        { label: 'Garage', value: null },
        { label: 'Style', value: '   ' },
      ]),
    ).toEqual([{ label: 'Bedrooms', value: '4' }]);
  });

  it('returns an empty list when nothing is known', () => {
    expect(visibleStats([])).toEqual([]);
    expect(visibleStats([{ label: 'Bedrooms', value: undefined }])).toEqual([]);
  });

  it('groups thousands and drops numbers that are not finite', () => {
    expect(
      visibleStats([
        { label: 'Area', value: 12500 },
        { label: 'Broken', value: Number.NaN },
      ]),
    ).toEqual([{ label: 'Area', value: '12,500' }]);
  });

  it('keeps zero, which is a real value', () => {
    expect(visibleStats([{ label: 'Half baths', value: 0 }])).toEqual([
      { label: 'Half baths', value: '0' },
    ]);
  });

  it('trims text values', () => {
    expect(visibleStats([{ label: 'Style', value: '  Coastal  ' }])).toEqual([
      { label: 'Style', value: 'Coastal' },
    ]);
  });
});

describe('formatBathrooms', () => {
  it('spells out full and half baths', () => {
    expect(formatBathrooms('5.2')).toBe('5 full, 2 half');
    expect(formatBathrooms('4.1')).toBe('4 full, 1 half');
  });

  it('shows whole numbers as they are', () => {
    expect(formatBathrooms('3')).toBe('3');
    expect(formatBathrooms('3.0')).toBe('3');
  });

  it('handles half baths only', () => {
    expect(formatBathrooms('0.1')).toBe('1 half');
  });

  it('passes through text it does not recognize, and drops blanks', () => {
    expect(formatBathrooms('3 + powder')).toBe('3 + powder');
    expect(formatBathrooms('  ')).toBeUndefined();
    expect(formatBathrooms(undefined)).toBeUndefined();
  });
});

describe('projectStats', () => {
  it('lists every project stat in display order', () => {
    const stats = visibleStats(
      projectStats({
        livingSqFt: 4200,
        totalSqFt: 6150,
        bedrooms: 5,
        bathrooms: '5.2',
        buildMonths: 14,
      }),
    );
    expect(stats).toEqual([
      { label: 'Living area, sq ft', value: '4,200' },
      { label: 'Total area, sq ft', value: '6,150' },
      { label: 'Bedrooms', value: '5' },
      { label: 'Bathrooms', value: '5 full, 2 half' },
      { label: 'Build time', value: '14 months' },
    ]);
  });

  it('uses the singular for a one-month build', () => {
    expect(visibleStats(projectStats({ buildMonths: 1 }))).toEqual([
      { label: 'Build time', value: '1 month' },
    ]);
  });

  it('shows nothing for a project with no stats', () => {
    expect(visibleStats(projectStats({}))).toEqual([]);
  });
});
