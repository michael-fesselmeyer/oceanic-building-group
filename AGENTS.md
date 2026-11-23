# Working in this repository

Rules for everyone and everything that changes this repository. CI enforces the ones it can
(`npm run hygiene`, the CI workflow); the rest are enforced in review.

## What this is

The website for Oceanic Building Group, a residential and commercial builder. Astro 7 on
Cloudflare, content in Markdown, plain CSS. Read [docs/architecture.md](docs/architecture.md)
before making structural changes and [docs/roadmap.md](docs/roadmap.md) for what is planned.

## Commands

- `npm run dev -- --port <port>`: development server. Use your own port when several checkouts
  run at once.
- `npm run verify`: format check, lint, type and content check, unit tests, build, hygiene.
  Run it before every push.
- `npm run test:e2e` and Lighthouse run in CI. Locally, run a single browser test file only when
  the change needs it: `npx playwright test tests/e2e/<file>`.

Keep the machine responsive: never run two type checks, lints or builds at the same time, run
one test file at a time, and stop a development server when you are done with it.

## What must never reach GitHub

This applies to code, content, tests, fixtures, docs, commit messages, branch names, pull
requests, issues and comments.

- **Nothing private.** No personal email addresses, personal phone numbers, home addresses,
  schedules, or private correspondence. The only contact details allowed are the ones the site
  itself publishes, and they live in `src/lib/site.ts`.
- **No secrets.** No keys, tokens or passwords, and no notification recipients. Real values live
  in a git-ignored `.dev.vars` file and in the host's encrypted settings. `.env.example` lists
  names only. Never print a secret or put one in a URL.
- **Synthetic test data.** Tests and fixtures use made-up people and companies, `example.test`
  addresses and `555-01xx` phone numbers.
- **No attribution lines.** No co-author trailers, no "generated with" lines, and no names of
  authoring tools in files, commits, pull requests or issues.
- **Describe the product.** Write about the site and its visitors, not about who is building it
  or why.
- Commits use a GitHub no-reply address.
- The `private/` folder is git-ignored working notes. Never commit it, force-add it, or copy its
  contents into tracked files, issues or pull requests.

Check the diff and the text against this list before every commit, push, pull request or issue
edit. If something has already slipped into history, stop and report it; do not rewrite history
or force-push without the repository owner's say-so.

## Git and pull requests

- `main` is protected: work on a branch, open a pull request, keep it up to date with `main`,
  and merge by rebase only.
- One issue per pull request. Small, focused commits written as
  [Conventional Commits](https://www.conventionalcommits.org).
- Every pull request updates the README and docs that its change makes stale.
- Only one pull request that changes `src/content.config.ts` may be open at a time, because
  every content file and page depends on it.
- Creating or changing anything on the hosting account, DNS or any paid service needs the
  repository owner's approval first.

## Code rules

- **Content goes through `src/lib/content.ts`.** Pages never call `astro:content` directly, so
  the draft rule and sort order stay in one place.
- **Build settings in `src/lib` are read as `import.meta.env?.NAME`.** Browser tests import these
  modules outside Vite, where `import.meta.env` does not exist; a lint rule enforces this.
- **Business facts come from `src/lib/site.ts`.** A fact that is not known yet is `null` and is
  left out of the page; never render a placeholder for it.
- **Tokens only.** Colors, type sizes and spacing come from `src/styles/tokens.css`. No raw
  values in components.
- **Desktop-first CSS.** Base styles describe the wide layout; `max-width` media queries at
  1100px, 800px and 520px simplify it. Styles are scoped to their component.
- **No client-side JavaScript by default.** Reach for HTML and CSS first (popover, details,
  scroll-driven animation). A script needs a reason, stays small, and the page must work
  without it.
- **Images** are imported from `src/assets` and rendered with Astro's `<Image>` or `<Picture>`
  with explicit `widths` and `sizes`. Every image has real alt text. Masters are at most 2400px
  on the long edge; bring project photographs in with `npm run photos:import`, which also
  removes location and camera data.
- **Accessibility:** one `h1` per page, headings in order, visible focus, 4.5:1 text contrast,
  and motion that respects `prefers-reduced-motion`.
- **Performance budgets are bugs when missed.** Fix the page in the same pull request. Never
  raise a budget or turn an assertion into a warning.
- **Free services only** unless a paid one has been approved. Record each free-tier limit in
  the docs and degrade gracefully near it. CI jobs run only on standard `ubuntu-*` GitHub-hosted
  runners, which are free on this public repository; larger runners are billed even here, and
  `npm run hygiene` fails on any other `runs-on`.
