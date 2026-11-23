# Oceanic Building Group

The website for Oceanic Building Group, a residential and commercial builder serving Jupiter and
the Palm Beaches. It presents the company's portfolio, services and process, and turns visitors
into enquiries through a short intake form that notifies the office straight away.

**Status:** foundation in place; pages are being built. Not yet deployed.

## What it does

- **Portfolio first.** Projects are content files with photographs, stats and a story, shown as
  full-bleed, fast-loading pages.
- **Built for search.** Static HTML, a unique title and description on every page, structured
  data, and a performance budget enforced in CI.
- **Desktop and phone as equals.** The wide layout is designed for large screens; media queries
  simplify it for tablets and phones.
- **Plain-language legal pages.** A privacy policy and terms of use, in their own reading layout
  and linked from every footer. The privacy text describes the site as built (no cookies, no
  stored submissions), so it changes whenever that does.
- **Safe to maintain.** Content lives in Markdown with a strict schema, so a mistake fails the
  build instead of breaking the live site.

Planned work is tracked in [docs/roadmap.md](docs/roadmap.md).

## Tech stack

| Layer     | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Framework | [Astro](https://astro.build) 7, TypeScript (strict)                        |
| Hosting   | Cloudflare Workers with static assets                                      |
| Content   | Markdown content collections validated with Zod                            |
| Images    | Masters in the repo, responsive WebP/AVIF generated at build time          |
| Styling   | Plain CSS: design tokens as custom properties, component-scoped styles     |
| Tests     | Vitest (unit), Playwright with axe (browser and accessibility), Lighthouse |

The reasoning behind these choices is in [docs/adr](docs/adr) and
[docs/architecture.md](docs/architecture.md).

## Getting started

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

The site is served at `http://localhost:4321`.

| Command            | What it does                                                   |
| ------------------ | -------------------------------------------------------------- |
| `npm run dev`      | Development server with live reload                            |
| `npm run build`    | Production build into `dist/`                                  |
| `npm run check`    | Type-checks code and validates every content file              |
| `npm run lint`     | ESLint                                                         |
| `npm run format`   | Formats every file with Prettier                               |
| `npm test`         | Unit tests                                                     |
| `npm run test:e2e` | Browser and accessibility tests against the production build   |
| `npm run hygiene`  | Checks that nothing private or off-policy is in the repository |
| `npm run brand`    | Regenerates the wordmark, favicons, manifest and share image   |
| `npm run verify`   | Everything CI runs except the browser tests and Lighthouse     |

## Configuration

Secrets are never committed. [.env.example](.env.example) lists the variable names; real values
go in a git-ignored `.dev.vars` file locally and in Cloudflare's encrypted settings in production.

## Project layout

```
src/
  assets/        Photographs and brand files (optimized at build time)
  components/    Reusable pieces of a page
  content/       One folder per content type, one Markdown file per item
  layouts/       The page shell and the legal reading layout
  lib/           Business facts, content access and pure helpers
  pages/         One file per address
  styles/        Design tokens and element defaults
public/          Files served as they are: favicons, web manifest, share image
scripts/         Repository checks and the brand asset generator
tests/
  unit/          Vitest
  e2e/           Playwright
docs/            Architecture, decisions and roadmap
```

## License

Copyright Oceanic Building Group LLC. All rights reserved.
