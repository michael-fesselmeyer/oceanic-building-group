import { describe, expect, it } from 'vitest';
import { projectTransitionName } from '../../src/lib/motion';

describe('projectTransitionName', () => {
  it('prefixes the project id so the name never starts with a digit', () => {
    expect(projectTransitionName('masterpiece-on-the-river')).toBe(
      'project-masterpiece-on-the-river',
    );
    expect(projectTransitionName('2024-river-house')).toBe('project-2024-river-house');
  });

  it('turns anything that is not a valid identifier character into a hyphen', () => {
    expect(projectTransitionName('Beach House/phase.2')).toBe('project-beach-house-phase-2');
  });

  it('gives different projects different names', () => {
    expect(projectTransitionName('a')).not.toBe(projectTransitionName('b'));
  });
});
