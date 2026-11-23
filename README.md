# Oceanic Building Group

The website for Oceanic Building Group, a residential and commercial builder serving Jupiter and
the Palm Beaches. It presents the company's portfolio, services and process, and turns visitors
into enquiries through a short intake form that notifies the office straight away.

**Status:** foundation in place; pages are being built. Not yet deployed.

## What it does

- **A photographic first impression.** The home page opens on a full-bleed photograph of a
  featured project, with the headline, one call to action and a caption linking to that project.
  Phones get a portrait crop of the same photograph. The other featured projects follow in a
  staggered, magazine-style layout. With nothing featured the page opens on a navy band instead.
- **Portfolio first.** Projects are content files with photographs, stats and a story. The
  portfolio index lays them out editorially and filters by category and status through plain
  links, so filtering works without JavaScript. Each project has its own page at
  `/portfolio/<project>/`: a full-bleed cover, the facts, the story and features, a stacked
  gallery, and links to the previous and next project.
- **Four service pages.** An overview and one page each for custom homes, renovations, commercial
  construction and investor partnerships, written in Markdown. Each shows related projects from
  the portfolio by category and leaves that section out when there are none.
- **A process page that reads like a sequence.** The stages of a build are one Markdown file
  each, shown in order with large numerals on a vertical rule (a plain ordered list on phones). A
  typical duration appears only on a stage whose file supplies one.
- **Built for search.** Static HTML, a unique title and description on every page, structured
  data, and a performance budget enforced in CI.
- **Desktop and phone as equals.** The wide layout is designed for large screens; media queries
  simplify it for tablets and phones.
- **An intake form that works everywhere.** The contact page's form validates in the browser
  with no JavaScript; with it, plain-language messages appear under each field, in a summary, and
  focus moves to the first answer to fix. One schema in `src/lib/intake.ts` holds the rules and
  wording for the page and the server alike, and a hidden honeypot field catches spam programs.
- **A header that gets out of the way.** On pages that open with a full-bleed photograph it floats
  transparent over the image and turns solid once the page scrolls past it, in CSS alone. The
  current page and its section are marked in the navigation.
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

The site is served at `http://localhost:4321`. Every shared component and its variants are shown
at `http://localhost:4321/style-guide/`, the project page template with made-up projects at
`/style-guide/project/`, and the top of the home page with four, one and no featured projects at
`/style-guide/home/`, `/style-guide/home/one/` and `/style-guide/home/none/`. None of them is
built for the launched site.

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
  components/    Reusable pieces of a page (shown together on /style-guide/)
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
