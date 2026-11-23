// Made-up content for the style guide pages, so every component can be seen
// with data the real content does not have yet (a gallery, a design partner,
// a very long title). Never used by a page of the launched site.
import placeholderTall from '../assets/placeholders/placeholder-tall.jpg';
import placeholder from '../assets/placeholders/placeholder-wide.jpg';
import type { Project } from './content';
import type { DesignPartnerIntro } from './design-partner';
import type { DesignPartner } from './site';
import type { TeamCard } from './team';

/** A made-up project. Pass only the fields an example needs to change. */
export function exampleProject(id: string, data: Partial<Project['data']>): Project {
  return {
    id,
    collection: 'projects',
    data: {
      title: 'Example project',
      location: 'Tequesta',
      category: 'custom-home',
      status: 'completed',
      summary: 'A made-up project used only on the style guide pages to show the layout.',
      cover: placeholder,
      coverAlt: 'Placeholder image standing in for a project photograph',
      gallery: [],
      stats: {},
      features: [],
      interiorDesignPartner: false,
      featured: false,
      order: 100,
      draft: true,
      ...data,
    },
  };
}

export const exampleDesignPartner: DesignPartner = {
  name: 'Example Interiors Studio',
  url: 'https://interiors.example.test/',
};

/** A project with every optional part filled in, including a gallery with a portrait photograph. */
export const exampleFullProject = exampleProject('example-full-project', {
  title: 'Example Riverfront Residence',
  location: 'Jupiter',
  style: 'Coastal Contemporary',
  completedYear: 2024,
  summary:
    'A made-up five-bedroom home on the river, used on the style guide to show a project page with every part filled in.',
  stats: { livingSqFt: 4200, totalSqFt: 6150, bedrooms: 5, bathrooms: '5.2', buildMonths: 14 },
  features: [
    'Covered loggia with an outdoor kitchen',
    'Dock and boat lift',
    'Primary suite on the first floor',
    'Impact-rated windows and doors throughout',
    'Wide plank white oak floors',
  ],
  gallery: [
    { src: placeholder, alt: 'Placeholder for a wide photograph of the river side of the house' },
    { src: placeholderTall, alt: 'Placeholder for a tall photograph of the entry staircase' },
    { src: placeholder, alt: 'Placeholder for a wide photograph of the kitchen and family room' },
  ],
  interiorDesignPartner: true,
});

/** A project with nothing optional: no stats, features, gallery, location or neighbors. */
export const exampleSparseProject = exampleProject('example-sparse-project', {
  title: 'A Commercial Renovation With a Deliberately Long Title That Has to Wrap',
  location: '',
  category: 'commercial',
  status: 'under-construction',
  summary:
    'A made-up project with only the required fields, used on the style guide to show what a project page leaves out.',
});

/** The made-up partner's introduction, with a long list of places. */
export const exampleDesignPartnerIntro: DesignPartnerIntro = {
  summary:
    'A made-up interior design studio, used on the style guide to show the interior design page with every section filled in.',
  basedIn: 'Palm Beach Gardens',
  worksIn: ['Jupiter', 'Tequesta', 'Juno Beach', 'Hobe Sound', 'Stuart', 'Wellington'],
};

/** Projects credited to the made-up partner. */
export const exampleDesignPartnerProjects = [
  exampleProject('example-credited-home', {
    title: 'Example Intracoastal Residence',
    location: 'Jupiter',
    interiorDesignPartner: true,
  }),
  exampleProject('example-credited-renovation', {
    title: 'Example Island Cottage Renovation',
    location: 'Jupiter Inlet Colony',
    category: 'renovation',
    interiorDesignPartner: true,
  }),
];

/** Made-up quotes about the made-up partner: one tied to a project, one not. */
export const exampleDesignPartnerQuotes = [
  {
    quote:
      'They found the rooms we did not know we wanted, and every piece of furniture arrived the week we moved in.',
    attribution: 'Homeowner, Jupiter',
    source: 'Example Intracoastal Residence',
  },
  {
    quote: 'Calm, patient and very good with color.',
    attribution: 'Homeowner, Tequesta',
  },
];

/** Made-up team members: a portrait with a biography, a licensee, and a long name with neither. */
export const exampleTeam: TeamCard[] = [
  {
    id: 'example-principal',
    name: 'Alex Example',
    role: 'Managing member',
    photo: placeholderTall,
    brokerage: null,
    bio: [
      'A made-up principal, used on the style guide to show a team entry with a portrait.',
      'A second paragraph shows how a longer biography is spaced.',
    ],
  },
  {
    id: 'example-agent',
    name: 'Sam Example',
    role: 'Real estate agent',
    brokerage: 'Example Realty',
    bio: [],
  },
  {
    id: 'example-long-name',
    name: 'Christopher Alexander Montgomery-Example',
    role: 'Project manager for commercial construction',
    brokerage: null,
    bio: [],
  },
];
