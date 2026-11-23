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
  Below them come the four service lines as a numbered index, the stages of a build along a
  timeline, the interior design partner, client testimonials once any are published, and a
  closing band that leads to the contact page. A section with nothing to show is left out.
- **Portfolio first.** Projects are content files with photographs, stats and a story. The
  portfolio index lays them out editorially and filters by category and status through plain
  links, so filtering works without JavaScript. Each project has its own page at
  `/portfolio/<project>/`: a full-bleed cover, the facts, the story and features, a stacked
  gallery that opens in a lightbox (plain links to large photographs without JavaScript), and
  links to the previous and next project. Projects still being built show dated progress updates,
  newest first, and their cards say when they were last updated.
- **Four service pages.** An overview and one page each for custom homes, renovations, commercial
  construction and investor partnerships, written in Markdown. Each shows related projects from
  the portfolio by category and leaves that section out when there are none.
- **Areas We Serve.** `/areas/` and one page per town (Jupiter, Jupiter Inlet Colony, Tequesta,
  Juno Beach, Palm Beach Gardens, Hobe Sound and Wellington), each with copy written for the town:
  flood and coastal rules, permits, and its own projects from the portfolio. A town with no
  projects yet still reads well.
- **A process page that reads like a sequence.** The stages of a build are one Markdown file
  each, shown in order with large numerals on a vertical rule (a plain ordered list on phones). A
  typical duration appears only on a stage whose file supplies one.
- **An About page that works before the photographs.** The company story and the team, one
  Markdown file per person. Entries read well in type alone and gain a portrait when one is added.
  A real estate licensee cannot be published until their brokerage is named, as Florida requires.
- **An interior design partner page.** `/interior-design/` introduces the builder's interior
  designer from a Markdown file, adds the projects and client quotes credited to the partner once
  they are marked, and ends with links to the partner's website and the contact page. Project
  pages credit the partner and link there.
- **Built for search.** Static HTML, a unique title and description on every page, structured
  data (the business on every page, breadcrumbs on nested pages, each project with its main
  photograph) built by tested functions, a sitemap generated for the launched site, a share image
  on every page (a project shares its own cover), and a performance budget enforced in CI.
- **Quiet motion, in CSS alone.** Section headings and photographs rise into view as the page
  scrolls, pages cross-fade, and a project's photograph moves from its card to its page. Browsers
  without these features, and visitors who prefer reduced motion, get a still page with nothing
  hidden.
- **Desktop and phone as equals.** The wide layout is designed for large screens; media queries
  simplify it for tablets and phones.
- **An intake form that works everywhere.** The contact page's form validates in the browser
  with no JavaScript; with it, plain-language messages appear under each field, in a summary, and
  focus moves to the first answer to fix. One schema in `src/lib/intake.ts` holds the rules and
  wording for the page and the server alike, and a hidden honeypot field catches spam programs.
- **Enquiries reach the office by email, and nothing is stored.** The form posts to a small
  server endpoint (`/api/intake/`) that checks the answers with the same schema, verifies a
  Cloudflare Turnstile spam check and emails the office through Resend. Without JavaScript the form
  still posts and the visitor lands on a thank-you page; if an answer needs fixing or the email
  cannot be sent, the form comes back with everything they typed. Logs never hold a full address,
  phone number or message. A text-message alert to the office is built in behind `SMS_ENABLED`
  and stays off until its cost is approved ([how to turn it on](docs/architecture.md#sms)).
- **A header that gets out of the way.** On pages that open with a full-bleed photograph it floats
  transparent over the image and turns solid once the page scrolls past it, in CSS alone. The
  current page and its section are marked in the navigation.
- **Plain-language legal pages.** A privacy policy and terms of use, in their own reading layout
  and linked from every footer. The privacy text describes the site as built (no cookies, no
  stored submissions), so it changes whenever that does.
- **Visitor statistics without cookies.** Once launched, and once its token is set, every page
  carries Cloudflare Web Analytics: no cookies, no consent banner, and a privacy page that
  describes it only while it is on.
- **Locked down by default.** A content security policy lets only the site's own code run (Turnstile
  only on the form pages), and every response carries HSTS, `nosniff`, a strict referrer policy,
  a permissions policy and frame protection ([details](docs/architecture.md#security-headers)).
- **Safe to maintain.** Content lives in Markdown with a strict schema, so a mistake fails the
  build instead of breaking the live site.

To change the site's words and photographs (projects, progress updates, testimonials, services,
process stages, towns, the team, the phone and license number), follow the step-by-step recipes in
[docs/content-guide.md](docs/content-guide.md), written for the business owner.

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
at `http://localhost:4321/style-guide/`. The project page template with made-up projects is at
`/style-guide/project/`, the interior design page with a made-up partner at
`/style-guide/interior-design/`, and the home page's sections with every part filled, one
featured project, and nothing to show at `/style-guide/home/`, `/style-guide/home/one/` and
`/style-guide/home/none/`. None of
these pages is built for the launched site.

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Development server with live reload                            |
| `npm run build`         | Production build into `dist/`                                  |
| `npm run check`         | Type-checks code and validates every content file              |
| `npm run lint`          | ESLint                                                         |
| `npm run format`        | Formats every file with Prettier                               |
| `npm test`              | Unit tests                                                     |
| `npm run test:e2e`      | Browser and accessibility tests against the production build   |
| `npm run hygiene`       | Checks that nothing private or off-policy is in the repository |
| `npm run brand`         | Regenerates the wordmark, favicons, manifest and share image   |
| `npm run launch-check`  | Says whether the site is ready to go live (see below)          |
| `npm run photos:import` | Turns camera files into project photographs (see below)        |
| `npm run verify`        | Everything CI runs except the browser tests and Lighthouse     |

## Adding project photographs

```bash
npm run photos:import -- ~/Pictures/river-house masterpiece-on-the-river
```

Every JPEG, PNG and WebP in the folder is turned upright, scaled to at most 2400px on its long
edge, saved as a JPEG with its GPS position and camera details removed, and written to
`src/assets/projects/<project-id>/` under a clean name (`DJI_0042.JPG` becomes `dji-0042.jpg`).
It then prints a `cover` and `gallery` block to paste into the project's file. Every alt text in
that block is empty, so the build stops until each photograph is described.

- Existing photographs are never replaced unless you add `--force`; without it nothing is
  written.
- HEIC photographs from an iPhone are skipped with a message: the free image library bundled with
  the site cannot decode them. Export them as JPEG first (Photos: File > Export, or
  `sips -s format jpeg photo.heic --out photo.jpg` on a Mac).
- The first photograph becomes the cover; reorder the pasted lines as you like.

## Launch check

`npm run launch-check` checks each launch gate in [docs/roadmap.md](docs/roadmap.md#launch-gates)
and prints one `PASS` or `FAIL` line per gate, with what to do next for each failure. It exits
with code 1 if any gate fails, so it can also run in a script.

| Gate                          | Passes when                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Contractor license number     | `licenseNumber` is set in `src/lib/site.ts` (the footer and contact page then show it)                           |
| Office phone number           | `phone` is set in `src/lib/site.ts`, as ten digits                                                               |
| Domain                        | `site` in `astro.config.mjs` names the same host as a custom domain in `routes` in `wrangler.jsonc`              |
| Team brokerage details        | Every published real-estate licensee sets `realEstateLicensee: true` and `brokerage` in their team file          |
| No draft or sample content    | No published content file uses a placeholder image, placeholder alt text, lorem ipsum or `example.test`          |
| Lighthouse on every page type | `lighthouserc.json` audits an address of every page type, and the Lighthouse job passed on the latest `main` run |

Drafts do not fail the content gate, because the launched build hides them; the report counts them.
The Lighthouse gate reads the latest CI run on `main` with the GitHub CLI, so `gh` must be
installed and signed in; without it the gate fails and says how to check by hand. Pages built from
one template (the portfolio filters, the two legal pages) count as one page type; the groups are
listed in `PAGE_TYPE_GROUPS` in [`scripts/launch-gates.mjs`](scripts/launch-gates.mjs).

The script does not run Astro: it reads business facts from the source of `src/lib/site.ts` and
content files with a small frontmatter reader that looks only at top-level `key: value` lines.

## Configuration

Secrets are never committed. [.env.example](.env.example) lists the variable names; real values
go in a git-ignored `.dev.vars` file locally and in Cloudflare's encrypted settings in production.

The intake form needs no setup to try locally. On the development server, email goes to a log
transport (one redacted line per enquiry, nothing sent) and the spam check uses Cloudflare's
published always-pass test keys. To try the other outcomes, put Cloudflare's always-fail test
secret in `.dev.vars` as `TURNSTILE_SECRET_KEY`. A built site gets no defaults: it needs
`RESEND_API_KEY`, `LEAD_FROM_EMAIL`, `LEAD_NOTIFICATION_EMAIL`, `TURNSTILE_SECRET_KEY` and, at
build time, `PUBLIC_TURNSTILE_SITE_KEY`. The email provider and its free-tier limits are recorded
in [ADR 2](docs/adr/0002-lead-email-transport.md).

`PUBLIC_CF_ANALYTICS_TOKEN` turns on the analytics beacon in a launched build. It is public (it
appears in every page) and is set in the build settings once the owner adds the site in Cloudflare
Web Analytics; see [ADR 3](docs/adr/0003-cookieless-analytics.md).

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
