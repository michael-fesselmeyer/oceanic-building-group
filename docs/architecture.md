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

Content lives in `src/content/<collection>/`, one Markdown file per item. Schemas are in
[`src/content.config.ts`](../src/content.config.ts) and are strict: an unknown or misspelled
field fails the build.

| Collection     | Holds                                     | Used by                               |
| -------------- | ----------------------------------------- | ------------------------------------- |
| `projects`     | Photographs, stats, story, category, town | Portfolio, project pages, home, towns |
| `services`     | One page per service line                 | Services pages, home                  |
| `towns`        | One page per service-area town            | Town pages, project filters           |
| `team`         | Name, role, photo, biography              | About                                 |
| `testimonials` | Quote and attribution                     | Home, project pages                   |
| `processSteps` | The stages of a build, in order           | Our Process, home                     |

Rules that apply to all of them:

- Pages read content through [`src/lib/content.ts`](../src/lib/content.ts), which applies the
  draft rule and the sort order.
- `draft: true` items show in development and preview builds and are removed from the launched
  site.
- A section with no published items renders nothing. Testimonials, for example, appear only once
  the first quote is added.
- Files whose names start with `_` are templates and are never loaded.

Business facts that appear in many places (name, address, phone, license number, navigation) live
in [`src/lib/site.ts`](../src/lib/site.ts).

## Launch switch

`PUBLIC_SITE_LAUNCHED` is read at build time. Until it is `true`, every page carries a `noindex`
tag and drafts stay visible, so preview deployments can be shared without being indexed. The
Lighthouse job in CI builds with it set to `true` so the audit measures the launched site.

## Styling

- [`src/styles/tokens.css`](../src/styles/tokens.css) defines every color, type size, space and
  timing as a custom property. Brand colors were sampled from the logo.
- [`src/styles/base.css`](../src/styles/base.css) holds the reset, element defaults and three
  shared helpers (`.container`, `.label`, `.visually-hidden`).
- Component styles are scoped inside each `.astro` file.
- The design is desktop-first. Base styles describe the wide layout and `max-width` queries at
  1100px, 800px and 520px simplify it.
- Typefaces: Newsreader for headings, Hanken Grotesk for text. Both are self-hosted through
  Astro's fonts API, so no request leaves the site.

## Images

Masters go in `src/assets/` at no more than 2400px on the long edge and are referenced from
content files by relative path. Astro generates responsive sizes in modern formats at build time
and writes width and height attributes, which prevents layout shift. Components must pass
`widths` and `sizes` so phones download a small file.

## Intake form

Planned design (see the roadmap for status):

1. The form posts to a server endpoint. It works without JavaScript; a small script may enhance
   it with inline validation.
2. The endpoint validates the fields with a schema shared with the client, verifies the Turnstile
   token, and drops submissions that fill the hidden honeypot field.
3. A notifier sends the lead through each enabled channel. Email is always on; SMS sits behind
   `SMS_ENABLED` and stays off until the messaging account is approved.
4. Leads are not stored. The email to the office is the record.

Recipients and keys are secrets, listed by name in [`.env.example`](../.env.example).

## Quality gates

| Gate                         | Tool                    | Where        |
| ---------------------------- | ----------------------- | ------------ |
| Formatting                   | Prettier                | `verify`, CI |
| Lint                         | ESLint                  | `verify`, CI |
| Types and content validation | `astro check`           | `verify`, CI |
| Unit tests                   | Vitest                  | `verify`, CI |
| Browser and accessibility    | Playwright with axe     | CI           |
| Performance, SEO             | Lighthouse (minimum 95) | CI           |
| Secrets                      | gitleaks                | CI           |
| Repository hygiene           | `scripts/check-hygiene` | `verify`, CI |
