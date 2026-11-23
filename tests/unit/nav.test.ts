import { describe, expect, it } from 'vitest';
import { currentState } from '../../src/lib/nav';

describe('currentState', () => {
  it('marks the exact page as the current page', () => {
    expect(currentState('/portfolio/', '/portfolio/')).toBe('page');
    expect(currentState('/', '/')).toBe('page');
  });

  it('marks the section of a page inside it', () => {
    expect(currentState('/portfolio/some-project/', '/portfolio/')).toBe('true');
    expect(currentState('/services/new-homes/plans/', '/services/')).toBe('true');
  });

  it('never marks the home link on any other page', () => {
    expect(currentState('/portfolio/', '/')).toBeUndefined();
    expect(currentState('/about/', '/')).toBeUndefined();
    expect(currentState('/portfolio/some-project/', '/')).toBeUndefined();
  });

  it('does not mistake a longer name for the same section', () => {
    expect(currentState('/portfolio-archive/', '/portfolio/')).toBeUndefined();
    expect(currentState('/services/', '/portfolio/')).toBeUndefined();
  });

  it('ignores a missing trailing slash on either side', () => {
    expect(currentState('/portfolio', '/portfolio/')).toBe('page');
    expect(currentState('/portfolio/some-project', '/portfolio/')).toBe('true');
    expect(currentState('/portfolio/', '/portfolio')).toBe('page');
  });
});
