// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'dist/',
    '.astro/',
    '.wrangler/',
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'lighthouse-reports/',
    'private/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    // Modules in src/lib are also imported by browser tests, which run outside Vite where
    // import.meta.env does not exist. Read build settings with `import.meta.env?.NAME`.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[optional=false][object.type='MemberExpression'][object.object.type='MetaProperty'][object.property.name='env']",
          message:
            'Read build settings as import.meta.env?.NAME: browser tests import src/lib outside Vite, where import.meta.env is undefined.',
        },
      ],
    },
  },
  {
    // Build scripts, config files and tests run in Node.
    files: ['scripts/**', '*.config.*', 'tests/**'],
    languageOptions: { globals: globals.node },
  },
);
