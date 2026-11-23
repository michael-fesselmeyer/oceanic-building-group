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
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    // Build scripts, config files and tests run in Node.
    files: ['scripts/**', '*.config.*', 'tests/**'],
    languageOptions: { globals: globals.node },
  },
);
