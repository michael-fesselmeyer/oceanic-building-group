# 1. Astro on Cloudflare, content in Markdown, plain CSS

- Status: accepted
- Date: 2026-11-22

## Context

The site is a portfolio-led marketing site of roughly 30 to 40 pages for a builder whose work is
sold through photography. Its goals are search visibility, an equally good experience on desktop
and phone, and one intake form that notifies the office. It must cost close to nothing to run,
and its content will later be maintained by the business owner, not a developer.

## Decision

1. **Astro** as the framework. Pages are prerendered to static HTML and ship no JavaScript unless
   a component asks for it.
2. **Cloudflare Workers with static assets** as the host, through the official Astro adapter.
   Only routes that opt out of prerendering (the intake form endpoint) run as server code.
3. **Markdown content collections** with strict Zod schemas for projects, services, towns, team,
   testimonials and process steps.
4. **Images in the repository**, with responsive formats generated at build time.
5. **Plain CSS**: design tokens as custom properties, component-scoped styles, desktop-first
   media queries.

## Why

- **Astro over Next.js.** A React framework would send a runtime and hydrate every page of a
  site that is almost entirely static, which costs performance on phones for no benefit here.
  Astro's content collections also give build-time validation of content, which matters once a
  non-developer edits it.
- **Cloudflare over other hosts.** Static requests and bandwidth are free and unmetered, which
  suits a photo-heavy site, and commercial use is allowed on the free plan. DNS, bot protection
  and privacy-friendly analytics are available in the same account.
- **Markdown over a hosted CMS.** No extra service or login, full history in git, and a visual
  editor that writes the same files can be added later without restructuring.
- **Images in the repo over an image service.** No third-party dependency or monthly cap. The
  cost is a larger repository and slower builds as the library grows.
- **Plain CSS over a utility framework.** The design is bespoke and desktop-first; hand-written
  CSS gives the most control with nothing to configure against.

## Consequences

- App-like features (accounts, dashboards) would need more work here than in a full-stack
  framework. None are planned.
- The repository will grow by a few hundred megabytes of photographs. If builds become slow,
  moving masters to object storage is the next step and does not change the content model.
- Free-tier limits to watch: 100,000 Worker requests per day (only the form endpoint counts;
  static pages do not), plus the monthly build allowance, to be recorded here with its current
  figure when the project is connected to the host.
