# Updating the site's content

This guide is for the person who keeps the website's words and photographs up to date. You do not
need to write code. You will work with a coding assistant: tell it which recipe below you are
following, give it the words and photographs, and ask it to run the checks. Each recipe names the
exact file to change, shows an example you can copy, and says what the check prints when something
is wrong.

Nothing you change goes live on its own. Every change is reviewed as a pull request and published
only when it is merged.

## Words used in this guide

| Word         | What it means                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content file | A text file in `src/content/` that holds one project, service, town, person and so on.                                                                                                                 |
| File name    | The name of a content file without `.md`. For projects, services and towns it becomes the page address: `river-house.md` is shown at `/portfolio/river-house/`. Use lowercase words joined by hyphens. |
| Fields       | The lines between the two `---` lines at the top of a content file, such as `title: River House`. Each field is a name, a colon, a space and a value.                                                  |
| Body         | Everything after the second `---`: ordinary paragraphs. A line starting with `## ` is a heading.                                                                                                       |
| Indent       | The spaces at the start of a line. Lines that belong to a list or group are indented by two spaces. Never use tabs.                                                                                    |
| Draft        | A file with `draft: true`. It shows on your own computer and on previews, never on the live site.                                                                                                      |
| The check    | `npm run check`. It reads every content file and lists each field that is missing or wrong.                                                                                                            |
| The build    | `npm run build`. It makes the whole site, including every photograph. Some problems, such as a missing photograph, only show here.                                                                     |
| Preview      | The site running on your own computer at `http://localhost:4321`, started with `npm run dev`.                                                                                                          |
| Pull request | A proposed change on GitHub. The automatic checks run on it, and merging it publishes the change.                                                                                                      |

## How every change goes

1. Ask the assistant to start a new branch for the change (a branch is a separate copy of the site
   to work in).
2. Make the change, following one of the recipes below.
3. Run `npm run check`. If it lists problems, fix them using the messages (see
   [Reading a message from the check](#reading-a-message-from-the-check)) and run it again.
4. Run `npm run dev` and open the page in your browser, for example
   `http://localhost:4321/portfolio/river-house/`. Look at it wide and with the window made narrow
   like a phone.
5. Go through [Before you publish](#before-you-publish), then ask the assistant to open a pull
   request.

## Reading a message from the check

When a content file has a problem, the check stops and prints something like this:

```text
[InvalidContentEntryDataError] projects → wellington-horse-barn data does not match collection schema.
  category: Invalid option: expected one of "custom-home"|"renovation"|"commercial"
  coverAlt: Too small: expected string to have >=10 characters
  ****: Unrecognized key: "feautres"
```

- `projects → wellington-horse-barn` is the file: `src/content/projects/wellington-horse-barn.md`.
- Each indented line is one field and what is wrong with it. Here the category is misspelled, the
  photograph's description is too short, and `features` is misspelled as `feautres`.
- "Too small" and "Too big" mean too few or too many characters (letters and spaces). ">=10" means
  "at least 10".
- "Required" means the field is missing.
- "Unrecognized key" means a field name the site does not know, usually a typo.
- The check stops at the first file with a problem, so after fixing one file run it again.

A problem in the layout of the fields themselves looks different:

```text
Nested mappings are not allowed in compact mappings at line 2, column 8:
title: Horse Barn: Wellington
       ^
```

A value that contains a colon (`:`) must be wrapped in quotation marks:
`title: 'Horse Barn: Wellington'`. The same goes for a value that starts with a quotation mark, a
`#` or a dash.

## Recipes

### Add a project

1. Copy `src/content/projects/_template.md` to a new file in the same folder, named for the
   project, for example `src/content/projects/river-house.md`. The name becomes the address
   `/portfolio/river-house/`, so choose it carefully; changing it later breaks old links.
2. Fill in the fields. The template explains each one. A minimal project looks like this:

   ```yaml
   ---
   title: River House
   location: Jupiter
   category: custom-home # custom-home, renovation or commercial
   status: completed # completed or under-construction
   summary: A four-bedroom home on the river with a covered loggia, a dock and a pool facing the water.
   cover: ../../assets/projects/river-house/cover.jpg
   coverAlt: The river side of the house at dusk, with the pool in front
   order: 10
   draft: true
   ---
   The story of the project goes here, as ordinary paragraphs.
   ```

3. Add the photographs (see [Add photographs to a project](#add-photographs-to-a-project)).
4. Run the check, then preview the page. When it is ready, change `draft: true` to `draft: false`.

Limits the check enforces: `title` at most 70 characters, `location` at most 60, `summary` 40 to
220, `coverAlt` and every photograph description 10 to 160, at most 8 `features` of 80 characters
each.

### Edit a project

Open the project's file in `src/content/projects/` and change the fields or the story. Common
edits:

- **Stats:** the lines under `stats:` are each optional. Write `bathrooms` in quotation marks the
  way builders do: `bathrooms: '5.2'` means five full and two half baths.
- **Year:** `completedYear: 2024`.
- **Interior design credit:** `interiorDesignPartner: true` credits the interior design partner on
  the page and lists the project on `/interior-design/`.
- **Town:** `town: jupiter` links the project to that town's page (the value is the file name of a
  town in `src/content/towns/`). _Available once pull request #57 (Areas We Serve) is merged._

### Add photographs to a project

1. Make each photograph at most 2400 pixels on its long side, saved as JPEG.
2. **Remove the location from each photograph.** Phone and drone photographs store where they were
   taken, which can be a client's home. Ask the assistant to strip the location and camera details
   before saving. The import command below does this for you once it is available.
3. Put them in a folder named after the project: `src/assets/projects/river-house/`.
4. Point the project file at them. Every photograph needs a description of what it shows, written
   for someone who cannot see it:

   ```yaml
   cover: ../../assets/projects/river-house/cover.jpg
   coverAlt: The river side of the house at dusk, with the pool in front
   gallery:
     - src: ../../assets/projects/river-house/kitchen.jpg
       alt: The kitchen island in white oak, with the family room beyond
     - src: ../../assets/projects/river-house/stair.jpg
       alt: The entry staircase, lit from a tall window
   ```

5. Run the build (`npm run build`). The check does not open the photographs, so a wrong path only
   shows here:

   ```text
   [ImageNotFound] Could not find requested image `../../assets/projects/wellington-horse-barn/cover.jpg`. Does it exist?
   ```

   Check the folder name, the file name and the ending (`.jpg` or `.jpeg`).

6. **Before and after (optional).** A renovation reads best as a pair: the same view before and
   after. Take both from the same spot so they line up; the page crops both to the same 3:2
   shape and lets the visitor drag a line across to compare them. Add up to six pairs:

   ```yaml
   beforeAfter:
     - before: ../../assets/projects/river-house/kitchen-before.jpg
       beforeAlt: The kitchen before, with its closed-off galley layout
       after: ../../assets/projects/river-house/kitchen-after.jpg
       afterAlt: The same view after, opened up to the family room
       caption: The kitchen, opened up to the family room
   ```

   `caption` is optional. Leave `beforeAfter` out and the section does not appear.

_Coming:_ an import command, `npm run photos:import -- <folder> <project-file-name>` (issue #67),
will resize a folder of camera files, strip their location, save them in the right place and print
the `cover` and `gallery` lines to paste. Until it is merged, ask the assistant to do these steps.

### Feature a project on the home page

Set `featured: true` in the project's file. The featured project with the lowest `order` number
becomes the large photograph at the top of the home page; the others follow in the "Selected work"
section. Lower `order` numbers also come first in the portfolio, so leave gaps (10, 20, 30) to make
room for later projects.

### Publish or hide anything

Every content file has `draft:`. With `draft: true` the item shows on your computer and on
previews but not on the live site. Change it to `draft: false` to publish it. To take something
down without deleting it, set it back to `true`.

### Add a progress update to a project under construction

The project's `status` must be `under-construction`. Add a `progress:` list to its file, or add to
the end of the one that is there. Each update starts with a dash and has a date, a caption and,
usually, a photograph with its description:

```yaml
progress:
  - date: 2026-03-04
    caption: Foundation poured and the first floor walls framed.
    photo: ../../assets/projects/river-house/progress-2026-03-04.jpg
    alt: The concrete foundation with timber wall framing on top
  - date: 2026-04-18
    caption: Roof trusses set and the roof dried in.
```

- Write the date as year-month-day. The page shows the newest update first, whatever order they
  are in the file, and the project's card says "Updated" and the latest date.
- The photograph is optional; a caption alone is fine.
- When the project is finished, change `status` to `completed` and keep the updates in the file.
  The "Construction progress" section goes away and the gallery takes over. If three or more of
  the updates have a photograph, the page also gets a "How it was built" section after the
  gallery (see below).

### Show how a finished project was built

A finished project's page tells the story of its construction when it has the photographs for
it. Nothing to switch on: the section appears by itself when both are true:

- the project's `status` is `completed`, and
- at least three of its progress updates have a photograph.

The section is called "How it was built" and comes after the photographs. It shows the updates
that have a photograph, oldest first (slab to handover), each with its date and caption. Updates
without a photograph are left out of it. With fewer than three photographs the section is not
shown at all. On a computer the photograph stays in place while the captions scroll past beside
it, and each caption brings its own photograph forward; on a phone, and for visitors who turn
motion off, the photographs and captions simply follow one another.

To get the most from it, write each caption as the stage it shows ("Slab poured", "Roof dried
in", "Keys handed over") and pick photographs taken from similar angles, so one stage gives way
to the next. The photographs are cropped to 3:2, so keep the subject away from the top and bottom
edges.

What the check prints:

```text
progress.0.date: Write the date as year-month-day, for example 2026-03-04.
progress.1.alt: A progress photograph needs an alt line that says what it shows.
```

The number is the position in the list, counting from 0: `progress.1` is the second update.

### Add a testimonial

1. Copy `src/content/testimonials/_template.md` to a new file in that folder, for example
   `src/content/testimonials/river-house-owners.md`.
2. Fill it in. The quote is the text below the fields, without quotation marks:

   ```yaml
   ---
   attribution: Homeowners, Jupiter
   project: river-house # optional: the file name of the project
   aboutDesignPartner: false
   order: 10
   draft: false
   ---
   They told us what it would cost and when we would move in, and they were right on both.
   ```

- Use the client's full name only if they agreed. "Homeowners, Jupiter" is enough.
- Set `aboutDesignPartner: true` when the quote is about the interior designer's work. It then
  shows on `/interior-design/` instead of with the builder's testimonials.
- Testimonials appear on the home page.

What the check prints when `attribution` is missing:

```text
[InvalidContentEntryDataError] testimonials → river-house-owners data does not match collection schema.
  attribution**: **attribution: Required
```

**Watch for this one.** If `project:` names a project file that does not exist (a typo, or a
project not added yet), the check and the build still finish, but print a line like this. Read
their output for `[ERROR]`:

```text
[ERROR] [content] Invalid content reference: entry "river-house-owners" in collection "testimonials" (field: project) references "river-house" in collection "projects", but that entry does not exist.
```

### Edit a service

The four services are in `src/content/services/`: `custom-homes.md`, `renovations.md`,
`commercial.md` and `investors.md`. Change the `title`, the `summary` (40 to 220 characters, shown
under the title and on the home page), the `seoDescription` (50 to 160 characters, shown in search
results) or the body. In the body, each `## ` heading starts a new section, and lines starting with
`- ` become a list.

```text
[InvalidContentEntryDataError] services → custom-homes data does not match collection schema.
  seoDescription: Too small: expected string to have >=50 characters
```

### Edit or add a process stage

The stages on `/process/` are in `src/content/process/`, one file each. To add one, copy
`_template.md` there. The `order` number puts the stages in order (10, 20, 30, so one can go in
between). The large numbers on the page follow the order automatically.

```yaml
---
title: Permits and approvals
duration: 6 to 10 weeks # optional: only when the business has a typical length
order: 40
draft: false
---
What happens in this stage and what the client can expect, in one or two short paragraphs.
```

If `order` is missing:

```text
[InvalidContentEntryDataError] processSteps → design data does not match collection schema.
  order**: **order: Required
```

### Add a town

_Available once pull request #57 (Areas We Serve) is merged._

Each town page is one file in `src/content/towns/`. Copy an existing town file, rename it (the
name becomes `/areas/<name>/`) and rewrite it for the new town:

```yaml
---
name: Example Shores
county: Palm Beach County
latitude: 26.8901
longitude: -80.0712
summary: One or two sentences about building in this town, 40 to 220 characters.
seoDescription: What a search result should say about building in this town, 50 to 160 characters.
order: 80
draft: true
---
Paragraphs about the town: its setting, the building rules that apply there and how permits work.
```

`latitude` and `longitude` place the town's mark on the map on the Areas page. Both are required
and written in decimal degrees: latitude is the number of degrees north (around 26.9 here), and
longitude is negative because the town is west of Greenwich (around -80.1 here). Use the town's
commonly published center, for example its "internal point" in the US Census Bureau's Gazetteer
files or the coordinates at the top of its encyclopedia article, rounded to four decimals. The map
covers latitude 26.62 to 27.1 and longitude -80.3 to -80.03, from Hobe Sound to Wellington; a
town outside that box, or a longitude written without its minus sign, stops the build with a
message saying so. A town farther away needs the map extended first (see the Areas pages section of
`docs/architecture.md`).

Write each town's text for that town; do not copy paragraphs between towns. Check every statement
about a code, a permit or a town office against that office's own website. Then link projects to
the town with `town: example-shores` in their files.

### Update the team

Each person on `/about/` is one file in `src/content/team/`. To add someone, copy `_template.md`
there, for example to `src/content/team/jane-doe.md`.

```yaml
---
name: Jane Doe
role: Project manager
# photo: ../../assets/team/jane-doe.jpg   # optional: a portrait, about 1600px tall
realEstateLicensee: false
order: 40
draft: false
---
An optional short biography in plain paragraphs. Leave this empty until one is written.
```

**A real estate licensee** must have the brokerage named before they can be published, because
Florida's advertising rules require it. Set both fields, and write their `name` exactly as it is
registered with the licensing board:

```yaml
realEstateLicensee: true
brokerage: Example Realty LLC
```

Until the brokerage is known, keep `draft: true`. Publishing a licensee without it stops the
check:

```text
[InvalidContentEntryDataError] team → kim-armato data does not match collection schema.
  brokerage: A real estate licensee must name their brokerage before this entry can be published. Add the brokerage, or keep draft: true.
```

### Update the interior design partner

- Her name and website are in `src/lib/site.ts`, under `designPartner`.
- Her introduction is in `src/content/design-partner/ashley-manfred.md`: a `summary` (40 to 220
  characters), a `seoDescription` (50 to 160), `basedIn`, the places in `worksIn` (one per line,
  each starting with `- `) and the biography as the body. Keep that folder to one file.
- Credit her on a project with `interiorDesignPartner: true` in the project's file.

```text
[InvalidContentEntryDataError] designPartner → ashley-manfred data does not match collection schema.
  summary: The summary is too short: write at least 40 characters.
```

### Set the office phone number and the license number

Both are in `src/lib/site.ts`. While a value is `null` it is left off every page.

```ts
  phone: '5615550100',
  licenseNumber: 'CGC0000000',
```

- Write the phone number as ten digits, no spaces or dashes, inside quotation marks. The site
  formats it as (561) 555-0100.
- Use the license number exactly as issued, inside quotation marks.

This file is code, so a mistake shows up as an error from the check instead of a field message.
Forgetting the quotation marks prints:

```text
src/lib/site.ts:57:3 - error ts(2322): Type 'number' is not assignable to type 'string'.
57   phone: 5615550100,
```

### Turn on text-message alerts for new enquiries

Every enquiry from the contact form is emailed to the office. A text message to a phone as well is
built in but switched off, because it costs money (a small charge per message plus a monthly
number) and needs a messaging account that takes some days to be approved. It is switched on in
the hosting settings, not in a content file, and needs the owner's approval. The steps are in the
technical notes under [SMS](architecture.md#sms).

### Turn the site live

1. Run `npm run launch-check`. It lists each thing the live site needs (the license number, the
   office phone, the domain, the brokerage for any licensee on the team, no sample content left
   published, and the speed and accessibility checks) and says what to do about each one that is
   not ready.
2. When every line says `PASS`, the person who manages the hosting account sets
   `PUBLIC_SITE_LAUNCHED` to `true` in the site's build settings at Cloudflare and publishes.
   This removes the "do not index" tag from every page and hides every draft. Changes to the
   hosting account need the owner's approval.

## Before you publish

- [ ] Every page you changed looks right in the preview, both wide and with the window made narrow
      like a phone.
- [ ] Every photograph has a real description, and no photograph still carries its location.
- [ ] Nothing private is in the text: no client's full name without their agreement, no home
      address, no personal phone number or email.
- [ ] `npm run verify` finishes without problems. It runs the check, the tests and the build
      together. Read its output for `[ERROR]` lines too.
- [ ] Items meant to go live have `draft: false`; items not ready yet have `draft: true`.
- [ ] Ask the assistant to open a pull request. When its automatic checks are green, it can be
      merged.
