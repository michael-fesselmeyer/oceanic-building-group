// @ts-check
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import { isSitemapPage } from './src/lib/sitemap';

// The same switch src/lib/site.ts reads: the sitemap is written only for the
// launched site. Before launch every page is noindex, so there is nothing to list.
const env = { ...loadEnv('production', process.cwd(), 'PUBLIC_'), ...process.env };
const launched = env.PUBLIC_SITE_LAUNCHED === 'true';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Provisional until the domain is registered. Canonical addresses, the
  // sitemap and share tags are all built from this one value.
  site: 'https://oceanicbuildinggroup.com',

  // Every page address ends in "/" so links, canonicals and the sitemap
  // use a single form. Files with an extension (robots.txt) are exempt.
  trailingSlash: 'always',

  // Pages are prerendered to static HTML. The adapter exists for the few
  // routes that opt out with `export const prerender = false`, such as the
  // intake form endpoint.
  adapter: cloudflare(),

  // Lists every page except the 404 and the style guide, written at build time
  // as /sitemap-index.xml and referenced from robots.txt (see src/lib/sitemap.ts).
  integrations: launched ? [sitemap({ filter: isSitemapPage })] : [],

  // Font files come from npm packages, so builds need no network. Astro
  // writes the @font-face rules and exposes each family as a CSS variable
  // consumed by src/styles/tokens.css.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Newsreader',
      cssVariable: '--font-newsreader',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          {
            src: ['@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2'],
            weight: '200 800',
            style: 'normal',
          },
          {
            src: ['@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2'],
            weight: '200 800',
            style: 'italic',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Hanken Grotesk',
      cssVariable: '--font-hanken',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: [
              '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2',
            ],
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
  ],
});
