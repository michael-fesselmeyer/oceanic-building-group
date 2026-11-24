# 2. Lead notification email through Resend

- Status: accepted
- Date: 2026-11-23

## Context

The intake form notifies the office by email and stores nothing (the email is the record). The
endpoint runs as a Cloudflare Worker, so the transport must work from a Worker over `fetch` or a
binding, cost nothing, and need no server of our own. Expected volume is a handful of enquiries
a day; spam is filtered before sending by a honeypot field and Cloudflare Turnstile.

Nothing is set up yet: no domain, no hosting account and no email account. The office's own
mailbox provider is not decided, so the transport must not depend on where that inbox lives.

## Options

| Option                                              | Cost and free-tier limits                                                                                                                                                                    | Requirements                                                                                                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend** (HTTPS API)                              | Free plan: 3,000 emails a month, 100 a day (the daily count resets at midnight UTC), 3 domains. No pay-as-you-go on the free plan: past a cap the API answers `429` until the period resets. | An account and an API key (a secret). The sending domain must be verified with DNS records (SPF and DKIM) on a sending subdomain, which leaves the domain's own mail (MX) records alone. Works with any recipient inbox.                          |
| **Cloudflare `send_email` binding** (Email Routing) | Free on the Workers Free plan when sending only to verified destination addresses; those sends do not count toward a quota. Sending to arbitrary recipients needs the Workers Paid plan.     | No extra account or key. The domain must be on Cloudflare with Email Routing configured, and each recipient must be a verified destination address. The sender must be on the routing domain. New accounts start with an unpublished daily quota. |
| SMTP relay from a mailbox provider                  | Varies; usually tied to a paid mailbox.                                                                                                                                                      | Workers cannot open raw SMTP connections without extra work; ruled out.                                                                                                                                                                           |

Figures were read from each provider's pricing and limits pages on the date above. Check them
again when the accounts are created and update this record if they changed.

## Decision

Use **Resend** for the office notification, called with `fetch` from the endpoint (no SDK), behind
a small transport interface (`src/lib/notify/`). Locally and in CI the transport is a stub that
logs a redacted summary and sends nothing.

## Why

- **It does not touch the office's mail setup.** Email Routing has to be configured on the
  domain, which takes over its mail (MX) records. If the business keeps its inbox at the domain
  with another provider, the binding would conflict with it. Resend verifies a sending subdomain
  and leaves the domain's inbox alone.
- **Any recipient.** The office can change or add a recipient address without a verification
  step in the Cloudflare dashboard.
- **Clear failure signals.** Quota and rate errors are explicit (`daily_quota_exceeded`,
  `monthly_quota_exceeded`, `rate_limit_exceeded`), so the site can tell the visitor what to do.
- **Idempotency keys.** Each request carries a key derived from the submission, so a double
  click or a resent form within 24 hours sends one email, without the site storing anything.
- **Headroom.** 100 emails a day is well above the expected volume once spam is filtered.

The Cloudflare binding stays the fallback: if the domain's mail ends up on Cloudflare Email
Routing anyway, a second transport can implement the same interface and the endpoint does not
change.

## Near the limits

The site stores no leads, so it cannot count sends itself. It relies on the provider's answer:

- **Below the cap** nothing changes.
- **At the daily or monthly cap** (`429` with a quota error) the visitor sees the form again with
  everything they typed, a message that it could not be sent right now, and the office address
  (and phone number once it is published) as other ways to get in touch. The Worker log records a
  `quota` failure with no personal data, which is the signal to review volume or upgrade (an
  upgrade needs the owner's approval).
- **Rate limited or provider down** (`429` rate limit, `5xx`, timeout): one retry with the same
  idempotency key, then the same error page.
- **Spam pressure.** Turnstile and the honeypot stop most automated posts before they spend
  quota. The launched site refuses posts without a spam-check token (`TURNSTILE_REQUIRED`
  switches this off only when set to `false`), and a Cloudflare rate-limiting rule on
  `/api/intake/` slows a flood; both are documented in
  [architecture](../architecture.md#intake-form).

Other free-tier limits that apply to the endpoint: Workers Free allows 100,000 requests a day and
10 ms of CPU per request; the endpoint does little computing and mostly waits on two `fetch`
calls, which do not count as CPU time.

## Consequences

- Before launch: create the Resend account, verify the sending subdomain, and store
  `RESEND_API_KEY`, `LEAD_FROM_EMAIL` and `LEAD_NOTIFICATION_EMAIL` as encrypted Worker settings.
  This needs the owner's approval and happens outside this repository.
- One more account and secret to look after. A leaked key could send mail from the verified
  subdomain, so the key is created with sending access only.
- Leads sent while the provider is unreachable are not queued; the visitor keeps their text and
  can try again or call. Queuing would mean storing leads, which the business decided against.
