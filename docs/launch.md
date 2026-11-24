# Launch runbook

How to put the site live on Cloudflare, step by step. It is written for a careful person who has
the business facts ready and has not done this before. Read it once end to end before starting.

Nothing in this document has been run against a real account. The commands that need no account
were run locally on 2026-11-23 and are marked **Checked locally**. Every step that happens in a
dashboard or needs a login is marked **Not run**: it follows the providers' documentation,
listed at the end.

Throughout, `example.test` stands for the real domain. Replace it everywhere. Never paste a key,
token or password into this repository, a pull request, an issue or a chat; paste it only into
the dashboard field or the prompt that asks for it.

## Order of work

Some steps depend on others, so the order is not the same as the section order.

1. Section 1: the launch gates.
2. Section 6.1 to 6.3: register the domain, add it to Cloudflare, wait for it to become active.
3. Section 2: create the Worker (this is the first deploy, still hidden from search engines).
4. Section 4: Turnstile. Section 5: Resend (needs the domain from step 2).
5. Section 3: set the settings and secrets, then rebuild.
6. Section 7.1: a rehearsal on the temporary address before the domain is switched on.
7. Section 6.4 to 6.7, then section 7.2 to 7.4: custom domain, `www`, the form's rate limit,
   going live, checks. Section 7.5 once the site is live.

**Owner approval.** Creating or changing anything on the hosting account, DNS or any paid service
needs the repository owner's approval first (see `AGENTS.md`). Everything below that creates an
account, a resource or a DNS record is such a step. The business, not a developer, owns the
accounts: create each one under a business role address the business controls, and turn on
two-step sign-in.

## 1. What must be true first

Run this from a clean checkout of `main`:

```bash
npm run launch-check
```

It prints one `PASS` or `FAIL` line per gate and exits with code 1 if any fail. Each failure
says what to do. Launch only when all six pass. The gates are explained in the
[README](../README.md#launch-check); here is where each fact comes from.

| Gate                          | What to do                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contractor license number     | Put the issued number in `licenseNumber` in `src/lib/site.ts`.                                                                                                                      |
| Office phone number           | Put the public office number, ten digits, in `phone` in `src/lib/site.ts`. This is the number the site publishes. It is not the number for text alerts, which stays off.            |
| Domain                        | Set `site` in `astro.config.mjs` and add the domain to `routes` in `wrangler.jsonc` (section 6.4). It passes only when both name the same host.                                     |
| Team brokerage details        | For each team member who is a real-estate licensee, set `realEstateLicensee: true` and `brokerage` in their file in `src/content/team/`.                                            |
| No draft or sample content    | Published content must use real photographs, real alt text and no placeholder wording. Drafts are allowed: the launched build hides them. See [content-guide.md](content-guide.md). |
| Lighthouse on every page type | Needs the latest `main` run of CI to have passed its Lighthouse job. The script reads it with the GitHub CLI (`gh`), so `gh` must be installed and signed in.                       |

The first three are one pull request ("launch facts"). Make it a normal pull request: branch,
`npm run verify`, review, merge by rebase. Do not set `PUBLIC_SITE_LAUNCHED` in the repository;
it is a build setting in Cloudflare (section 3).

Also have ready, because later steps ask for them: the business's legal name and role
addresses for each account, the inbox that should receive enquiries, and someone with access to
the domain registrar.

## 2. The Cloudflare account and the Worker

### 2.1 Create the account

**Not run. Owner approval needed.**

1. Sign up at the Cloudflare dashboard with a business role address. Choose the **Free** plan
   whenever asked. Nothing in this runbook needs a paid plan.
2. Turn on two-step sign-in (Profile, then Authentication).
3. Note the account's `workers.dev` subdomain when the dashboard asks you to pick one. The
   rehearsal address in section 7.1 is `oceanic-building-group.<that subdomain>.workers.dev`.

### 2.2 Git integration or deploy from CI: use the Git integration

There are two supported ways to deploy this site:

- **Git integration (Workers Builds).** Cloudflare watches the GitHub repository, runs the build
  on its own servers and deploys. Settings and secrets live in one place.
- **`wrangler deploy` from GitHub Actions.** The CI workflow builds and deploys with an API token
  stored as a GitHub secret.

**Use the Git integration.** Reasons:

- No Cloudflare API token has to be stored in GitHub. The repository is public and anyone who
  can change a workflow could try to read such a token.
- Build settings, build variables and runtime secrets are all in the same dashboard, so a launch
  switch (`PUBLIC_SITE_LAUNCHED`) is changed in one place and rebuilt with one button.
- It is free: the Free plan includes 3,000 build minutes a month, one build at a time, and a
  20-minute limit per build. A build of this site takes a few minutes.
- `main` is protected and needs four passing checks before anything merges, so only commits that
  passed CI are ever built. The deploy is not itself gated by CI, and does not need to be.

The cost: a failed Cloudflare build shows in the Cloudflare dashboard, not in the GitHub checks.
Look there if a merge does not appear on the site.

### 2.3 Create the Worker

**Not run. Owner approval needed.** Dashboard names change from time to time; follow the
documentation links at the end if a label differs.

1. Workers & Pages, then Create application, then import a Git repository. Install Cloudflare's
   GitHub app on this one repository only, not on every repository.
2. Choose `michael-fesselmeyer/oceanic-building-group`. The project name must be exactly
   `oceanic-building-group`, the `name` in `wrangler.jsonc`; a different name makes the build
   fail.
3. Set the build settings (Settings, then Build):

| Setting           | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Production branch | `main`                                                                   |
| Root directory    | the repository root (leave empty)                                        |
| Build command     | `npm ci && npm run build`                                                |
| Deploy command    | `npx wrangler deploy` (the default)                                      |
| Node version      | nothing to set: the repository's `.nvmrc` says 24, which the build reads |

4. Turn off builds for branches other than `main` (Settings, Build, branch controls). Every
   pull request is already built and tested in GitHub, and preview builds would use build minutes
   and create more public addresses.
5. Add the build variables from section 3, then save. Changes apply from the next build.

What the build produces, and why nothing else is needed:

- `npm run build` writes the static site to `dist/client` and the Worker (the intake form's
  server code) to `dist/server`. It also writes `.wrangler/deploy/config.json`, which points
  `wrangler deploy` at `dist/server/wrangler.json`. That generated file holds the entry point,
  the static-assets directory, and the compatibility date.
- **Compatibility date.** The adapter writes it (`2026-11-17` in the build checked below). Do not
  add one to `wrangler.jsonc`.
- **Output.** There is no output directory to type in: the deploy command finds `dist/` by itself.
- **Node.** The `engines` field in `package.json` requires Node 24.11 or newer in the 24 line.
  Cloudflare's current build image defaults to Node 24, and `.nvmrc` or a `NODE_VERSION` build
  variable overrides it. If the build log shows a different major version, set `NODE_VERSION` to
  `24` as a build variable.

**Checked locally** (2026-11-23, Wrangler 4.166.0, no login, nothing uploaded):

```bash
npm ci
npm run build
npx wrangler deploy --dry-run
```

The dry run compiles the Worker, reads the 217 files of static assets, prints the bindings and
exits with "--dry-run: exiting now." It did not ask for a login and created nothing. Use it
whenever `wrangler.jsonc` changes. It lists three bindings: `ASSETS` (the static files), and two
that the Astro adapter adds on its own, `SESSION` (a key-value store for user sessions) and
`IMAGES` (on-demand image processing).

- The site uses neither session storage nor on-demand image processing: pages and images are
  built ahead of time. But the first real deploy will **create a key-value namespace** in the
  account for `SESSION` (Wrangler provisions bindings with no ID on deploy). It is free, empty
  and harmless. Do not delete it while the Worker uses it.
- Check the Images usage page in the dashboard a month after launch. Nothing should be using it.

### 2.4 First deploy

The connection starts a first build. It deploys with `PUBLIC_SITE_LAUNCHED` unset, so every
page carries a `noindex` tag, drafts are visible, and there is no sitemap. It is served at
`https://oceanic-building-group.<account subdomain>.workers.dev/`. Search engines are told not to
index it, but it is public: do not share the address widely.

The intake form will not work yet. A built site has no default settings, so the form answers
with a notice and the office details until section 3 is done. That is expected.

## 3. Settings and secrets

[`.env.example`](../.env.example) lists every name. There are two kinds, and they are set in two
different places. A build variable is read once while the site is built and is **not** available
to the running Worker. A runtime secret is read by the running Worker and is **not** available
to the build. Setting a value in the wrong place is the commonest mistake: the form then says it
is not configured, or the widget is missing.

### 3.1 Build variables (public)

Set in: Workers & Pages, the Worker, Settings, Build, Variables and secrets. These end up in the
page source, so they are public by design.

| Name                        | What it does                                                                                                                                | Where the value comes from              | When                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------- |
| `PUBLIC_TURNSTILE_SITE_KEY` | The spam check widget's public key. A launched build without it renders no widget.                                                          | Turnstile widget's site key (section 4) | Before the rehearsal |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Turns on the cookieless visitor counter, but only in a launched build. Wrong shape stops the build.                                         | Web Analytics site (section 7.2)        | At launch            |
| `PUBLIC_SITE_LAUNCHED`      | `true` removes `noindex`, hides drafts, writes the sitemap, names it in `robots.txt` and allows the analytics beacon. Anything else is off. | Nothing to look up: you type `true`     | At launch only       |
| `PUBLIC_AUDIT_FIXTURES`     | CI's Lighthouse job only. It adds a made-up project page.                                                                                   | **Never set it for a deployment.**      | Never                |

### 3.2 Runtime secrets

These are read by the intake endpoint. Set them as type **Secret**, even the ones that are not
secret by nature (`LEAD_FROM_EMAIL`, `TURNSTILE_REQUIRED`). Reason: `wrangler deploy` replaces
the Worker's plain-text variables with the ones in `wrangler.jsonc`, which has none, so a plain
variable set in the dashboard would be deleted by the next deploy. Cloudflare never deletes
secrets on deploy.

Set them in the dashboard: Workers & Pages, the Worker, Settings, Variables and secrets, Add,
type Secret, then Deploy. The command-line equivalent is
`npx wrangler secret put NAME`, which asks for the value at a prompt (never put a value on the
command line). It needs the Worker to exist and you to be signed in with `npx wrangler login`.
Each change creates and deploys a new version at once.

| Name                      | What it does                                                                                                                                                                                                | Where the value comes from                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`          | Lets the Worker send the enquiry email.                                                                                                                                                                     | Resend, an API key created for this site only (section 5).                                             |
| `LEAD_FROM_EMAIL`         | The sender shown on the email, on the verified sending domain: `Website <website@send.example.test>`.                                                                                                       | You choose it; the domain part must be the one verified in Resend.                                     |
| `LEAD_NOTIFICATION_EMAIL` | The inbox that receives enquiries. Several addresses may be separated by commas.                                                                                                                            | The business. **Set only here. Never write it in the repository, an issue or a pull request.**         |
| `TURNSTILE_SECRET_KEY`    | Lets the Worker check the spam-check token with Cloudflare.                                                                                                                                                 | Turnstile widget's secret key (section 4).                                                             |
| `TURNSTILE_REQUIRED`      | Optional. The launched site refuses posts that have no spam-check token (visitors without JavaScript, and spam programs that post directly). `false` accepts them, relying on the honeypot. Leave it unset. | Set `false` only with the owner's approval; see the [architecture notes](architecture.md#intake-form). |
| `EMAIL_TRANSPORT`         | Optional. `resend` or `log`. A built site defaults to `resend`.                                                                                                                                             | Leave it unset. Setting `log` would send nothing.                                                      |

**Text messages stay off.** `SMS_ENABLED`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER` and `LEAD_NOTIFICATION_PHONE` are not set at launch. Texting costs money and
needs the owner's approval; see [SMS](architecture.md#sms). The owner's phone number, like the
lead inbox, is a secret and is only ever set in Cloudflare.

After the first secrets are saved, the Worker redeploys. A missing or malformed value is
reported in the Worker's log as `[intake] not configured:` followed by the variable **names**,
never values, and the visitor gets the form back with the office details.

### 3.3 Local files

For work on a developer's computer, real values go in `.dev.vars` (runtime) or `.env`
(build). Both are ignored by git. Do not put production values there unless you must; the
development server has safe defaults and needs none.

## 4. Turnstile (the spam check)

**Not run. Owner approval needed.** Free: up to 20 widgets, unlimited challenges, 10 hostnames
per widget.

1. Dashboard, Turnstile, Add widget.
2. Name: `oceanic-building-group`. Widget mode: **Managed** (Cloudflare decides whether a
   visitor needs to click). Region: Rest of World.
3. Hostnames: enter the domain without `https://`, a path or a star: `example.test`. A root
   domain also covers `www.example.test` and every other subdomain. For the rehearsal in
   section 7.1, also add the exact `workers.dev` hostname of the Worker, and remove it
   before launch.
4. Create. Cloudflare shows two keys:
   - The **site key** is public. Set it as the build variable `PUBLIC_TURNSTILE_SITE_KEY`
     (section 3.1).
   - The **secret key** is private. Set it as the runtime secret `TURNSTILE_SECRET_KEY`
     (section 3.2). It is shown with the widget and can be rolled (replaced) later.
5. Rebuild so the site key is read: the Worker, Deployments or Builds, then Retry build on the
   latest build.

Do not use Cloudflare's published test keys in production. The test site key always passes, and
the site refuses to render it in a launched build for this reason: a test site key with a real
secret fails every visitor. The security headers already allow Turnstile's address on the contact
page only.

## 5. Resend (the enquiry email)

**Not run. Owner approval needed.** The choice of Resend and its limits are recorded in
[ADR 2](adr/0002-lead-email-transport.md). This section needs the domain to be active in
Cloudflare (section 6.3).

1. Create an account at resend.com under the business role address. The Free plan is enough:
   100 emails a day, 3,000 a month.
2. Domains, Add Domain. Enter a **sending subdomain**, for example `send.example.test`, not the
   root domain. Resend verifies only that subdomain and leaves the domain's own mail (for
   example the office's inbox) alone. Pick a region near the office.
3. Resend shows DNS records. In Cloudflare, DNS, Records, add each one exactly as shown, with
   proxy status **DNS only** (grey cloud). Enter names without the domain (`send`, not
   `send.example.test`). There are three:

   | Type | Name (as typed in Cloudflare) | Value                                                           | Purpose                                   |
   | ---- | ----------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
   | MX   | the sending subdomain         | the mail server Resend shows; priority 10                       | Bounce handling for the sending subdomain |
   | TXT  | the sending subdomain         | `v=spf1 include:amazonses.com ~all` (copy Resend's exact value) | SPF: lists who may send for the subdomain |
   | TXT  | `resend._domainkey`           | the long key Resend shows (starts with `p=`)                    | DKIM: signs each email                    |

   The exact names and values are on Resend's Records tab and can differ from the pattern above
   (for example if the subdomain is not `send`). Copy theirs, not these.

4. **Suggested DMARC record** (not required by Resend, but receivers trust the domain more with
   it). Add a TXT record named `_dmarc` with the value `v=DMARC1; p=none;` and, if the business
   wants reports, `rua=mailto:<a role address>`. Start at `p=none` (watch only). Tighten to
   `quarantine`, then `reject`, only after weeks of clean reports. If the domain already has a
   `_dmarc` record for the office's own mail, do not add a second one: edit the existing one.
5. In Resend, press Verify. It usually completes within about 15 minutes; DNS can take up to
   72 hours, after which use "Restart verification".
6. API Keys, Create. Name it for this site, permission **Sending access**, restricted to the
   verified domain. Do not use a full-access key. Copy it once into `RESEND_API_KEY`
   (section 3.2); Resend will not show it again. Keys unused for 30 days may be removed.
7. The from address is any mailbox on the verified subdomain, such as
   `Website <website@send.example.test>`. It need not exist as a real mailbox; replies go to the
   visitor's address, which the site sets as the reply-to.
8. **Test send.** There is nothing to run on its own: the site's own form is the test. Do it in
   section 7.1, and check the message under Emails in the Resend dashboard (it shows
   delivered, bounced or complained).

## 6. Domain and DNS

### 6.1 Register the domain

**The user buys it.** Not something to automate or to do on someone's behalf. Use a registrar
the business can log in to, in the business's name and role address, with auto-renew on and the
transfer lock on. Cloudflare's own registrar is an option and keeps everything in one account;
check the price at checkout. Do this early: it is the slowest step.

### 6.2 Add the domain to Cloudflare

**Not run. Owner approval needed.**

1. Dashboard, add a domain, enter it, choose the **Free** plan.
2. Cloudflare scans the existing DNS records. **Check that every record the business already
   uses is there**, above all the mail (MX) and verification (TXT) records of the office's
   inbox, before changing anything. A missing MX record stops email.
3. If the registrar has DNSSEC turned on, turn it off there first and turn it on again in
   Cloudflare afterwards.
4. At the registrar, replace the nameservers with the two Cloudflare shows. If the domain was
   bought through Cloudflare, this is automatic.

### 6.3 Wait for it to be active

Cloudflare emails when the domain is active; it usually takes minutes, and can take a day.
Check under Overview. Do not continue until it is active.

### 6.4 Put the domain in the repository

One pull request, before the custom domain is attached. Both changes name the same host, which
is what the launch gate compares.

In `astro.config.mjs`, change `site` to the real address, without a trailing path:

```js
site: 'https://example.test',
```

This one value builds every canonical address, the sitemap and the share tags. In
`wrangler.jsonc`, add the domain as a custom domain of the Worker:

```jsonc
{
  "name": "oceanic-building-group",
  "routes": [{ "pattern": "example.test", "custom_domain": true }],
  "workers_dev": false,
  "preview_urls": false,
}
```

- `custom_domain: true` makes Cloudflare create the DNS record and certificate for the
  hostname itself when the Worker is deployed. A hostname that already has a CNAME record
  cannot be made a custom domain; delete the old record first.
- `workers_dev: false` and `preview_urls: false` close the temporary `workers.dev` addresses,
  so the site has one public address. (Once `routes` is set, `workers_dev` defaults to off, so
  this only makes it explicit.) Skip these two lines until the rehearsal in section 7.1 is
  done if you still need that address; the order below does this.
- **Checked locally** (a throwaway edit using `launch-test.example.test`, reverted): the
  build copied `routes`, `workers_dev` and `preview_urls` into `dist/server/wrangler.json`;
  `npx wrangler deploy --dry-run` accepted them with no warning and no login; and
  `npm run launch-check` then passed its Domain gate.

Merge it as usual. Cloudflare builds and deploys; the deploy creates the DNS record and
certificate for the domain. Check under the Worker's Settings, Domains & Routes that the domain
is listed.

### 6.5 HTTPS

Universal SSL certificates are issued automatically for the domain once it is active, and for a
Worker custom domain at the time of the deploy; this can take a few minutes. Then, under SSL/TLS,
Edge Certificates, turn on **Always Use HTTPS** so `http://` addresses redirect. The site also
sends `Strict-Transport-Security: max-age=31536000; includeSubDomains`, so once a browser has seen
the site, it uses HTTPS for the domain **and every subdomain** for a year. Do not host a
subdomain that is not served over HTTPS. (The Resend sending subdomain carries mail only and is
not affected.)

### 6.6 `www` to the bare domain

The site's canonical address is the bare domain (`example.test`), so `www` should send visitors
there. The visitor's page and query are kept.

1. DNS, Records, add a record that exists only so the redirect can run: type `AAAA`, name `www`,
   value `100::`, proxy status **Proxied** (orange cloud). It points nowhere; the redirect fires
   before anything is requested from it.
2. Rules, Redirect Rules, Create rule, Single redirect (the Free plan has 10).
3. Rule name: `www to bare domain`. When incoming requests match: custom filter expression,
   Hostname equals `www.example.test`.
4. Then: type **Dynamic**, expression
   `concat("https://example.test", http.request.uri.path)`, status code **301**, and turn on
   **Preserve query string**.
5. Deploy. This rule does not need a change in the repository.

### 6.7 Close the temporary address

Section 6.4 already switches `workers.dev` and preview addresses off in the repository. Confirm
in Settings, Domains & Routes that neither is listed after the deploy.

## 7. Going live

### 7.1 Rehearsal, before the domain is attached

Do this after sections 2 to 5 and before the pull request in section 6.4. The site is hidden
from search engines on the `workers.dev` address.

1. Open `https://oceanic-building-group.<account subdomain>.workers.dev/contact/`.
2. The spam check widget must appear. If it does not, `PUBLIC_TURNSTILE_SITE_KEY` was not set at
   build time, or the `workers.dev` hostname is not in the widget's hostnames.
3. Send one enquiry. Write `TEST - please ignore` as the message, use an address the business
   controls, and choose any project type.
4. Expect: the thank-you page; within a minute an email in the office inbox with the visitor's
   address as the reply-to and the answers listed; and a "delivered" status in Resend's Emails
   list. Reply to it to confirm the reply goes to the test address.
5. To see the Worker's log while you do it: `npx wrangler tail oceanic-building-group`. This
   needs `npx wrangler login`, which is an account step and **was not run**. Lines start with
   `[intake]` and hold no personal data. The dashboard's live logs show the same.
6. If it fails, the log names what is wrong: `not configured` lists the missing variable names;
   a `quota` failure means Resend's limit; a Turnstile failure means the keys do not match.
7. Remove the `workers.dev` hostname from the Turnstile widget before launch.

### 7.2 The analytics token

**Not run. Owner approval needed.** Cloudflare Web Analytics is free and sets no cookies
([ADR 3](adr/0003-cookieless-analytics.md)).

1. Dashboard, Analytics & Logs, Web Analytics, Add a site, and choose the domain.
2. The domain is proxied through Cloudflare, so the dashboard offers automatic setup by default.
   Choose **Enable with JS Snippet installation** instead. The site already adds the beacon
   itself; automatic setup would add a second one.
3. Copy the `token` value from the snippet Cloudflare shows (the text after `"token":` in the
   `data-cf-beacon` attribute). Do not paste the whole snippet.
4. Set it as the build variable `PUBLIC_CF_ANALYTICS_TOKEN` (section 3.1). It is public.

### 7.3 Limit how fast one visitor can send the form

**Not run. Owner approval needed.** Free: the Free plan includes one rate-limiting rule. It stops
a flood of posts from one address using up the day's email allowance (100 a day on Resend's free
plan), which would turn away genuine enquiries until midnight UTC. It does not stop a slow,
steady sender; the spam check does that.

1. Dashboard, the domain, Security, WAF, Rate limiting rules, Create rule.
2. Name: `Enquiry form`.
3. If incoming requests match: URI Path equals `/api/intake/` **and** Request Method equals
   `POST`.
4. With the same characteristics: IP.
5. When rate exceeds: 5 requests per 10 seconds.
6. Then take action: Block, for 10 seconds (the Free plan's period and block length).
7. Deploy. To test it, send the form a few times in quick succession from one browser: the sixth
   post within ten seconds gets Cloudflare's block page, and a post a few seconds later works.

### 7.4 Switch on, rebuild, check

1. Confirm `npm run launch-check` passes all six gates (section 1) on `main`.
2. Confirm sections 4 and 5 are done and the rehearsal worked.
3. In the Worker's build variables set `PUBLIC_SITE_LAUNCHED` to `true`. Make sure
   `PUBLIC_TURNSTILE_SITE_KEY` and `PUBLIC_CF_ANALYTICS_TOKEN` are set too.
4. Rebuild: Builds, the latest build, Retry build. A retry uses the settings as they are when it
   starts. Wait for the build to finish and the deployment to show as active.
5. Run the checks below. Replace `example.test`.

| Check              | How                                                                                                                                   | What you should see                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch check       | `npm run launch-check` (after the launch pull request is merged)                                                                      | All six gates pass.                                                                                                                                                                                       |
| Indexable          | `curl -s https://example.test/ \| grep -ci noindex`                                                                                   | `0`. A count of 1 or more means the build was not launched.                                                                                                                                               |
| Redirects          | `curl -sI http://example.test/` and `curl -sI https://www.example.test/contact/`                                                      | A `301` to `https://example.test/` and to `https://example.test/contact/`.                                                                                                                                |
| Headers            | `curl -sI https://example.test/` and look at the response                                                                             | `strict-transport-security`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`, `x-frame-options: DENY`, and a `content-security-policy` that includes `frame-ancestors 'none'`. |
| CSP in the browser | Open the home page, then the contact page, with developer tools open (Console and Elements)                                           | No red "Refused to..." messages on either page. In `<head>`, a `<meta http-equiv="content-security-policy">` tag. On the contact page, the spam check widget appears and the form still works.            |
| Robots and sitemap | `curl -s https://example.test/robots.txt` and `curl -sI https://example.test/sitemap-index.xml`                                       | `robots.txt` allows everything and ends with `Sitemap: https://example.test/sitemap-index.xml`; the sitemap answers `200`.                                                                                |
| Enquiry            | Send a real enquiry from the live contact page, as in section 7.1                                                                     | Thank-you page, email in the office inbox, Resend shows delivered.                                                                                                                                        |
| Analytics          | Load a page with developer tools, Network tab                                                                                         | A request for `beacon.min.js` from `static.cloudflareinsights.com`. The dashboard shows the visit after a few minutes. Ad blockers hide it.                                                               |
| Lighthouse         | Run each page type through [PageSpeed Insights](https://pagespeed.web.dev/), or locally `npx lighthouse https://example.test/ --view` | 95 or more in all four categories, as CI requires. Miss it: it is a bug to fix in a pull request, not a budget to raise.                                                                                  |

### 7.5 Tell the search engines

Both are free and need an account with the business's login.

1. **Google Search Console.** Add property, choose **Domain**, enter `example.test`. It shows a
   TXT record: add it in Cloudflare DNS at the root (name `@`, DNS only) and press Verify. Keep the
   record afterwards. Then Sitemaps, enter `sitemap-index.xml`, Submit. Then URL Inspection of
   the home page, Request indexing.
2. **Bing Webmaster Tools.** Sign in and choose **Import** from Google Search Console; it brings
   the verified site and its sitemap across. Otherwise add the site, verify it, and submit
   `https://example.test/sitemap-index.xml` under Sitemaps.
3. Indexing takes days to weeks. The sitemap, not repeated requests, is what to rely on.

## 8. Rollback

### 8.1 Return to the previous deployment

Use this when a deploy broke something. It takes a minute and changes nothing outside the
Worker's code and assets.

- **Dashboard.** Workers & Pages, the Worker, Deployments, the three dots on the version you
  want, Rollback.
- **Command line.** `npx wrangler deployments list`, then `npx wrangler rollback <version id>`.
  Both need `npx wrangler login`. Not run.

Things to know:

- A rollback creates a new deployment of the old version at 100% of traffic. Only the 100 most
  recent versions, and versions from the last 30 days, can be rolled back to.
- A rollback does not change secrets or other settings: the Worker's secrets (section 3.2) are
  shared by every version. Build variables are baked into each version at build time, so rolling
  back to a build from before launch brings the `noindex` site back.
- **The next push to `main` deploys again over the rollback.** Either merge nothing until the
  fault is fixed, or revert the faulty change in a pull request and let that deploy.

### 8.2 Take the site back to noindex

1. Worker, Settings, Build, Variables and secrets: delete `PUBLIC_SITE_LAUNCHED` or set it to
   anything other than `true`. Retry the latest build.
2. The new build has a `noindex` tag on every page, no sitemap, no analytics beacon, and **draft
   content is visible again**. It is a holding page for engineers, not a polished one.
3. Search engines drop pages after they next crawl and see `noindex`; this takes days. The site
   must stay crawlable (`robots.txt` still allows it) for them to see the tag. For an urgent
   removal use the Removals tool in Search Console.
4. To make the site unreachable instead: Settings, Domains & Routes, remove the custom domain.
   Add it back to restore it.

### 8.3 If a secret leaks

Treat any key that appeared in a chat, log, issue or screenshot as leaked. Resend: create a new
key, update `RESEND_API_KEY`, delete the old one. Turnstile: roll the secret on the widget and
update `TURNSTILE_SECRET_KEY`. Neither needs a rebuild.

## 9. Free-tier limits

All of this is free. Limits are as read from the providers' pages on 2026-11-23; check them
again before launch, since providers change them. [ADR 2](adr/0002-lead-email-transport.md),
[ADR 3](adr/0003-cookieless-analytics.md) and the
[architecture notes](architecture.md#free-tier-limits) describe the code side.

| Service                 | Free limit                                                                                                                                          | What happens at the limit, and what the site does                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers requests        | 100,000 a day (resets at midnight UTC). Static pages and files do not count; only `/api/intake/` runs code.                                         | Over the limit, Worker requests fail with Cloudflare error 1027 until the reset. Static pages are not counted, so they keep loading. A form post would fail, so nothing reaches the office; the contact page shows the office details beside the form. Spam is the likely cause: see below. |
| Workers CPU             | 10 ms per request.                                                                                                                                  | The endpoint mostly waits on two network calls, which are not CPU time.                                                                                                                                                                                                                     |
| Static assets           | 20,000 files per version; 25 MiB per file.                                                                                                          | A deploy over the file count fails. Check with `find dist/client -type f \| wc -l`. Every photograph is written in several sizes and formats, so the count grows with each project.                                                                                                         |
| Workers Builds          | 3,000 build minutes a month, 1 build at a time, 20 minutes a build.                                                                                 | Builds queue or stop. The live site keeps running. Builds only for `main` keeps usage low.                                                                                                                                                                                                  |
| Turnstile               | Up to 20 widgets, 10 hostnames each, unlimited checks.                                                                                              | No usage limit applies. If Cloudflare cannot be reached, the form comes back with a notice and the office details (`503`), and nothing is lost.                                                                                                                                             |
| Resend                  | 100 emails a day (UTC day), 3,000 a month, 10 requests a second, 30 days of history, 3 domains.                                                     | Resend answers `429` with `daily_quota_exceeded` or `monthly_quota_exceeded`. The visitor gets the form back with everything typed, a message that it could not be sent now, and the office details. The log records `quota` with no personal data: review volume.                          |
| Web Analytics           | Free on every plan. 10 sites per account that are not proxied (none here). Detailed data kept briefly, then aggregated. Blocked by ad blockers.     | Nothing to run out of. If the token is missing or Cloudflare is down, pages are unaffected.                                                                                                                                                                                                 |
| Single redirect rules   | 10 per zone.                                                                                                                                        | One is used.                                                                                                                                                                                                                                                                                |
| Workers Logs (optional) | 200,000 events a day with 3 days of history today. Cloudflare says its logs move to a new pricing model on 2026-12-01 with 0.5 GB a day and 7 days. | The site does not depend on stored logs. `wrangler tail` and the dashboard's live logs are enough to test. Check the current numbers before relying on stored logs.                                                                                                                         |

The launched site already refuses posts without a spam-check token, so spam that reaches the
Resend cap has solved the Turnstile check or comes from many addresses at once. If that happens
even with the rate-limiting rule (section 7.3), follow ADR 2: review volume in the logs and
Turnstile's analytics in the Cloudflare dashboard before choosing a next step. Anything beyond
the free tiers (an upgrade, text messages,
a paid plan) needs the owner's approval first.

## What was not verified

- Every dashboard path and label in this runbook comes from documentation, not a live account.
  If a label differs, the documentation links below show the current one.
- The Google Search Console and Bing steps follow their help pages' descriptions and Bing's
  import announcement; the pages did not load fully when this was written.
- Whether the Cloudflare Images binding that the adapter adds ever receives traffic, and how
  Cloudflare's rate limits apply to it, were not checked. Look at its usage after launch.
- The `AAAA` placeholder record for the `www` redirect (section 6.6) follows Cloudflare's
  general redirect guidance from memory; the single-redirects page read did not show it.
- Resend's permission names are quoted from memory of the dashboard ("Sending access"); the
  documentation page read did not name them.
- `wrangler tail`, `wrangler rollback`, `wrangler secret put` and `wrangler login` need an
  account and were not run.

## Documentation used

Read on 2026-11-23.

Cloudflare Workers:

- [Workers Builds: configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
  [overview](https://developers.cloudflare.com/workers/ci-cd/builds/),
  [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
  [limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
  (`workers_dev`, `preview_urls`, resource provisioning),
  [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) and
  [Observability pricing](https://developers.cloudflare.com/observability/pricing/)
- [Astro: Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
  and [deploy to Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/)

Turnstile, Web Analytics and rules:

- [Turnstile: widget in the dashboard](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/),
  [hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
  [plans](https://developers.cloudflare.com/turnstile/plans/),
  [testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Web Analytics: get started](https://developers.cloudflare.com/web-analytics/get-started/) and
  [limits](https://developers.cloudflare.com/web-analytics/limits/)
- [Single redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/)

Resend:

- [Domains](https://resend.com/docs/dashboard/domains/introduction),
  [adding a domain](https://resend.com/docs/add-a-domain),
  [DNS records on Cloudflare](https://resend.com/docs/guides/dns/cloudflare),
  [DMARC](https://resend.com/docs/dashboard/domains/dmarc)
- [API keys](https://resend.com/docs/dashboard/api-keys/introduction),
  [usage limits](https://resend.com/docs/api-reference/rate-limit),
  [quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits),
  [pricing](https://resend.com/pricing)

Search engines:

- [Google Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
  and [building a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Bing: import sites from Search Console](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)
