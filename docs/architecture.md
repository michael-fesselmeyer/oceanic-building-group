# Architecture

How the site is put together and where each kind of change belongs. Decisions and their reasons
are recorded in [adr/](adr/).

## Shape of the system

```
Markdown content ─┐
Photographs ──────┼─▶ astro build ─▶ static HTML, CSS, images ─▶ Cloudflare (static assets)
Pages, components ┘

Browser ── intake form POST ──▶ server endpoint (Cloudflare Worker) ──▶ email to the office
                                        └─ spam check (Turnstile + honeypot)   └─ SMS (off by default)
```

Every page is prerendered at build time. The only server code is the intake form endpoint, which
opts out of prerendering with `export const prerender = false`.

## Content model

Content lives in `src/content/<collection>/`, one Markdown file per item. The owner's step-by-step
recipes for editing it are in [content-guide.md](content-guide.md). Schemas are in
[`src/content.config.ts`](../src/content.config.ts) and are strict: an unknown or misspelled
field fails the build.

| Collection      | Holds                                                          | Used by                                |
| --------------- | -------------------------------------------------------------- | -------------------------------------- |
| `projects`      | Photographs, stats, story, category, town, progress updates    | Portfolio, project pages, home, towns  |
| `services`      | One page per service line                                      | Services pages, home                   |
| `towns`         | One page per service-area town, with map coordinates           | Town pages, Areas map, project filters |
| `team`          | Name, role, optional portrait and biography; licensee details  | About                                  |
| `testimonials`  | Quote and attribution; `aboutDesignPartner` marks partner ones | Home, project pages, Interior Design   |
| `processSteps`  | The stages of a build, in order                                | Our Process, home                      |
| `designPartner` | One file: the partner's summary, places, biography             | Interior Design                        |

Rules that apply to all of them:

- Pages read content through [`src/lib/content.ts`](../src/lib/content.ts), which applies the
  draft rule and the sort order.
- `draft: true` items show in development and preview builds and are removed from the launched
  site.
- A section with no published items renders nothing. Testimonials, for example, appear only once
  the first quote is added.
- Files whose names start with `_` are templates and are never loaded.

Business facts that appear in many places (name, address, phone, license number, the interior
design partner, navigation) live in [`src/lib/site.ts`](../src/lib/site.ts).

## Launch switch

`PUBLIC_SITE_LAUNCHED` is read at build time. Until it is `true`, every page carries a `noindex`
tag and drafts stay visible, so preview deployments can be shared without being indexed. The
Lighthouse job in CI builds with it set to `true` so the audit measures the launched site.

## Sitemap and share images

- **Sitemap.** `@astrojs/sitemap` writes `/sitemap-index.xml` and `/sitemap-0.xml` at build time,
  listing every built page except the 404 and the style guide (`isSitemapPage` in
  [`src/lib/sitemap.ts`](../src/lib/sitemap.ts)). It is registered in `astro.config.mjs` **only
  on a launched build**. Before launch every page is `noindex`, so there is nothing to list: no
  sitemap file exists and `robots.txt` names none. A launched build has no drafts and no style
  guide pages, so the sitemap needs no rule for them, and a page added later is listed without
  editing anything. `robots.txt` (`robotsTxt()`) always allows crawling and names the sitemap by
  absolute address once launched.
- **Share images.** Every page has an absolute `og:image` and `twitter:image` at 1200 x 630, with
  `og:image:width`, `og:image:height` and `og:image:alt`. A project page uses its cover and a
  service page uses its cover once it has one, both cropped to the card as JPEG by
  `shareImageFor` in [`src/lib/share-image.ts`](../src/lib/share-image.ts); a page passes the
  result to `BaseLayout` as `image`, `imageAlt` and `imageSize`. Every other page uses the default
  brand card.
- **Tests.** `tests/unit/sitemap.test.ts` covers the exclusion rule and `robots.txt`;
  `tests/e2e/share.spec.ts` reads every built page's share tags by page type; and
  `tests/e2e/sitemap.spec.ts` checks that a pre-launch build has no sitemap and that a launched
  build lists exactly the built pages. CI runs the sitemap spec in both the browser job
  (pre-launch build) and the Lighthouse job (launched build).

## Analytics

Visitor statistics come from Cloudflare Web Analytics, which sets no cookies and stores nothing in
the browser; the choice, its limits and what it collects are in
[ADR 3](adr/0003-cookieless-analytics.md).

- **One switch.** [`src/lib/analytics.ts`](../src/lib/analytics.ts) returns the beacon only when
  the site is launched and `PUBLIC_CF_ANALYTICS_TOKEN` is set (both read at build time). Previews
  and local builds never count visits. A token in the wrong shape stops the build.
- **Where.** [`Analytics.astro`](../src/components/Analytics.astro) renders, at the end of
  `<body>` through `BaseLayout`, a `<template>` holding the beacon's address and settings and a
  small bundled script ([`src/lib/analytics-loader.ts`](../src/lib/analytics-loader.ts)) that adds
  the beacon after the `load` event, once the browser is idle. Written as a plain deferred
  script, the beacon was fetched from Cloudflare's domain while a page's opening photograph was
  still painting, and on a slow phone connection that second connection held back the Largest
  Contentful Paint by more than a second. A visitor who leaves before the page has loaded is not
  counted.
- **Privacy page.** Its analytics paragraph is rendered from the same switch, so the page says the
  site collects statistics exactly when it does.
- **Tests.** Unit tests cover the switch and the loader's timing; a browser test checks that the preview build has no
  beacon on any page; the Lighthouse job builds the launched site with a made-up token and blocks
  only the beacon's report, so the script's cost counts against the budget.

## Styling

- [`src/styles/tokens.css`](../src/styles/tokens.css) defines every color, font, weight, type
  size, space, width, radius, line thickness and timing as a custom property. Brand colors were
  sampled from the logo; `--color-error` and `--color-control-border` cover form feedback and
  input outlines.
- Token names say what a value is for, not what it is: `--color-<role>` (`--color-heading`,
  `--color-border-on-strong`) over the raw palette (`--color-navy-900`), `--text-*` sizes,
  `--weight-*`, `--leading-*`, `--tracking-*`, `--space-*`, `--width-*` and `--size-*`,
  `--radius-*`, `--underline-offset-*`, `--focus-offset*`, `--duration-*`. Add a token for a new
  value only when no existing one fits, named for its role so other components can reuse it.
- **A re-skin** (new palette, typefaces, weights or proportions) edits `tokens.css` and the
  `fonts` list in [`astro.config.mjs`](../astro.config.mjs), with the font package in
  `package.json`. Nothing else needs to change. If the brand marks should follow, also point
  `scripts/build-brand.mjs` at the new font files, run `npm run brand`
  ([Brand assets](#brand-assets)) and update the `theme-color` in `BaseLayout.astro`, which a unit
  test keeps equal to `--color-navy-900`.
- **The style check** (part of `npm run hygiene`, so it runs in `verify` and CI) reads the
  `<style>` blocks of every `.astro` file under `src/` and every `.css` file there except
  `tokens.css`. It fails, with file and line, on a raw color (hex, `rgb()` and the other color
  functions, named colors), a `font-family` or `font` that is not a `--font-*` token, a numeric
  `font-weight`, and any length outside a short allowlist, `STYLE_ALLOWED_LENGTHS` in
  [`scripts/check-hygiene.mjs`](../scripts/check-hygiene.mjs): zero, the `1px` and `2px`
  hairlines (borders, outlines, underlines, inset markers), `ch` measures, and full-screen
  `100vh`, `100svh`, `100dvh` and `100vw`. Percentages, `fr`, unitless numbers and durations are
  not checked. Selectors and `@media` conditions are skipped, since custom properties cannot be
  used in a media query; `transparent` and `currentColor` are fine.
- [`src/styles/base.css`](../src/styles/base.css) holds the reset, element defaults and three
  shared helpers (`.container`, `.label`, `.visually-hidden`).
- Component styles are scoped inside each `.astro` file.
- The design is desktop-first. Base styles describe the wide layout and `max-width` queries at
  1100px, 800px and 520px simplify it.
- The footer keeps one section gap (`--section-gap`) above itself, so a page never ends with
  bottom padding of its own. The home page's contact band is the one exception: it removes the
  footer's margin so the two meet. `tests/e2e/layout.spec.ts` checks one page of each type.
- Typefaces: Newsreader for headings, Hanken Grotesk for text. Both are self-hosted through
  Astro's fonts API, so no request leaves the site.

## Motion

All motion is CSS, in [`src/styles/motion.css`](../src/styles/motion.css), and all of it sits
inside `@media (prefers-reduced-motion: no-preference)`: with reduced motion nothing below
applies. Timings and distances are the `--duration-page` and `--reveal-distance` tokens.

- **Reveals.** `SectionHeading` marks its heading `data-reveal="text"` and `Photo` marks every lazy
  `<picture>` `data-reveal`. Each rises into place across the scrolling in which it enters the
  screen (`animation-timeline: view()`, range `entry`). Photographs also fade in. Text never
  fades: it is uncovered with `clip-path`, so a heading caught half-revealed at the fold keeps its
  full contrast. Eager photographs (the one a page opens with) and captions are never revealed.
- **Never hidden without support.** The starting state exists only as the first keyframe of an
  animation declared inside `@supports (animation-timeline: view())`. A browser without
  scroll-driven animations shows everything at once. Only opacity, transform and clip-path change,
  so reveals cause no layout shift.
- **Longhands only.** The reveal rule sets `animation-name`, `animation-timeline` and the rest one
  by one. An `animation` shorthand after `animation-timeline` resets the timeline, and a minifier
  may merge or reorder shorthands. Check the built CSS after changing the rule.
- **No scroll containers around a reveal.** `view()` follows the nearest scroll container, and
  `overflow: hidden` makes one. A box that crops a revealed photograph uses `overflow: clip`
  instead (the project card's cover does), or the reveal would track that box and finish at once.
- **Page transitions.** `@view-transition { navigation: auto; }` cross-fades every same-origin
  navigation in browsers that support it. A project's photograph carries
  `view-transition-name: project-<id>` (from `projectTransitionName()` in
  [`src/lib/motion.ts`](../src/lib/motion.ts)) on its card, on the home page hero and on its page's
  cover, so it moves from one to the other, cropped rather than stretched (`view-transition-class:
project-photo`). A name must be unique on a page, so a page shows each project at most once; a
  browser test checks the home, portfolio and interior design pages.
- **The header** has its own scroll-driven animation (see [Header](#header)); the reveals use a
  different keyframe name and do not touch it.
- **The build story** on project pages has its own, scoped to
  [`ProjectBuildStory`](../src/components/project/ProjectBuildStory.astro) (see
  [Project pages](#project-pages)): sticky photographs that come forward as their captions scroll
  past, on named view timelines. Like the reveals it sits inside
  `prefers-reduced-motion: no-preference` and an `@supports` check, changes only opacity and uses
  longhands; without either it is a plain sequence of photographs and captions.

## Brand assets

The full logo (`src/assets/brand/logo-full.webp`) is too detailed for small sizes, so the site uses
marks derived from it. All of them are generated by `npm run brand`
([`scripts/build-brand.mjs`](../scripts/build-brand.mjs)) from the site's own typefaces and color
tokens; edit the script, never the output.

| File                                                                    | Used for                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/assets/brand/wordmark.svg`                                         | Header wordmark, through `src/components/Wordmark.astro`    |
| `public/favicon.svg`, `public/favicon-32.png`                           | Browser tab (SVG, with a PNG fallback)                      |
| `public/apple-touch-icon.png`                                           | 180px home-screen icon                                      |
| `public/icon-192.png`, `public/icon-512.png`, `public/site.webmanifest` | Web manifest, with the brand colors                         |
| `public/og-default.png`                                                 | 1200 x 630 share image for pages that set none of their own |

- Letters are converted to outlines with fontkit, so the files render the same everywhere and need
  no font. Colors are read from `tokens.css` and the tagline from `src/lib/site.ts`; rerun the
  script after changing either. The output is deterministic, so an unchanged input gives no diff.
- The wordmark is drawn in `currentColor`: navy on white by default, white over photography when
  the header sets its color to white. Its height is the `--wordmark-height` token.
- `Seo.astro` always writes an absolute `og:image`. Pages pass `image` to override the default
  card (see [Sitemap and share images](#sitemap-and-share-images)). Unit tests check that the manifest and the theme color match the tokens and that each file
  has the size its tag states; a browser test checks every built page's icon links and share image.

## Structured data

Every page carries one `<script type="application/ld+json">` holding a single `@graph`. It is
built by pure functions in [`src/lib/structured-data.ts`](../src/lib/structured-data.ts) and
rendered once, in `Seo.astro`, so no page writes JSON-LD by hand.

| Node                | Where                        | Built from                                                      |
| ------------------- | ---------------------------- | --------------------------------------------------------------- |
| `GeneralContractor` | Every page                   | `src/lib/site.ts`: name, legal name, address, area served, logo |
| `WebSite`           | Home page                    | The site name, with the business as publisher                   |
| `BreadcrumbList`    | Project, service, town pages | `projectCrumbs`, `serviceCrumbs`, `townCrumbs`                  |
| `WebPage`           | Project pages                | Name, description, town, main photograph, year, design partner  |

- **Only what the page shows.** The phone number and license number are added when `site.ts`
  has them (the footer shows both) and left out while they are `null`; no builder writes a
  placeholder. The design partner is credited as a contributor only on a project marked
  `interiorDesignPartner` while `site.designPartner` is set, the same rule as the visible credit.
  There are no ratings, reviews, offers or prices.
- **Breadcrumbs** go from Home through the section index to the page, with absolute addresses.
  A page passes `breadcrumbs` to `BaseLayout`; top-level pages pass nothing. `townCrumbs` is ready
  for the town pages (`/areas/` then `/areas/<town>/`).
- **Project photograph.** The project page asks Astro for the cover at 1600px wide, in its own
  proportions, and the page graph names it as an absolute address with its size and alt text.
- **Extra nodes** for a new page type go through the `structuredData` prop of `BaseLayout`, built
  by a new pure function with its own unit tests.
- The JSON is serialized with `<` escaped, so text in a title can never end the script early.
- Tests: `tests/unit/structured-data.test.ts` checks each builder's shape and that null facts
  disappear; `tests/e2e/structured-data.spec.ts` walks the build and checks every page has one
  block with one business, breadcrumbs exactly on nested pages, and a reachable project photograph.

## Components

Shared building blocks live in [`src/components/`](../src/components/). Each file starts with a
comment that says when to use it and what each prop does. Pages compose these instead of styling
their own versions.

| Component                  | Use it for                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Button`                   | The main action of a section. `primary` or `quiet`; `<a>` with `href`, else `<button>`                            |
| `TextLink`                 | An underlined link inside or after a sentence                                                                     |
| `SectionHeading`           | A section's heading with an optional small label; `level` keeps headings in order                                 |
| `Photo`                    | Every photograph: AVIF and WebP, required `alt`, `widths` and `sizes`, optional caption; lazy ones rise into view |
| `PullQuote`                | A testimonial or a line from a project story, with optional attribution                                           |
| `StatList`                 | Label and value facts; missing values are skipped, an empty list renders nothing                                  |
| `ProjectCard`              | A project's cover (3:2, or another `ratio`), category, title and location, linking to `/portfolio/<id>/`          |
| `Wordmark`                 | The brand wordmark in the current text color (used by the header)                                                 |
| `Seo`                      | Title, description, canonical, share tags and JSON-LD (used by the layout)                                        |
| `SiteHeader`, `SiteFooter` | The page frame (used by the layout); see [Header](#header)                                                        |

Components used by a single page type live in a subfolder named after it. `project/` holds the
project page's parts: `ProjectArticle` (the whole page body), `ProjectGallery`,
`ProjectProgress`, `ProjectBuildStory` and `ProjectPager`; see [Project pages](#project-pages). `design-partner/` holds
`DesignPartnerArticle`, the body of the interior design page; see
[Interior design page](#interior-design-page). `home/` holds the home page's sections, from
`HomeHero` to `ContactBand`; see [Home page](#home-page). `about/` holds `TeamList`, the team on
the About page; see [About page](#about-page).

Rules they share: optional data that is missing renders nothing (no empty wrappers, no
placeholders), styles come only from tokens, and a parent spaces a component with its own layout
rather than by styling the component's insides. [`src/lib/stats.ts`](../src/lib/stats.ts) turns a
project's stats into the pairs `StatList` shows.

### Header

[`SiteHeader`](../src/components/SiteHeader.astro) is the frame's one piece of behavior, all of it
in CSS:

- **Solid by default.** Pages without a photograph at the top keep a solid, sticky header.
- **Over a hero.** A page opts in with `<BaseLayout overHero>`, and its first element inside
  `<main>` must be the photograph section. The header then leaves the flow and floats over the
  photograph with white text, a white contact button and a navy scrim behind the text
  (`--header-scrim-strength`; a unit test keeps white text on the worst case, a white photograph,
  at 4.5:1).
- **Turning solid.** `BaseLayout` gives that first element a named view timeline (`--hero`) and
  shares it with the header through `timeline-scope` on `<body>`. The header animates one
  registered custom property, `--header-solid`, from 0 to 1 over the last header-height of
  scrolling before the photograph ends; every color, the scrim and the blur derive from it. The
  whole block sits behind `@supports (animation-timeline: --hero)`, and `--header-solid` is 1 by
  default, so a browser without scroll-driven animations gets the solid header from the start.
  With reduced motion the change is a single step instead of a fade.
- **Menu below 1100px.** The navigation is a `popover`: it opens, and closes on Escape or an
  outside tap, with no JavaScript. Opening it makes the bar solid (`:has(:popover-open)`) so the
  bar and the sheet read as one piece over a photograph. It takes over at 1100px because the
  wordmark, the five links and the contact button need about 960px in one line; a browser test
  checks widths from 801px to 1280px for wrapping and sideways scroll.
- **Without popover.** Every menu rule sits behind `@supports selector(:popover-open)`. A browser
  without popover (Safari before 17) shows no Menu button, which could not open anything there:
  the links wrap under the wordmark and the header scrolls with the page. A browser test removes
  the attribute and those rules to check it. The header also declares `--header-solid: 1`
  directly, so a browser without `@property` still gets the solid colors.
- **Current page.** [`currentState`](../src/lib/nav.ts) compares paths with a trailing slash: the
  exact page gets `aria-current="page"` and a section link gets `aria-current="true"` (Portfolio
  while viewing a project). The home link matches only the home page. The marker is a thicker
  underline, so it does not rely on color.

### Style guide

`/style-guide/` shows every component and variant, including the edge cases (no caption, partial
and empty stats, long titles, a project with no location). Check it after changing a component.
`/style-guide/project/` shows the project page with every part filled in (gallery, the story of
how it was built, design partner credit, both neighbors), `/style-guide/project/sparse/` shows one
with only the required fields, `/style-guide/project/progress/` shows an under-construction
project with four progress updates written out of order, one of them without a photograph, and
`/style-guide/project/short-story/` a finished project with only two progress photographs, which
gets no build story. `/style-guide/interior-design/` shows the interior design page with a made-up partner,
credited projects, testimonials and a long biography, and `/style-guide/interior-design/no-partner/`
shows it with no partner set. `/style-guide/home/` shows every home page section filled with
made-up content (four featured projects, one with a long title and one with no location, and three
testimonials), `/style-guide/home/one/` one featured project and one testimonial, and
`/style-guide/home/none/` the page with every collection empty and no design partner. The main
style guide page shows the team list with a portrait, a licensee and a long name. Their made-up
data is in
[`src/lib/examples.ts`](../src/lib/examples.ts). These pages exist
in development and preview builds only: their `getStaticPaths` return no pages when
`PUBLIC_SITE_LAUNCHED` is `true`, and they are always marked `noindex`.

## Home page

[`src/pages/index.astro`](../src/pages/index.astro) reads the content and composes the sections
in order: hero, featured projects, services, process, design partner, testimonials and the contact
band. Each section is a component in `src/components/home/` that takes plain data (the shapes are
in [`src/lib/home.ts`](../src/lib/home.ts)), so the style guide can feed it made-up content. Every
section but the hero and the contact band renders nothing when it has nothing to show.

- **Hero photograph.** The first featured project (lowest `order`) supplies the photograph, and a
  caption line under the text names it and links to its page. `splitFeatured()` in
  [`src/lib/home.ts`](../src/lib/home.ts) makes the split, so that project is not shown again in
  the list below.
- **Art direction.** [`HomeHero`](../src/components/home/HomeHero.astro) builds its own
  `<picture>` with `getImage()`: a landscape screen gets the cover as it is (960 to 2400px wide)
  and a portrait screen gets a 3:4 crop from its middle (480 to 1200px), each in AVIF and WebP
  with a JPEG fallback. A phone therefore downloads a file it shows nearly whole. The crop is
  centered; a cover whose subject is far off-center will need a focal point field in the schema.
- **Loading.** The hero image is `loading="eager"` with `fetchpriority="high"`, as the page's
  largest paint. Every other image on the page is lazy.
- **Text over the photograph.** White text sits on a navy scrim at `--hero-scrim-strength` behind
  the whole text block, fading out above it. A unit test keeps white text at 4.5:1 over the worst
  case, a white photograph.
- **Nothing featured.** The hero becomes a navy band with the same text and button, and the
  featured section is not rendered. This is also what the Lighthouse job measures, because it
  builds the launched site, where today's draft projects are hidden.
- **Featured layout.** [`FeaturedProjects`](../src/components/home/FeaturedProjects.astro) repeats
  a pattern of three `ProjectCard`s on a 12-column grid: a large landscape cover (7 columns), a
  portrait one set lower on the right (4 columns, spanning two rows) and a medium landscape one
  under the first (5 columns). A single card is shown large on its own. At 800px the pattern
  becomes two columns, and at 520px one, with the portrait card inset.
- **Services.** [`HomeServices`](../src/components/home/HomeServices.astro) lists the `services`
  collection as a numbered, ruled index beside a short introduction that stays in view on wide
  screens. Each title links to its page and the whole row is clickable.
- **Process.** [`HomeProcess`](../src/components/home/HomeProcess.astro) shows only the stage
  titles of `processSteps`, numbered from their position, along a ruled timeline on a sand band:
  one row on wide screens, four and then two columns below 1100px and 800px, a plain list on
  phones. A stage's typical length appears only when its file has one. It links to `/process/`.
- **Design partner.** [`HomePartner`](../src/components/home/HomePartner.astro) sets the partner's
  name beside one sentence about working together, her summary and where she is based, with a
  link to `/interior-design/`. It is not rendered while `site.designPartner` is `null`.
- **Testimonials.** [`HomeTestimonials`](../src/components/home/HomeTestimonials.astro) shows
  quotes from `getTestimonials()` (those about the design partner stay on her page): the first
  set large with `PullQuote`, up to two more smaller beside each other. A quote names its project
  only when that project is published. With no published testimonial the section is left out.
- **Contact band.** [`ContactBand`](../src/components/home/ContactBand.astro) is always the last
  section. It sits on the pale ocean surface, and the footer meets it with no gap (the band
  removes the footer's top margin when it ends `<main>`). The office's address is in the footer, so
  the band does not repeat it.
- **Copy.** The headline, tagline, service area and the services introduction come from
  [`src/lib/site.ts`](../src/lib/site.ts). Experience is the principals' 30+ years, never the
  company's age.

## Project pages

`/portfolio/<project>/` is built from
[`src/pages/portfolio/[project].astro`](../src/pages/portfolio/[project].astro) for every project
`getProjects()` returns, so drafts get pages only in development and previews. The file name of
the content entry is the address.

- **Order.** Previous and next follow portfolio order (`order`, lowest first). The list does not
  wrap: the first project has no previous link and the last has no next, so a short portfolio
  never links a project to itself. `neighbors()` in
  [`src/lib/project-page.ts`](../src/lib/project-page.ts) does this.
- **Empty parts.** Stats, features, construction progress, the gallery, before and after, the build story, the facts under the title
  (location, style, year), the design partner credit and the neighbor links each disappear
  entirely when the project has nothing for them.
- **Status.** An `under-construction` project carries an "Under construction" label next to its
  category, on its page and on its card.
- **Construction progress.** A project's `progress` list holds dated updates: a `date`
  (year-month-day), a short `caption` and, usually, a `photo` with its `alt` text (the schema
  refuses a photo without alt, or alt without a photo). While the project is `under-construction`
  and has at least one update, its page shows a "Construction progress" section after the story,
  with the date of the latest update beside the heading.
  [`ProjectProgress`](../src/components/project/ProjectProgress.astro) lists the updates newest
  first (`progressNewestFirst()` in [`src/lib/project-page.ts`](../src/lib/project-page.ts); on the
  same day the one written later in the file comes first), each with its date in a `<time>`
  element. Photographs are cropped to 3:2 beside their date and caption and open in the lightbox
  with the date and caption under them; an update without a photograph is text only. Dates are
  formatted in UTC ("March 4, 2026") so they never shift a day with the build machine's time zone.
  Once the project is `completed`, the section is no longer shown and the updates stay in the file;
  the gallery takes over, and the photographed updates may tell how it was built (below). Project cards in the portfolio (including the "Under construction"
  filter) and on the home page add "Updated" and that date. How to add an update, in plain words,
  is in `src/content/projects/_template.md`.
- **How it was built.** A `completed` project with at least three progress updates that have a
  photograph (`BUILD_STORY_MIN_STAGES`) shows a "How it was built" section after the gallery.
  `buildStoryStages()` in [`src/lib/project-page.ts`](../src/lib/project-page.ts) picks the
  photographed updates, oldest first (same-day updates keep their order in the file), and returns
  none for fewer than three or while the project is under construction.
  [`ProjectBuildStory`](../src/components/project/ProjectBuildStory.astro) renders them as a list
  of figures, each photograph (3:2, lazy, the same `widths` and `sizes` as the progress list)
  captioned by its date and words. The base styles are a plain sequence: photograph beside
  caption on wide screens, photograph above caption below 800px. On screens wider than 800px,
  without reduced motion and where `@supports (animation-timeline: view()) and (timeline-scope:
--stage)` passes, the story is told in place: each list item spans the whole list and passes
  its rows down with `subgrid`, so the photographs stack in the first column, `position: sticky`
  below the header, while each caption has its own row (70svh) in the second. Each caption
  declares a view timeline, `--stage`, which `timeline-scope` on its figure keeps to its own
  photograph; every photograph after the first fades in (opacity only, linear, `cover 35%` to
  `cover 55%`) as its caption rises to the middle of the photograph and fades out again when
  scrolled back. The photographs are not lightbox links: the story is a sequence to scroll, and
  the gallery above is where photographs open large. `tests/e2e/build-story.spec.ts` covers
  presence and absence, order, alt text and sources, axe, the in-place behavior, the phone and
  reduced-motion sequences, and that the motion rules sit behind both conditions.
- **Lightbox, shared.** The dialog and its script live in
  [`Lightbox.astro`](../src/components/project/Lightbox.astro), placed right after any list
  that carries `data-gallery`; the gallery and the progress list both use it.
- **Design partner.** The credit appears only when the project sets `interiorDesignPartner: true`
  and `site.designPartner` in [`src/lib/site.ts`](../src/lib/site.ts) is not `null`. It links to
  `/interior-design/`.
- **Gallery.** Photographs are stacked one per row at the column width on every screen; a portrait
  one is centered and kept within the `--photo-max-height` token. The list carries `data-gallery`
  and each item `data-gallery-item`, `data-gallery-index` and an id (`photo-1`...).
- **Before and after.** A project's optional `beforeAfter` list (up to six pairs, each with its
  own alt text and an optional caption) appears after the gallery under "Before and after",
  rendered by [`BeforeAfter.astro`](../src/components/project/BeforeAfter.astro). Both photographs
  are cropped to 3:2 and load lazily. Without JavaScript they sit side by side (one above the other
  on phones) under "Before" and "After" labels, and the range input ships `hidden`. A short script
  stacks them, shows the range over the photograph (transparent, so a drag anywhere moves it) and
  sets `--split` from its value; the "before" side is cut with `clip-path`, a line and knob mark
  the split, and the frame takes the focus ring. Arrows, Home and End move it, and
  `aria-valuetext` says how much of the before is showing. The audited fixture project carries a
  pair, so the budget covers it. `tests/e2e/before-after.spec.ts` covers the section, keyboard
  use, the stacking, the no-script fallback and axe.
- **Lightbox.** Each photograph links to a large version (WebP, at most 2400px wide), so with no
  JavaScript it opens as a plain image. A short script (about sixty lines, no library) in
  `Lightbox.astro` upgrades the links: a click opens the large image in a `<dialog>` (`showModal`, so focus stays
  inside and Escape closes it) with previous, next and close buttons at 48px, the arrow keys and a
  horizontal swipe, and focus returns to the photograph that opened it. The large image gets its
  address only on open and loses it on close, so nothing large loads until asked. Alt text comes
  from the thumbnail and a caption from the item's `<figcaption>` when it has one; gallery
  photographs have no caption field yet, while progress photographs show their date and caption. Modified clicks (new tab) are left alone.
  `tests/e2e/lightbox.spec.ts` covers the no-script links, open, arrow keys, buttons, Escape and
  focus, swipe, captions and axe, against the style guide's project example.
- **Sharing.** The cover, cropped to 1200 x 630, is the page's share image. The description is
  `seoDescription`, or the summary when that is not set.

## Images

Masters go in `src/assets/` at no more than 2400px on the long edge and are referenced from
content files by relative path. Astro generates responsive sizes in modern formats at build time
and writes width and height attributes, which prevents layout shift. Components must pass
`widths` and `sizes` so phones download a small file.

The photograph a page opens with (the home hero and the project cover) is its Largest
Contentful Paint. The browser would only find it in the body, after the font preloads in the
head, and on a slow connection it would wait behind about 160KB of fonts. So
[`src/lib/hero-photo.ts`](../src/lib/hero-photo.ts) computes the photograph's sources once:
the page renders them and passes the AVIF ones to `BaseLayout` as `preloadImages`, which writes
`<link rel="preload" as="image">` with `imagesrcset`, `imagesizes` and `fetchpriority="high"`
ahead of the fonts. Both come from the same call, so the addresses match and nothing downloads
twice; `tests/e2e/hero-preload.spec.ts` checks the match, the order and the single download. A
new page that opens with a photograph should do the same; one that opens with text needs nothing.

Project photographs come in through `npm run photos:import -- <folder> <project-id>`
([`scripts/import-photos.mjs`](../scripts/import-photos.mjs), with the work in
[`scripts/photo-import.mjs`](../scripts/photo-import.mjs)), using sharp, which Astro already
needs:

- **Masters.** Each file is rotated upright from its EXIF orientation, fitted inside 2400 x 2400
  without enlarging, flattened onto white, converted to sRGB and saved as a JPEG at quality 90
  (Astro re-encodes it for the page). Output goes to `src/assets/projects/<project-id>/`.
- **No metadata.** sharp writes no EXIF, XMP, IPTC or ICC data unless asked, and the pipeline
  never asks, so GPS positions, camera and lens details, dates and owner names are gone. A unit
  test writes a photograph with a made-up GPS position and camera and checks the master has none.
- **Alt text cannot be skipped.** The printed `cover` and `gallery` block has `''` for every alt
  text. The schema requires at least 10 characters, so `astro check` and the build fail, naming
  each field, until a person writes them.
- **Safe to rerun.** Clean names are lowercase words joined by hyphens; names that clean to the
  same thing get `-2`, `-3`. If any target file exists, nothing is written unless `--force` is
  given. The project id must be a content file name, so it cannot point outside the folder.
- **HEIC** is tried and, when the bundled libvips cannot decode it (it reads HEIF only as AVIF,
  not the HEVC an iPhone writes), skipped with instructions to export JPEG. Decoding HEVC would
  need licensed codecs, so the site does not add them.
- The unit tests generate their photographs with sharp at run time; no test images are committed.

## Portfolio pages

`/portfolio/` and one page per filter (`/portfolio/custom-homes/`, `/renovations/`, `/commercial/`
and `/under-construction/`) share [`PortfolioLayout`](../src/layouts/PortfolioLayout.astro). The
filters are defined in [`src/lib/portfolio.ts`](../src/lib/portfolio.ts): each has a slug, a
label, its own title and description, and a rule for which projects it shows.

- **No JavaScript.** The filter bar is a list of links to prerendered pages, with `aria-current`
  on the current one. Each filter page has its own title, description and canonical address, and
  the index links to all of them, so crawlers find them.
- **Filters with no projects are not offered.** The bar lists only filters that match at least
  one project, and is left out when no filter would narrow the list (for example when every
  project is a custom home). A filter page whose list is empty still builds, shows a short
  message with a link back, and is marked `noindex`.
- **Static files, not a dynamic route.** The filter pages are separate `.astro` files so they take
  priority over the project page at `/portfolio/[project]/`. A project whose id equals a filter
  slug would therefore be unreachable, and a unit test fails if one is added.
- **Layout.** Cards repeat a pattern of four widths on a 12-column grid (8, 4, 5, 7) and become one
  column at 800px. Cards are `ProjectCard`s, so a cover, category and title are all one link.

To add a filter, add it to `PORTFOLIO_FILTERS`, add a page next to the others that passes it to
`PortfolioLayout`, and add it to the filter list in `tests/e2e/portfolio.spec.ts`.

## Areas pages

`/areas/` lists the towns beside a drawn map of the coast, and `/areas/<town>/` has one page per
town, from one Markdown file each in `src/content/towns/`. The fields are `name`, `county`,
`latitude`, `longitude`, `summary`, `seoDescription`, `order`, `draft` and a Markdown body.

- **Local copy.** Each town's file is written for that town: its setting, the building rules that
  apply there, and how permits work. Every claim about a code, a permit or a municipality is
  checked against an official page (the Florida Department of Environmental Protection, Palm Beach
  County's floodplain page, the town's own site) and kept general where it could not be confirmed.
  Do not copy a paragraph between towns; a fact that holds for one place is not a template. The
  High-Velocity Hurricane Zone is deliberately not mentioned, because it was not checked against an
  official source.
- **Projects.** A project's `town` field (the file name of a town) puts it on that town's page and
  turns the Location fact on the project page into a link. A town with no projects shows one plain
  sentence pointing to the portfolio and contact instead of an empty section. `projectsInTown` in
  [`src/lib/towns.ts`](../src/lib/towns.ts) does the matching. A project whose location is not a
  town (a river, a community) leaves `town` unset.
- **Page parts.** Opening band with a link back to `/areas/`, the Markdown body beside a list of all
  towns, the town's projects, the services, and a call to action. The footer links to `/areas/`
  (`areasLink` in `src/lib/site.ts`); the main navigation does not.
- **Map.** The index draws the coast from Hobe Sound to Wellington as inline SVG at build time:
  the Atlantic shore, the Intracoastal Waterway, the Loxahatchee River and a mark for each town
  that links to its page, labeled with its name and, where there are projects, their count. There
  is no map service, no tiles and no script.
  - _Coordinates._ Each town's `latitude` and `longitude` are required. The schema refuses a town
    outside `TOWN_BOUNDS` (latitude 26.62 to 27.1, longitude -80.3 to -80.03, northern Palm Beach
    and southern Martin counties), a margin inside the drawn area, so a mark never falls off the
    map. The current values are the internal points of each place in the Census Bureau's 2023
    Gazetteer, rounded to four decimals (about 10 m).
  - _Projection._ `createProjection` in [`src/lib/areas-map.ts`](../src/lib/areas-map.ts) is
    equirectangular: longitude is multiplied by the cosine of the map's middle latitude so a mile
    east and a mile north are the same length, and north is up. At this size the distortion is
    well under a pixel. The drawing is 400 units wide, about the width it is shown at, so the labels'
    CSS sizes come out close to the token sizes.
  - _Labels._ `placeTowns` puts each label to the right of its mark, or to the left when the right
    would leave the map or cover a label or mark already placed, working north to south from an
    estimate of the text's width. The browser test measures the real labels and fails if any two
    overlap; a new town that collides needs a smarter rule there, not a hand-placed exception.
  - _Geography._ [`src/lib/coast-geography.ts`](../src/lib/coast-geography.ts) holds the outlines
    as longitude and latitude pairs, about 700 points. Source: US Census Bureau, public domain (works
    of the US Government, no licence needed). The coastline is the 2023 cartographic boundary file
    of counties at 1:500,000 (`cb_2023_us_county_500k`), Martin and Palm Beach counties dissolved and
    clipped to `MAP_BOUNDS`. The Intracoastal Waterway and the Loxahatchee River are the named
    water bodies (Intracoastal Waterway, Hobe Sound, Jupiter Sound, South Jupiter Narrows, Lake
    Worth, Lake Worth Creek, Little Lake Worth; Loxahatchee River and its forks) from the 2024
    TIGER/Line area hydrography of the same counties (`tl_2024_12085_areawater`,
    `tl_2024_12099_areawater`), merged. Both were simplified with mapshaper
    (`-simplify interval=60`, dropping points closer than about 60 m) and written out with four
    decimals.
  - _Regenerating._ Only needed to move or enlarge the map. Download the three files into an empty
    folder outside the repository, run the clip, filter and simplify steps above with mapshaper,
    and write the result in the same shape as the existing module: the coastline from the north
    edge to the south edge, then the water outlines. Keep the conversion script outside the
    repository too; only the coordinate module is committed. Raise `MAP_BOUNDS` and `TOWN_BOUNDS`
    together, and keep the module small: the whole map is inlined in the page.
  - _Accessibility._ The SVG has a title and a description that names the towns, and the town
    list beside it carries the same links, so nothing depends on the picture. Hover and keyboard
    focus look the same: a ring around the mark and the name underlined in the link color. Labels
    have a halo in the page color so they stay legible over the coast.
  - _Layout._ Beside the list from 4 of 12 columns on a wide screen (5 below 1100px), and sticky so
    it stays in view while the list scrolls. Below 800px it follows the list at up to
    `--width-map`. Below 520px it is left out: at phone width the labels would be too small to read
    or tap, and the list says the same thing.
- **Search.** Titles read "Building in <town>". Each town page carries breadcrumbs (Home, Areas We
  Serve, the town) through `townCrumbs`, and the sitemap lists every page automatically.
- **Tests.** `tests/unit/towns.test.ts` covers the helpers; `tests/e2e/areas.spec.ts` walks the
  files in `src/content/towns/` and checks each page (one heading, local copy, services and contact
  links, title and description, axe, no sideways scroll), the index, the footer link, a town with
  projects, a town without, the project-to-town link and the breadcrumbs. For the map,
  `tests/unit/areas-map.test.ts` covers the projection, the bounds, every town file's coordinates,
  the geography and label placement, and the browser test checks the map's title and description,
  a labeled link to every town, project counts, that no two labels overlap, that hover and focus
  look the same, and that phones leave it out.

## Services pages

`/services/` introduces the four service lines as an editorial index, and
[`/services/[service].astro`](../src/pages/services/[service].astro) builds one page per file in
`src/content/services/` (`custom-homes`, `renovations`, `commercial`, `investors`). The file name is
the address. The Markdown body is the description; its first paragraph is set large and each `##`
heading starts a ruled section.

- **Related projects come from the portfolio by category.** [`src/lib/services.ts`](../src/lib/services.ts)
  maps a service's file name to a project category (`custom-homes` to `custom-home`, and so on),
  because the services schema has no field for it. A page shows up to two related projects as
  `ProjectCard`s and a link to the matching portfolio page. When no project matches, the section
  and its heading are not rendered, so a launched site with no commercial projects shows a short
  page with no gap. A unit test covers the mapping and an e2e test checks the page both ways.
- **Investor partnerships show no projects.** Speculative homes are not a project category, so the
  mapping is `null` and the page is text only. Change that by mapping it to a category.
- **No photograph needed.** The opening band is navy with the title, the summary and the service's
  number. When a service file sets `cover` and `coverAlt`, the photograph replaces the number.
- **Siblings, not a card row.** Beside the text, a list of all services (with the current one
  marked) replaces a grid of cards. On narrow screens it moves below the text.
- **Adding a service** means adding a Markdown file with a related category in
  `src/lib/services.ts` (or `null`), and adding it to the list in `tests/e2e/services.spec.ts`.

## Process page

`/process/` ([`src/pages/process.astro`](../src/pages/process.astro)) lists the `processSteps`
collection in order. One Markdown file per stage in `src/content/process/`: the title and the
`order` number are in the fields, the description is the body. Copy `_template.md` to add one.

- **Numbers come from the order.** The large numerals are the stage's position in the sorted list,
  not a field, so inserting a stage renumbers the rest. Leave gaps in `order` (10, 20, 30).
- **Durations are optional.** A stage shows "Typical length" only when its file has a `duration`;
  otherwise nothing is rendered. Only construction has one, a fact the business supplied. Do not
  add a duration to another stage until the business provides it.
- **Empty state.** With no published stage the page shows a short message and still ends with the
  link to `/contact/`.
- **Layout.** A numeral column, a vertical rule with a marker at each stage, and the stage text.
  The rule and markers drop out at 520px, where the stages become a plain ordered list.
- **No JavaScript.**

## About page

`/about/` ([`src/pages/about.astro`](../src/pages/about.astro)) tells the company story and lists
the team.

- **The story uses confirmed facts only.** The text is in the page file: what the company builds
  (custom homes, renovations, commercial work, investor partnerships), help from site selection
  and architectural help through to interior design, and a plan, budget and realistic timeline at
  the start. Experience is always the principals' (`site.principalsExperienceYears`, shown as
  "30+ years"), never the company's age. The office town and service area come from
  [`src/lib/site.ts`](../src/lib/site.ts) through [`src/lib/about.ts`](../src/lib/about.ts).
- **One file per person** in `src/content/team/`, copied from `_template.md`: name, role, an
  optional portrait and an optional biography as plain paragraphs in the body (Markdown
  formatting is not supported there). [`src/lib/team.ts`](../src/lib/team.ts) shapes each entry for
  [`TeamList`](../src/components/about/TeamList.astro).
- **Text-only first.** Without portraits each person is a name and role on a rule, three to a row
  (two at 1100px, one at 520px). When anyone has a portrait, each entry spans a portrait row and a
  text row through `subgrid`, so names still line up across a row. The portrait's alt text is
  "Portrait of" and the name.
- **Real estate licensees.** Florida requires a licensee's advertising to give the licensed name
  of their brokerage, and to use the licensee's name as registered. A team member with
  `realEstateLicensee: true` therefore needs `brokerage`, shown under the role, and `name` must be
  the registered name. The schema refuses to publish a licensee without a brokerage with a plain
  message, and `getTeam()` never returns one, even in previews. A brokerage on someone who is not a
  licensee is also refused. The business should confirm these details with the brokerage before
  launch.
- **Empty team.** With no published member the team section is left out.

## Interior design page

`/interior-design/` ([`src/pages/interior-design.astro`](../src/pages/interior-design.astro))
presents the builder's interior design partner. The layout is in
[`DesignPartnerArticle`](../src/components/design-partner/DesignPartnerArticle.astro); helpers
for its facts and description are in [`src/lib/design-partner.ts`](../src/lib/design-partner.ts).

- **Where each part comes from.** The name and website are business facts in `site.designPartner`
  ([`src/lib/site.ts`](../src/lib/site.ts)). The summary, search description, where the partner is
  based and works, and the biography (the Markdown body) are in the one file in
  `src/content/design-partner/`. A second published file there stops the build with a plain
  message, so it is never silently ignored. Credited projects are those with
  `interiorDesignPartner: true`, in portfolio order. Testimonials with `aboutDesignPartner: true`
  appear here and are left out of `getTestimonials()`, so a quote about the designer is never
  shown as one about the builder.
- **Why a collection and a field.** The biography is long text the business will edit, so it
  belongs in a Markdown body like every other piece of prose; a one-file collection gives it that
  without a new kind of loader. Partner quotes are still testimonials (same attribution, project
  link, order and draft rules), so one boolean marks them instead of a second collection.
- **Sections without content render nothing.** No credited project, no partner testimonial or an
  empty biography each leave their section out, heading included. No part of the page needs a
  photograph: the opening band carries the name, summary and facts in type alone.
- **No partner set.** When `site.designPartner` is `null`, the page says the partner will be
  introduced soon, keeps the contact link and is marked `noindex`.
- **Closing.** The page ends with a link to the partner's website and the contact button.
- **Credit on project pages.** The project page credit links here; see
  [Project pages](#project-pages).

## Intake form

`/contact/` ([`src/pages/contact.astro`](../src/pages/contact.astro)) holds the form beside the
office details. The page body is
[`src/components/contact/ContactPage.astro`](../src/components/contact/ContactPage.astro), shared
with the endpoint so it can show the form again, filled in.

1. **One schema.** [`src/lib/intake.ts`](../src/lib/intake.ts) defines the fields (name, email,
   optional phone, project type, message), their length limits, the project types with their
   display labels, and every message a visitor can see: the per-field errors and the `notices`
   shown above a form that comes back. The page renders its inputs and `required`, `maxlength`,
   `minlength` and `pattern` attributes from these values, and the endpoint validates with
   `parseIntake()`, which returns one message per field. The messages are plain sentences grouped
   in objects so the business can reword them.
2. **Follow-up questions.** Under the project type sit a few optional questions, defined in
   `followUps` in the same file: where (the towns from the towns collection, through
   `getTowns()`, then "Somewhere else") and when to start for every type; whether the lot is
   owned and whether there are plans for a custom home; what kind of renovation; what kind of
   building for commercial work (one line, 80 characters); and what an investor is interested
   in. There is no budget question. Radio groups are fieldsets with legends, the town is a
   select, and each is marked optional.
   - **Revealed with CSS.** The questions stay hidden until a type is chosen, then the ones for
     that type show, by `:has()` rules inside `@supports selector(:has(*))` that match each
     question's `data-for` list. A new type with questions of its own needs a line in those
     rules. A browser without `:has()` shows every question. Hidden questions are out of the
     focus order, so focus moves from the type straight to its questions and on to the message.
   - **Checked on the server.** `parseIntake()` keeps only answers to questions for the chosen
     type whose value is on the list (the town against the published towns, the endpoint
     passing `townChoices(await getTowns())`), and the building text when it fits on one line
     within its limit. Everything else is dropped without an error: answers left over when a
     visitor switches type (a hidden field still posts), values not on the list, and over-long
     text. Follow-ups never stop an enquiry. Reading the towns brings the content data layer
     (about 80 KB) into the Worker.
   - **In the email.** Answers are kept in plain words, in form order, and listed under the
     message as "About the project:" lines (`Where: Tequesta`, `Start: Within 6 months`). The
     section is left out when nothing was answered. The idempotency key covers them, and the log
     line names which questions were answered, never the answers.
3. **Works without JavaScript.** The form posts to `/api/intake/` with `method="post"`, and the
   browser's own validation stops an incomplete form. The endpoint answers with a redirect to
   `/contact/thanks/` or with the form again; nothing needs a script.
4. **Enhanced with a small script** (in the component, no dependencies, no schema library shipped
   to the browser). It turns off the browser's bubbles, writes the message under each field, ties
   it to the control with `aria-describedby` and `aria-invalid`, lists every problem in a summary
   at the top of the form, and moves focus to the first answer to fix. After the first attempt,
   each message clears as the answer is corrected. It reads the messages from `data-` attributes
   rendered from the schema, so wording lives in one place. It also stops a second click from
   posting the same enquiry twice.
5. **Honeypot.** A text field named `website` sits off-screen inside an `aria-hidden` wrapper with
   `tabindex="-1"` and `autocomplete="off"`. It is moved off-screen rather than hidden with
   `display: none`, because some programs skip undisplayed fields. It is hidden from assistive
   technology and the tab order instead of labelled "leave this empty", so no visitor, sighted or
   not, ever meets an instruction that makes no sense to them. The endpoint drops any submission
   where `isHoneypotFilled()` is true and answers it like a success, so the sender learns nothing.
6. **Turnstile.** The form carries Cloudflare's Turnstile widget, whose script loads on the contact
   page only. It adds a `cf-turnstile-response` token that the endpoint verifies with Cloudflare
   ([`src/lib/turnstile.ts`](../src/lib/turnstile.ts)). Cloudflare's answer must also name the host
   the form was posted to, so a token solved anywhere else the site key allows (a preview host,
   `localhost`) is refused. The site key is `PUBLIC_TURNSTILE_SITE_KEY`, read at build time;
   development and preview builds fall back to Cloudflare's always-pass test key, and a launched
   build without a key renders no widget (a test key would fail every visitor against a real
   secret).
7. **No JavaScript, no token.** Without JavaScript the widget never runs, so the post has no
   token. By default the endpoint still sends it, relying on the honeypot, and marks the email's
   subject `[spam check not run]`. If spam arrives that way, set `TURNSTILE_REQUIRED=true`: posts
   without a token then get the form back with a notice asking the visitor to turn JavaScript on
   or use the office details. A token that is present and fails (forged, expired or already used)
   is always refused, with the form kept and a fresh widget.
8. **Leads are not stored.** The email to the office is the record.

### The endpoint

[`src/pages/api/intake.astro`](../src/pages/api/intake.astro) is the only on-demand route
(`export const prerender = false`). It is an `.astro` page rather than a `.ts` endpoint so it can
render the form with what the visitor typed, without putting their answers in an address or a
cookie. The work happens in [`src/lib/intake-handler.ts`](../src/lib/intake-handler.ts), which is
unit tested without a server:

| Request                                   | Answer                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| Sent, or the honeypot was filled          | `303` to `/contact/thanks/` (prerendered, `noindex`)      |
| An answer needs fixing                    | `422`, the form with every answer and a message per field |
| Spam-check token refused                  | `400`, the form with a notice                             |
| Email failed, spam check down, not set up | `503`, the form with a notice and the office details      |
| Not form data / over 64 KB / unreadable   | `415` / `413` / `400`, one line of text                   |
| `GET` (someone opens the address)         | `303` to `/contact/`                                      |

- **Body limit.** A declared `Content-Length` over 64 KB is refused before reading, and a body
  without one is read only up to the limit. The longest legitimate form is about 35 KB.
- **Cross-site posts.** Astro's `security.checkOrigin` (on by default) refuses form posts to
  on-demand pages whose `Origin` is another site, with `403`.
- **Repeated submissions.** The script ignores a second click while the first post is on its
  way. Each lead also gets a key hashed from its answers, sent to the email provider as its
  idempotency key, so an identical enquiry within 24 hours (a double click without JavaScript, a
  resent form) is delivered once. The handler keeps no memory of its own.

### Notifier

[`src/lib/notify/`](../src/lib/notify/) sends a lead through a list of channels. The endpoint
calls only `notifier.notify(lead)`; [`notify/index.ts`](../src/lib/notify/index.ts) decides which
channels are on.

- **Channels** have a name, a `required` flag and `send(lead)`, which returns a result instead of
  throwing. All channels run at the same time, and a channel that fails or throws does not stop
  the others. A lead counts as delivered when every required channel succeeds. Email is the one
  required channel; SMS is optional, so a failed text is logged (`[intake] sms failed: ...`) and
  the enquiry still counts as sent. Failures name the provider's error code and how many
  recipients failed, never the recipients.
- **Email transports.** `resend` calls Resend's API with `fetch` (no SDK), with an 8-second
  timeout and one retry on a passing failure. `log` sends nothing and writes one redacted line.
  `EMAIL_TRANSPORT` picks one; the development server defaults to `log`, a built site to
  `resend`. Why Resend, its free-tier limits and what the site does near them are in
  [ADR 2](adr/0002-lead-email-transport.md).
- **The email** has the visitor's address as its reply-to, so the office answers with a plain
  reply. Its text depends only on the answers, never the time, so a resend is recognised as the
  same request. It is plain text, never HTML. The spam-check result is the second line, before
  anything the visitor wrote, so a message cannot imitate it; control characters and Unicode
  direction controls are removed from the visitor's text, and only the message keeps its line
  breaks.

### SMS

A text message to the office phone when an enquiry arrives, through Twilio
([`notify/sms.ts`](../src/lib/notify/sms.ts), [`notify/twilio.ts`](../src/lib/notify/twilio.ts)).
**It is off, and stays off until the owner approves the cost.**

- **The switch.** `SMS_ENABLED` must be exactly `true`. With anything else no other SMS variable is
  read, none is required, and no SMS code runs. With `true` but a missing or malformed value, SMS
  stays off and the log says which variables to fix (`[intake] SMS is off: ...`); the email is
  never held up by a broken text setup.
- **What the text says.** "New website enquiry: <project type>. The details are in the office
  email." No name, address, phone number or message, so the visitor's details never pass through
  the text provider and the privacy policy needs no change. Each number in
  `LEAD_NOTIFICATION_PHONE` gets its own text. There is no retry, so a slow answer never becomes
  a second charge or a duplicate text.
- **Turning it on** (owner's approval first, outside this repository):
  1. Create a Twilio account and upgrade it from the trial (a trial can text only verified
     numbers, and toll-free verification needs a paid account).
  2. Buy a number and register it: a local number needs US A2P 10DLC registration (a brand and a
     campaign); a toll-free number needs toll-free verification. Unregistered numbers cannot text
     US phones.
  3. Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (for example
     `+15615550100`) and `LEAD_NOTIFICATION_PHONE` (comma-separated, same form) as encrypted
     Worker settings, then set `SMS_ENABLED=true`.
  4. Send a test enquiry and check the log for `[intake] sms failed` lines.
- **Cost** (Twilio's US pricing page, November 2026): $0.0083 per message segment plus a carrier
  fee of $0.0035 to $0.005 per message, and $1.15 a month for a local number ($2.15 for
  toll-free). A local number also needs A2P 10DLC registration, which
  [Twilio's 10DLC page](https://www.twilio.com/en-us/a2p-10dlc) (read 2026-11-23; the page shows
  no date) prices as: low-volume standard, for a business with a tax ID sending under 6,000
  segments a day (the fit here), $4 one-time brand registration, $15 one-time campaign vetting
  and $1.50 to $10 a month per campaign; standard $44 one-time plus the same vetting and monthly
  fees; sole proprietor (no tax ID) $4 plus $15 vetting and $2 a month. So about $19 to start and
  a few dollars a month, plus the messages; at a handful of enquiries a day that is a few dollars
  a month in all.
- **How long it takes.** Twilio's documentation gives up to 72 hours to approve the business
  profile, seven business days or more for a brand that goes to manual review, and up to five
  business days for the campaign (Twilio's 10DLC page estimates under a week for campaign
  approval). Allow one to three weeks before the first text.

### Settings and logs

[`src/lib/intake-config.ts`](../src/lib/intake-config.ts) reads the settings listed by name in
[`.env.example`](../.env.example): from `.dev.vars` locally and the Worker's encrypted settings in
production, through `getSecret()` from `astro:env/server`. A built site gets no defaults, so a
missing secret logs `[intake] not configured:` with the variable names (never values) and the
visitor gets the form back instead of a silent loss. A launched build (`PUBLIC_SITE_LAUNCHED=true`)
also refuses the two settings meant only for development and tests, the same way: a Cloudflare
Turnstile test secret (the spam check would answer it without asking Cloudflare) and
`EMAIL_TRANSPORT=log` (every enquiry would go to the log). Preview builds and the browser tests are
not launched, so they keep using both.

Every log line starts with `[intake]` and holds no personal data: names shortened to an initial,
email addresses to `d***@***.test`, phone numbers to their last two digits, messages to their
length ([`src/lib/redact.ts`](../src/lib/redact.ts)). Failures name the provider's error code.

### Free-tier limits

| Service           | Free limit                                  | Near the limit                                       |
| ----------------- | ------------------------------------------- | ---------------------------------------------------- |
| Resend            | 100 emails a day, 3,000 a month             | Form comes back with a notice; log records `quota`   |
| Cloudflare Worker | 100,000 requests a day, 10 ms CPU a request | Only `/api/intake/` counts; static pages do not      |
| Turnstile         | Free                                        | If Cloudflare cannot be reached, the form comes back |

### Testing

Unit tests cover the handler with a fake transport, the Resend and log transports, the notifier,
the settings, the Turnstile check, and the follow-up questions: which apply to each type, what is
kept or dropped, and how the email lists them. In the browser tests,
`tests/e2e/contact.spec.ts` covers the page on the static build, including which follow-up
questions show for each type, the focus order through them and axe with each type chosen. Two
specs run against the built Worker in the same CI job:

- **The Workers under test** ([`tests/e2e/worker-under-test.ts`](../tests/e2e/worker-under-test.ts)).
  `playwright.config.ts` starts two copies of the built Worker with `astro preview`, both with the
  log transport: one with Cloudflare's always-pass Turnstile test secret (the `worker` project's
  base address) and one with the always-fail secret. Each copy's output is written to a log file
  in the system's temporary folder, which the tests read to see what the office would have been
  sent.
- **No network.** The Turnstile check answers Cloudflare's three test secrets itself, with the
  answers Cloudflare documents for them, so the Worker never calls Cloudflare in development or
  tests; a real secret is always checked with Cloudflare. In the browser, every host but the site
  is blocked and Turnstile's script is replaced by a stand-in that adds Cloudflare's dummy token,
  the way the real widget does. A test fails if the page tries to reach any other host.
- **`tests/e2e/intake-flow.spec.ts`** follows an enquiry end to end: with JavaScript on it passes
  the spam check, reaches the thank-you page and appears in the log as a redacted email (recipient,
  reply-to, length and idempotency key, which the test recomputes from the answers); with the
  always-fail secret it is refused and the form comes back with every answer and a fresh token;
  a custom home with every follow-up answered arrives with all of them (the recomputed key covers
  them, and the log names the questions answered);
  with JavaScript off it is sent flagged as unchecked, an answer only the server rejects comes back
  with everything kept and then goes through, and a filled spam trap shows a thank-you while
  nothing is sent. Every test also checks that no name, address, phone number or message appears
  in full in the log.
- **`tests/e2e/intake.spec.ts`** covers the endpoint's other answers: `GET`, wrong content type,
  cross-site posts and the accessibility of the form it sends back.

The office address comes from [`src/lib/site.ts`](../src/lib/site.ts); the phone number and
license number appear only once they are set there. The directions link opens Google Maps with
the address; there is no embedded map.

## Legal pages

`/privacy/` and `/terms/` are ordinary pages that share the reading layout in
[`src/layouts/LegalLayout.astro`](../src/layouts/LegalLayout.astro). Each page passes its own
"last updated" date and list of sections. The business name and address come from
[`src/lib/site.ts`](../src/lib/site.ts); a phone number that is `null` is left out.

The privacy text states facts about how the site behaves: the intake form is the only personal
data collected, it is emailed through Resend (which keeps sent messages for 30 days) and not
stored by the site, no cookies are set, analytics are cookieless (the paragraph about them follows
the analytics switch), and Cloudflare Turnstile checks the form. A change that makes any of these untrue,
such as storing leads, setting a cookie or adding a third-party script, updates the privacy page
and its date in the same pull request. The business reviews both texts before launch.

## Security headers

Every response carries the same security headers, with two harmless exceptions listed below. They are defined once in
[`src/lib/security-headers.ts`](../src/lib/security-headers.ts) and reach responses two ways:

- **Static files** (every prerendered page, image, font and script) get them from
  [`public/_headers`](../public/_headers), Cloudflare's headers file for static assets. A unit test
  keeps the file identical to the module. The build adds its own `Cache-Control` rule for
  `/_astro/*` to the same file, so `public/_headers` must never set `Cache-Control`.
- **Worker responses** (the intake endpoint's redirects, the form it sends back, its plain-text
  refusals) get them from [`src/middleware.ts`](../src/middleware.ts), because Cloudflare does not
  apply `_headers` to responses a Worker generates.
- **Two exceptions.** Astro answers two requests before the middleware runs, so these carry only
  `Content-Type` and `Vary` (and `Location`): the `403` refusing a cross-site form post
  (`security.checkOrigin`) and the `308` that adds a missing trailing slash (for example
  `/api/intake` to `/api/intake/`). Both bodies are a short line of plain text or empty, so there
  is nothing to frame or run, and the site links to `/api/intake/` with its slash, so only a
  hand-typed address meets the redirect. The one header they lack that matters at all is
  `Strict-Transport-Security`, which the visitor gets from the next page they load. Moving the
  origin check into our own middleware would close the gap; it was judged not worth the extra
  code (issue #114).

| Header                      | Value                                                              | Why                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | see below                                                          | Only the site's own code runs, so injected or tampered markup cannot run scripts or load from elsewhere                                                     |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                              | Browsers use HTTPS for a year after the first visit, so the form is never sent in the clear. Not `preload`: that is a long commitment the owner should make |
| `X-Content-Type-Options`    | `nosniff`                                                          | Browsers do not guess a file's type, so an uploaded or mistyped file is never run as a script                                                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                  | Other sites see only the domain a visitor came from, never the page. Turnstile still learns the origin it needs                                             |
| `Permissions-Policy`        | camera, microphone, location, payment, sensors, USB and topics off | The site uses none of them, so no page, script or frame can ask for them                                                                                    |
| `X-Frame-Options`           | `DENY`                                                             | Older browsers refuse to show the site inside another site's frame (clickjacking); newer ones use `frame-ancestors`                                         |

### Content security policy

The policy comes in two parts that a browser enforces together:

- **In each page.** Astro's `security.csp` (set in `astro.config.mjs` from `cspConfig()`) hashes
  every script and style it renders and writes the policy into a `<meta>` tag on prerendered
  pages, and into a header on the form the endpoint sends back. It allows the site itself and
  nothing else: `default-src`, `img-src`, `font-src`, `connect-src` and `script-src` are `'self'`
  plus hashes, `object-src` is `'none'`, and `base-uri` and `form-action` are `'self'`.
  - **No `'unsafe-inline'` for scripts or `<style>` elements.** The contact form's script and the
    small stylesheets Astro inlines are allowed by their hashes, which change with the code on
    every build, so nothing needs updating by hand.
  - **Style attributes are allowed** (`style-src-attr 'unsafe-inline'`). Components set CSS custom
    properties with them, such as a photograph's aspect ratio. A style attribute cannot run code;
    hashing each one would tie the policy to every photograph's dimensions. The build warns that
    `'self'` does not apply to attributes, which is intended.
  - **Turnstile** (`https://challenges.cloudflare.com` for `script-src`, `frame-src` and
    `connect-src`) is allowed only on `/contact/` and the form the endpoint sends back, by
    `allowTurnstile()` in those pages' frontmatter. It must be called there, not in a component:
    the policy is written into `<head>` before the page body renders.
  - **Analytics** (`https://static.cloudflareinsights.com` for scripts,
    `https://cloudflareinsights.com` for its reports) are allowed only when the beacon is on: the
    site is launched and `PUBLIC_CF_ANALYTICS_TOKEN` is set, the same rule the beacon uses.
    `astro.config.mjs` reads both from the build environment.
  - **Markdown syntax highlighting is off**, because Shiki writes inline styles. The content has
    no code blocks.
- **In the headers.** `frame-ancestors 'none'` cannot be set in a `<meta>` tag, so the headers
  carry a second policy with it, plus `object-src`, `base-uri` and `form-action` again.

Astro does not apply the policy on the development server, so check a change with a build:
`tests/e2e/security.spec.ts` loads every built page and fails on any policy violation, and checks
that a script the site did not ship is refused. `tests/e2e/intake.spec.ts` checks the headers on
a static page and on each kind of endpoint response from the built Worker.

## Link check

`npm run check:links` reads every built page in `dist/client` and fails when an internal link does
not resolve. It runs after `npm run build` in `verify`, in the CI build job (normal build) and in
the Lighthouse job (launched build). The logic is in [`scripts/link-check.mjs`](../scripts/link-check.mjs)
and is unit tested in `tests/unit/link-check.test.ts`; no browser and no network are used.

- **What is checked.** The `href` of `a`, `area` and `link`, the `src` and `srcset` of images,
  scripts and frames, and `og:image` and `twitter:image`. An address on the site's own host counts
  as internal. Each must be a built page or file; page addresses must end in `/`; each `#fragment`
  must be the `id` (or anchor name) of an element on the target page. `#` and `#top` always pass.
- **External links** (another host, `mailto:`, `tel:`) are listed at the end of the output with the
  pages that use them, and never fetched.
- **Two builds, because drafts disappear.** A normal build includes draft content and a launched
  build (`PUBLIC_SITE_LAUNCHED=true`) does not, so a page that links to a draft project, service
  or town passes the first and fails the second. That is the bug the launched run exists to catch.
  A page that must link to content that may be a draft checks for it first (see the town and
  project pages).
- **Skipped pages.** Links on `/style-guide/` pages are not checked: they are development-only and
  link to made-up neighbors on purpose. A link from a real page into the style guide is still an
  error.
- To run it locally: `npm run build && npm run check:links`, then
  `PUBLIC_SITE_LAUNCHED=true npm run build && npm run check:links`.

## Quality gates

| Gate                         | Tool                                        | Where        |
| ---------------------------- | ------------------------------------------- | ------------ |
| Formatting                   | Prettier                                    | `verify`, CI |
| Lint                         | ESLint                                      | `verify`, CI |
| Types and content validation | `astro check`                               | `verify`, CI |
| Unit tests                   | Vitest                                      | `verify`, CI |
| Browser and accessibility    | Playwright with axe, in Chromium and WebKit | CI           |
| Performance, SEO             | Lighthouse (minimum 95)                     | CI           |
| Secrets                      | gitleaks                                    | CI           |
| Repository hygiene           | `scripts/check-hygiene`                     | `verify`, CI |
| Internal links               | `scripts/check-links`                       | `verify`, CI |

Browser tests run in four profiles: Chromium and WebKit (Safari's engine), each on a 1440 x 900
desktop and on a phone (Pixel 7 and iPhone 15). Tests that differ by screen size read the
`isMobile` fixture, never the project name. The intake endpoint test runs in Chromium only,
because it checks server code. In WebKit, Tab moves only between form controls unless Option is
held, so a keyboard test focuses links with `focus()` instead of pressing Tab. Firefox is checked
by hand: it lacks cross-document view transitions and simply navigates.

### Lighthouse budget

The Lighthouse job builds the site as it will launch (`PUBLIC_SITE_LAUNCHED=true`, drafts hidden)
and audits one page of every type, with a minimum score of 95 in performance, accessibility, best
practices and SEO. A page that misses the budget is fixed, never excused.

- **Two lists.** [`lighthouserc.json`](../lighthouserc.json) holds the pages meant to be indexed:
  home, portfolio, a project, the services index, a service, process, interior design, contact,
  privacy and terms. [`lighthouserc.noindex.json`](../lighthouserc.noindex.json) holds the pages
  that are `noindex` on purpose (the 404 page and the form's thank-you page). Lighthouse scores
  `noindex` as an SEO failure, so that list skips only the `is-crawlable` audit; every other audit
  and every threshold is the same. Before the audit,
  [`scripts/check-audit-pages.mjs`](../scripts/check-audit-pages.mjs) checks the launched build:
  every listed page exists, the first list is indexable and the second carries `noindex`.
- **The project page.** Every real project is a draft for now, so the launched build has no
  project page. The Lighthouse build also sets `PUBLIC_AUDIT_FIXTURES=true`, which adds one
  made-up, non-draft project at `/portfolio/audit-example/` (`auditProject` in
  [`src/lib/examples.ts`](../src/lib/examples.ts): a cover, stats, features, a three-photograph
  gallery, a five-stage "How it was built" story and the design partner credit), so the audit
  measures every part a finished project can have. No deployment sets the variable, and no real project
  is published for the audit.
- **Three runs per page, judged on the median.** One run per page kept the job to a few minutes
  while the repository was private and minutes were limited, but a single sample on a shared
  runner is noisy: pages that score 97 to 100 missed the budget several times on runs where the
  runner itself was slow (its benchmark index halved, or a second of browser-internal work with
  the site's scripts unchanged). Each page now runs three times and each asserted score is the
  median of its three values (`aggregationMethod: "median"`). Not `"median-run"`: that picks one
  representative run by its load timings, and when the three runs load alike it can pick the
  slowest (0.93 asserted from runs of 0.93, 0.99 and 0.99). The budget is unchanged and every
  assertion is still an error. The job takes about eleven minutes; its time limit is 25. A page that misses on the
  median of three is a real regression.
- **Warm runner.** The first audit in a job ran on a cold runner and measured 7 to 15 times the
  style and layout work of the same page audited right after it (issue #72), so whichever page
  came first could miss the budget. Before the audits, the job opens headless Chrome once on
  `/services/renovations/`, which neither list contains. That is not a Lighthouse run and nothing
  carries over, because every audit starts a fresh Chrome profile.
- **Adding a page type.** Add one of its addresses to the matching list. A unit test
  (`tests/unit/launch-gates.test.ts`) fails while any page file under `src/pages` has no audited
  address, and `npm run launch-check` reads both lists. Pages from one template count once; see
  `PAGE_TYPE_GROUPS` in [`scripts/launch-gates.mjs`](../scripts/launch-gates.mjs).

The secret scan reads every commit on every branch. A finding that has been checked by hand and is
not a secret is listed by its fingerprint in [`.gitleaksignore`](../.gitleaksignore), with the
reason; that silences only that one finding. Keep test values low-entropy (`lead-test-1`,
`test-key`) so they are never mistaken for keys in the first place.
