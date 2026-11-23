import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic in src/lib. Page behavior is covered by
// the browser tests in tests/e2e, which run in CI.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
