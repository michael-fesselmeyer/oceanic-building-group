# 3. Cookieless analytics with Cloudflare Web Analytics

- Status: accepted
- Date: 2026-11-23

## Context

The owner wants to know how many people visit, which pages they read and where they come from.
The site sets no cookies and shows no consent banner, and the privacy policy promises that any
statistics will be cookieless and will not follow visitors between sites. The tool must be free,
work on a static site served by a Cloudflare Worker, and cost the pages little enough that every
page type stays within the Lighthouse budget.

## Options

| Option                       | Cost and free-tier limits                                                                                                                                                                                                                  | Privacy                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Cloudflare Web Analytics** | Free on every plan. Up to 10 sites per account that are not proxied through Cloudflare (no limit for proxied ones). Detailed data kept 7 days, then aggregated to about 10%; dashboard shows 6 months. No custom events, no query strings. | No cookies or local storage, no fingerprinting, no personal data (Cloudflare's statement). |
| Umami Cloud (Hobby)          | Free: 100,000 events a month, 1 website, 6 months of data. Events over the cap are billed, not dropped, which is a cost risk on a free plan.                                                                                               | No cookies, no personal data.                                                              |
| GoatCounter                  | Free "for reasonable public usage" including small businesses, with no published cap; funded by donations.                                                                                                                                 | No cookies; IP and user agent kept in memory for 8 hours, never stored.                    |
| Plausible                    | No free hosted plan (30-day trial, then from about $9 a month).                                                                                                                                                                            | No cookies, no persistent identifiers.                                                     |

Figures were read from each provider's pricing and documentation pages on the date above.

## Decision

Use **Cloudflare Web Analytics** with the manual beacon (a deferred module script) added to every
page by `src/components/Analytics.astro`, only when the site is launched and
`PUBLIC_CF_ANALYTICS_TOKEN` is set.

## Why

- **Same account as the host.** No new vendor, account or billing relationship; the token comes
  from the Cloudflare dashboard the site already needs.
- **Free with no overage.** Nothing is billed at any volume, unlike Umami's per-event overage.
- **No banner needed.** No cookies, no local storage and no cross-site identifiers, which matches
  what the privacy policy already promised.
- **Small.** The beacon is about 10 KB compressed, loads as a module after the page is parsed,
  and sends one report per page view.

## Limits and what the site does near them

- **Ten non-proxied sites per account.** The site will be proxied once its domain is on
  Cloudflare, and even before that it is one site.
- **Sampling and retention.** Detailed data for 7 days, then aggregated; the dashboard covers six
  months. Enough for trends; export a monthly summary if longer history matters.
- **Ad blockers** block the beacon, so counts are a floor, not an exact figure.
- **No custom events.** Form submissions are not counted as conversions; the office inbox is the
  record of enquiries.
- If the token is missing or Cloudflare is unreachable, pages are unaffected: the script is not
  added, or fails quietly after the page has loaded.

## Setup (later, with the owner's approval)

1. In the Cloudflare dashboard, add the site under Web Analytics and copy its token.
2. If the domain is proxied through Cloudflare, choose the setup that does **not** inject the
   snippet automatically ("Enable with JS Snippet installation"), so pages do not carry two
   beacons.
3. Set `PUBLIC_CF_ANALYTICS_TOKEN` in the build settings. The token is public; it appears in every
   page.
4. When security headers are added, allow `https://static.cloudflareinsights.com` in `script-src`
   and `https://cloudflareinsights.com` in `connect-src`.

## Consequences

- The privacy page's analytics paragraph is rendered from the same switch as the beacon, so it is
  true whether analytics are on or off.
- The CI Lighthouse job builds the launched site with a made-up token, so the beacon's cost is
  inside the budget check. `lighthouserc.json` blocks only the beacon's report to Cloudflare
  (which would be refused for a made-up token); Lighthouse ignores errors from requests it
  blocks, and the script itself still downloads and runs.
