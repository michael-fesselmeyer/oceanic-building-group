import { describe, expect, it } from 'vitest';
import type { SiteFacts } from '../../src/lib/site';
import {
  breadcrumbJsonLd,
  businessId,
  businessJsonLd,
  pageGraph,
  projectCrumbs,
  projectJsonLd,
  serializeJsonLd,
  serviceCrumbs,
  townCrumbs,
  websiteJsonLd,
  type ProjectDescription,
} from '../../src/lib/structured-data';

const site = 'https://builders.example.test';

const facts: SiteFacts = {
  name: 'Example Builders',
  legalName: 'Example Builders LLC',
  tagline: 'Residential & Commercial Construction',
  serviceArea: 'Exampleville and the Example Coast',
  address: {
    street: '100 Example Way, Suite 1',
    city: 'Exampleville',
    region: 'FL',
    postalCode: '33000',
  },
  phone: null,
  licenseNumber: null,
  designPartner: null,
};

const project: ProjectDescription = {
  name: 'Harbor House',
  description: 'A coastal home with a covered terrace, built for a family of five.',
  path: '/portfolio/harbor-house/',
  location: 'Exampleville',
  image: {
    url: '/_astro/harbor-house.abc123.jpg',
    width: 1600,
    height: 1067,
    alt: 'Front of the home at dusk',
  },
};

describe('businessJsonLd', () => {
  it('describes a general contractor with its name, address and area served', () => {
    const node = businessJsonLd(facts, site);
    expect(node).toMatchObject({
      '@type': 'GeneralContractor',
      '@id': 'https://builders.example.test/#business',
      name: 'Example Builders',
      legalName: 'Example Builders LLC',
      url: 'https://builders.example.test/',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '100 Example Way, Suite 1',
        addressLocality: 'Exampleville',
        addressRegion: 'FL',
        postalCode: '33000',
        addressCountry: 'US',
      },
      areaServed: { '@type': 'AdministrativeArea', name: 'Exampleville and the Example Coast' },
    });
  });

  it('gives the logo as an absolute image', () => {
    expect(businessJsonLd(facts, site).logo).toEqual({
      '@type': 'ImageObject',
      url: 'https://builders.example.test/icon-512.png',
      width: 512,
      height: 512,
    });
  });

  it('leaves out the phone number and license number while they are null', () => {
    const node = businessJsonLd(facts, site);
    expect(node).not.toHaveProperty('telephone');
    expect(node).not.toHaveProperty('identifier');
    expect(JSON.stringify(node)).not.toMatch(/null|undefined/);
  });

  it('includes the phone number in international form once it is known', () => {
    expect(businessJsonLd({ ...facts, phone: '5555550100' }, site).telephone).toBe('+15555550100');
  });

  it('leaves out a phone number that is not ten digits', () => {
    expect(businessJsonLd({ ...facts, phone: '555' }, site)).not.toHaveProperty('telephone');
  });

  it('includes the license number once it is known', () => {
    expect(businessJsonLd({ ...facts, licenseNumber: 'CGC0000000' }, site).identifier).toEqual({
      '@type': 'PropertyValue',
      name: 'State contractor license number',
      value: 'CGC0000000',
    });
  });

  it('makes no claims about ratings, reviews or offers', () => {
    const text = JSON.stringify(
      businessJsonLd({ ...facts, phone: '5555550100', licenseNumber: 'CGC0000000' }, site),
    );
    expect(text).not.toMatch(/rating|review|offer|price/i);
  });
});

describe('websiteJsonLd', () => {
  it('names the site and points at the business as its publisher', () => {
    expect(websiteJsonLd(facts, site)).toEqual({
      '@type': 'WebSite',
      '@id': 'https://builders.example.test/#website',
      name: 'Example Builders',
      url: 'https://builders.example.test/',
      publisher: { '@id': businessId(site) },
    });
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers each step from one with an absolute address', () => {
    const node = breadcrumbJsonLd(projectCrumbs('Harbor House', '/portfolio/harbor-house/'), site);
    expect(node).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://builders.example.test/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Portfolio',
          item: 'https://builders.example.test/portfolio/',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Harbor House',
          item: 'https://builders.example.test/portfolio/harbor-house/',
        },
      ],
    });
  });

  it('puts the service index before a service', () => {
    const names = serviceCrumbs('Renovations', '/services/renovations/').map((c) => c.name);
    expect(names).toEqual(['Home', 'Services', 'Renovations']);
  });

  it('puts the areas index before a town', () => {
    const crumbs = townCrumbs('Exampleville', '/areas/exampleville/');
    expect(crumbs.map((c) => c.path)).toEqual(['/', '/areas/', '/areas/exampleville/']);
    expect(crumbs[1]?.name).toBe('Areas We Serve');
  });

  it('adds the trailing slash to a path that lacks one', () => {
    const node = breadcrumbJsonLd([{ name: 'Portfolio', path: '/portfolio' }], site);
    expect(node?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Portfolio',
        item: 'https://builders.example.test/portfolio/',
      },
    ]);
  });

  it('skips steps with no name or path and returns null for an empty trail', () => {
    expect(breadcrumbJsonLd([], site)).toBeNull();
    expect(breadcrumbJsonLd([{ name: ' ', path: '/x/' }], site)).toBeNull();
    const node = breadcrumbJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: '', path: '/a/' },
        { name: 'B', path: '/b/' },
      ],
      site,
    );
    const items = node?.itemListElement as { position: number; name: string }[];
    expect(items.map((i) => [i.position, i.name])).toEqual([
      [1, 'Home'],
      [2, 'B'],
    ]);
  });
});

describe('projectJsonLd', () => {
  it('describes the project with its location and main photograph as an absolute address', () => {
    expect(projectJsonLd(project, site)).toEqual({
      '@type': 'WebPage',
      '@id': 'https://builders.example.test/portfolio/harbor-house/#project',
      url: 'https://builders.example.test/portfolio/harbor-house/',
      name: 'Harbor House',
      description: 'A coastal home with a covered terrace, built for a family of five.',
      isPartOf: {
        '@type': 'WebSite',
        '@id': 'https://builders.example.test/#website',
        url: 'https://builders.example.test/',
      },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        '@id': 'https://builders.example.test/portfolio/harbor-house/#photo',
        url: 'https://builders.example.test/_astro/harbor-house.abc123.jpg',
        width: 1600,
        height: 1067,
        caption: 'Front of the home at dusk',
      },
      image: 'https://builders.example.test/_astro/harbor-house.abc123.jpg',
      contentLocation: { '@type': 'Place', name: 'Exampleville' },
    });
  });

  it('keeps an image that is already absolute', () => {
    const node = projectJsonLd(
      { ...project, image: { ...project.image, url: 'https://cdn.example.test/a.jpg' } },
      site,
    );
    expect(node.image).toBe('https://cdn.example.test/a.jpg');
  });

  it('includes the year only when the page shows one', () => {
    expect(projectJsonLd(project, site)).not.toHaveProperty('dateCreated');
    expect(projectJsonLd({ ...project, completedYear: 2023 }, site).dateCreated).toBe('2023');
  });

  it('credits the design partner only when the page does', () => {
    expect(projectJsonLd({ ...project, designPartner: null }, site)).not.toHaveProperty(
      'contributor',
    );
    expect(projectJsonLd(project, site)).not.toHaveProperty('contributor');
    const credited = projectJsonLd(
      {
        ...project,
        designPartner: { name: 'Example Interiors', url: 'https://interiors.example.test/' },
      },
      site,
    );
    expect(credited.contributor).toEqual({
      '@type': 'Organization',
      name: 'Example Interiors',
      url: 'https://interiors.example.test/',
    });
  });

  it('makes no claims about ratings or reviews', () => {
    expect(JSON.stringify(projectJsonLd({ ...project, completedYear: 2023 }, site))).not.toMatch(
      /rating|review/i,
    );
  });
});

describe('pageGraph', () => {
  const base = { facts, siteUrl: site };

  it('carries exactly one business and no breadcrumbs on a top-level page', () => {
    const graph = pageGraph({ ...base, pathname: '/portfolio/' });
    const nodes = graph['@graph'] as { '@type': string }[];
    expect(graph['@context']).toBe('https://schema.org');
    expect(nodes.map((n) => n['@type'])).toEqual(['GeneralContractor']);
  });

  it('adds the website on the home page only', () => {
    const types = (pathname: string) =>
      (pageGraph({ ...base, pathname })['@graph'] as { '@type': string }[]).map((n) => n['@type']);
    expect(types('/')).toEqual(['GeneralContractor', 'WebSite']);
    expect(types('/process/')).toEqual(['GeneralContractor']);
  });

  it('adds breadcrumbs and page nodes after the business', () => {
    const graph = pageGraph({
      ...base,
      pathname: '/portfolio/harbor-house/',
      breadcrumbs: projectCrumbs('Harbor House', '/portfolio/harbor-house/'),
      nodes: [projectJsonLd(project, site)],
    });
    const types = (graph['@graph'] as { '@type': string }[]).map((n) => n['@type']);
    expect(types).toEqual(['GeneralContractor', 'BreadcrumbList', 'WebPage']);
  });

  it('survives a round trip through JSON with no empty values', () => {
    const graph = pageGraph({ ...base, pathname: '/' });
    expect(JSON.parse(serializeJsonLd(graph))).toEqual(JSON.parse(JSON.stringify(graph)));
    expect(serializeJsonLd(graph)).not.toMatch(/null|undefined/);
  });
});

describe('serializeJsonLd', () => {
  it('cannot be closed early by markup in a value', () => {
    const text = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
