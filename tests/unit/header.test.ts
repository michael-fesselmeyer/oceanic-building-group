// Over a photograph the header text is white on a navy scrim. The photograph is not under our
// control, so the check uses the worst case: pure white behind the scrim.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

function hex(name: string): number[] {
  const match = tokens.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`--${name} is missing from tokens.css`);
  return [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
}

function percent(name: string): number {
  const match = tokens.match(new RegExp(`--${name}:\\s*([\\d.]+)%\\s*;`));
  if (!match) throw new Error(`--${name} is missing from tokens.css`);
  return Number(match[1]) / 100;
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number[], b: number[]) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

describe('header scrim', () => {
  it('keeps white text at 4.5:1 or better even over a white photograph', () => {
    const scrim = hex('color-navy-950');
    const strength = percent('header-scrim-strength');
    const white = [255, 255, 255];
    const behindText = scrim.map((channel, i) => channel * strength + white[i] * (1 - strength));
    expect(contrast(white, behindText)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the solid header text readable', () => {
    expect(contrast(hex('color-navy-900'), hex('color-white'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('color-ink-900'), hex('color-white'))).toBeGreaterThanOrEqual(4.5);
  });
});
