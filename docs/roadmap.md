# Roadmap

What the site will contain and the order it gets built in. Each numbered item is sized to become
one or a few issues.

## Site map

| Address                        | Page              | Purpose                                                                                  |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------------------------- |
| `/`                            | Home              | Hero, featured projects, the four services, process, design partner, contact             |
| `/portfolio/`                  | Portfolio         | Editorial layout with filters: custom homes, renovations, commercial, under construction |
| `/portfolio/<project>/`        | Project           | Gallery, stats, story, interior design credit, next and previous                         |
| `/services/`                   | Services          | Overview of the four service lines                                                       |
| `/services/custom-homes/`      | Custom Homes      | Ground-up residential builds                                                             |
| `/services/renovations/`       | Renovations       | Remodels and additions                                                                   |
| `/services/commercial/`        | Commercial        | Commercial construction and build-outs                                                   |
| `/services/investors/`         | Investor Partners | Speculative homes, land and joint ventures                                               |
| `/interior-design/`            | Interior Design   | The design partner: biography, shared projects, testimonials, link                       |
| `/process/`                    | Our Process       | The stages of a build with typical timelines                                             |
| `/about/`                      | About             | The company story and team                                                               |
| `/areas/` and `/areas/<town>/` | Areas We Serve    | One page per town with its local projects                                                |
| `/contact/`                    | Contact           | Intake form, office details, a directions link (no embedded map)                         |
| `/privacy/`, `/terms/`         | Legal             | Plain-language privacy policy and terms of use, linked from the footer                   |

## Phases

### 0. Foundation (done)

Project setup, design tokens, page shell, content schemas, tests, CI and repository rules.

### 1. Design system and home page

1. Core components: buttons and links, section headings, project card, photo with caption,
   pull quote, statistic list.
2. A simplified wordmark and favicon set derived from the full logo, plus a share image.
3. Header refinements: transparent over the hero, solid on scroll, current-page state.
4. Home page sections in their final layout, on real content where it exists.
5. Motion: CSS-only reveals and page transitions that respect reduced motion.

### 2. Portfolio

1. Portfolio index with category and status filters that work without JavaScript.
2. Project page template: hero, gallery with a lightbox, stats, story, credits, next and previous.
3. Project content: every completed project, with its photographs sized and described.
4. Under-construction projects with progress photographs.

### 3. Company pages

1. Services overview and the four service pages.
2. Our Process.
3. About, with the team.
4. Interior Design partner page.
5. Privacy and terms (drafted; the business reviews both texts before launch).

### 4. Intake form

1. Contact page and form markup with accessible validation.
2. Server endpoint: validation, spam protection, email notification.
3. Notification channel abstraction with the SMS channel implemented behind a switch.
4. Tests: unit tests for validation and the notifier, a browser test of the full submission
   against a stubbed mail service.

### 5. Search and sharing

1. Structured data: the business, breadcrumbs, and each project.
2. Sitemap, and share images for every page type.
3. Town pages with genuinely local content and their projects.
4. Per-page Lighthouse coverage in CI for every page type.

### 6. Launch readiness

1. Cross-browser and device pass, including Safari.
2. Security headers.
3. Analytics that needs no cookie banner.
4. Launch checklist script covering the gates below.

### 7. After launch

1. SMS notifications switched on.
2. A visual content editor, if the owner wants one.
3. An interactive construction-sequence feature for a flagship project.

## Launch gates

The site must not go live until each of these is true. `npm run launch-check` checks them all
(see the README):

- The contractor license number is issued and shown in the footer and on the contact page.
- The public office phone number is set.
- The domain is registered and `site` in `astro.config.mjs` matches it.
- The team listing includes any brokerage details required for a real-estate licensee.
- No draft or sample content remains published.
- Every page type passes the Lighthouse budget.

## Content still needed from the business

- High-resolution photographs for each project, and drone footage where it exists.
- Commercial projects: at least three, with photographs and a short description.
- Team biographies and portraits, and the brokerage for the real estate agent on the team.
- Interior design partner: which projects to credit, photographs of shared projects, client quotes.
- Client testimonials: three to five to start.
- Typical timelines for the stages of the process page. Only construction has one so far (11 to
  12 months for a typical new home); add a `duration` to any other stage once the business confirms it.
