// The shape every content file must follow. A file that breaks a rule fails
// `npm run check` and the build with the file name, the field and the
// reason, so a bad edit can never reach the live site.
//
// One folder in src/content/ per collection, one Markdown file per item.
// Short facts go in the fields at the top of the file; long text goes in
// the body. Files whose names start with "_" (the templates) are skipped.
//
// Changing a schema affects every content file and every page that reads
// it. Make schema changes in their own pull request, one at a time.
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const markdown = (folder: string) =>
  glob({ pattern: '**/[^_]*.md', base: `./src/content/${folder}` });

/** Text shown in search results: long enough to be useful, short enough not to be cut off. */
const seoDescription = z.string().min(50).max(160);

const projects = defineCollection({
  loader: markdown('projects'),
  schema: ({ image }) =>
    z.strictObject({
      title: z.string().max(70),
      /** Town or community as shown to visitors, for example "Jupiter Inlet Colony". */
      location: z.string().max(60),
      /** Links the project to its town page, when the town has one. */
      town: reference('towns').optional(),
      category: z.enum(['custom-home', 'renovation', 'commercial']),
      status: z.enum(['completed', 'under-construction']).default('completed'),
      /** Architectural style, for example "Coastal British West Indies". */
      style: z.string().max(60).optional(),
      summary: z.string().min(40).max(220),
      seoDescription: seoDescription.optional(),
      cover: image(),
      coverAlt: z.string().min(10).max(160),
      gallery: z
        .array(z.strictObject({ src: image(), alt: z.string().min(10).max(160) }))
        .default([]),
      stats: z
        .strictObject({
          totalSqFt: z.number().int().positive().optional(),
          livingSqFt: z.number().int().positive().optional(),
          bedrooms: z.number().int().positive().optional(),
          /** Written the way builders do: "5.2" means five full and two half baths. */
          bathrooms: z.string().max(8).optional(),
          buildMonths: z.number().int().positive().optional(),
        })
        .default({}),
      /** Short highlights shown as a list, for example "Infinity edge pool". */
      features: z.array(z.string().max(80)).max(8).default([]),
      completedYear: z.number().int().min(1980).max(2100).optional(),
      /** Shows the interior design partner credit on the project page. */
      interiorDesignPartner: z.boolean().default(false),
      /** Featured projects appear on the home page. */
      featured: z.boolean().default(false),
      /** Lower numbers come first. */
      order: z.number().int().default(100),
      /** Drafts show in development and previews, never on the launched site. */
      draft: z.boolean().default(false),
    }),
});

const services = defineCollection({
  loader: markdown('services'),
  schema: ({ image }) =>
    z.strictObject({
      title: z.string().max(50),
      summary: z.string().min(40).max(220),
      seoDescription,
      cover: image().optional(),
      coverAlt: z.string().min(10).max(160).optional(),
      order: z.number().int().default(100),
      draft: z.boolean().default(false),
    }),
});

const towns = defineCollection({
  loader: markdown('towns'),
  schema: z.strictObject({
    name: z.string().max(40),
    county: z.string().max(40).optional(),
    summary: z.string().min(40).max(220),
    seoDescription,
    order: z.number().int().default(100),
    draft: z.boolean().default(false),
  }),
});

const team = defineCollection({
  loader: markdown('team'),
  schema: ({ image }) =>
    z.strictObject({
      name: z.string().max(60),
      role: z.string().max(60),
      photo: image().optional(),
      order: z.number().int().default(100),
      draft: z.boolean().default(false),
    }),
});

const testimonials = defineCollection({
  loader: markdown('testimonials'),
  schema: z.strictObject({
    /** Who said it, without a full name unless the client agreed: "Homeowner, Juno Beach". */
    attribution: z.string().max(80),
    project: reference('projects').optional(),
    order: z.number().int().default(100),
    draft: z.boolean().default(false),
  }),
});

const processSteps = defineCollection({
  loader: markdown('process'),
  schema: z.strictObject({
    title: z.string().max(50),
    /** Typical length, for example "2 to 4 weeks". */
    duration: z.string().max(40).optional(),
    order: z.number().int(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, services, towns, team, testimonials, processSteps };
