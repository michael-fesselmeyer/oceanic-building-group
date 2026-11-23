// Checks on the process content that the schema cannot express: the stages
// form one clear sequence and only stages with a supplied duration show one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const folder = join(import.meta.dirname, '../../src/content/process');

const stages = readdirSync(folder)
  .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
  .map((file) => {
    const text = readFileSync(join(folder, file), 'utf8');
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const field = (name: string) => front.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];
    return {
      file,
      title: field('title'),
      duration: field('duration'),
      order: Number(field('order')),
    };
  })
  .sort((a, b) => a.order - b.order);

describe('process stages', () => {
  it('has a unique order number for every stage', () => {
    expect(new Set(stages.map((stage) => stage.order)).size).toBe(stages.length);
  });

  it('runs from the first meeting to the handover', () => {
    expect(stages.map((stage) => stage.title)).toEqual([
      'First meeting',
      'Plan and budget',
      'Design',
      'Permits and approvals',
      'Construction',
      'Finishes and interior design',
      'Handover',
    ]);
  });

  it('gives a duration only to construction', () => {
    const withDuration = stages.filter((stage) => stage.duration);
    expect(withDuration.map((stage) => stage.title)).toEqual(['Construction']);
    expect(withDuration[0].duration).toBe('11 to 12 months');
  });
});
