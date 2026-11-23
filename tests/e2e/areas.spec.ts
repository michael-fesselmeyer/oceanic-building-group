import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Towns are the files in src/content/towns, so a new town is covered without editing this file.
const townsDir = join(process.cwd(), 'src', 'content', 'towns');
const townIds = readdirSync(townsDir)
  .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
  .map((name) => name.slice(0, -'.md'.length))
  .sort();

// One town with finished projects and one without, from the real content.
const withProjects = 'jupiter-inlet-colony';
const withoutProjects = 'jupiter';

const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the site has towns to check', () => {
  expect(townIds).toContain(withProjects);
  expect(townIds).toContain(withoutProjects);
});

test.describe('areas index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/areas/');
  });

  test('has one main heading, a title and a description', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Areas We Serve');
    await expect(page).toHaveTitle(/^Areas We Serve \| Oceanic Building Group/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(50);
    expect(description?.length).toBeLessThanOrEqual(160);
  });

  test('links to every town and counts projects only where there are some', async ({ page }) => {
    const rows = page.locator('.row');
    await expect(rows).toHaveCount(townIds.length);
    for (const id of townIds) {
      await expect(page.locator(`.row a[href="/areas/${id}/"]`)).toHaveCount(1);
    }
    await expect(
      rows.filter({ has: page.locator(`a[href="/areas/${withProjects}/"]`) }).locator('.count'),
    ).toHaveText(/^\d+ projects? in the portfolio$/);
    await expect(
      rows.filter({ has: page.locator(`a[href="/areas/${withoutProjects}/"]`) }).locator('.count'),
    ).toHaveCount(0);
  });

  test('has no accessibility violations and no sideways scroll', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
  });

  test('draws a map with a labeled link to every town, beside the list', async ({
    page,
    isMobile,
  }) => {
    const map = page.locator('.map svg');
    if (isMobile) {
      // On a phone the list carries the links on its own.
      await expect(map).toBeHidden();
      return;
    }
    await expect(map).toBeVisible();
    await expect(map.locator('title')).toHaveText('Map of the towns we serve');
    await expect(map.locator('desc')).toContainText('Intracoastal Waterway');
    await expect(map).toHaveAttribute('aria-labelledby', 'areas-map-title areas-map-desc');

    for (const id of townIds) {
      const name = (await page.locator(`.row a[href="/areas/${id}/"]`).textContent())?.trim();
      const link = map.locator(`a[href="/areas/${id}/"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toContainText(name ?? '');
    }
    await expect(map.locator(`a[href="/areas/${withProjects}/"]`)).toContainText(/\d+ projects?$/);
    await expect(map.locator(`a[href="/areas/${withoutProjects}/"]`)).not.toContainText(/project/);
  });

  test('keeps the map labels clear of each other', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The map is left out on phones.');
    const boxes = await page
      .locator('.map .town text')
      .evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().toJSON()));
    expect(boxes.length).toBe(townIds.length);
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        // Text boxes take the full line height, above the capitals and below the descenders,
        // so boxes that touch by a pixel are still clear of each other on screen.
        const apart =
          a.right <= b.left + 1 ||
          b.right <= a.left + 1 ||
          a.bottom <= b.top + 1 ||
          b.bottom <= a.top + 1;
        expect(apart, `labels overlap: ${JSON.stringify([a, b])}`).toBe(true);
      }
    }
  });

  test('shows the same state on a map mark for hover and keyboard focus', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The map is left out on phones.');
    // Without motion the colors change at once, so end states are compared, not midway colors.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const link = page.locator(`.map a[href="/areas/${withProjects}/"]`);
    const look = () =>
      link.evaluate((element) => {
        const style = (selector: string) => getComputedStyle(element.querySelector(selector)!);
        return {
          halo: style('.halo').stroke,
          mark: style('.mark').fill,
          name: style('.name').fill,
          underline: style('.name').textDecorationLine,
        };
      });
    const resting = await look();

    await page.keyboard.press('Shift');
    await link.focus();
    expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    const focused = await look();
    await link.evaluate((element) => (element as HTMLElement).blur());

    expect(focused).not.toEqual(resting);
    expect(focused.underline).toBe('underline');

    // The browser applies hover on its next frame after the pointer moves.
    await link.locator('.mark').hover();
    await expect.poll(look).toEqual(focused);
  });

  test('is linked from the footer', async ({ page }) => {
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'Areas We Serve' }),
    ).toHaveAttribute('href', '/areas/');
  });
});

for (const id of townIds) {
  test.describe(`town page /areas/${id}/`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/areas/${id}/`);
    });

    test('has one main heading, local copy and links to services and contact', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Building in .+/);
      await expect(page.locator('.prose h2').first()).toBeVisible();
      await expect(page.locator('.prose')).not.toContainText(/lorem|todo|placeholder/i);
      await expect(
        page.getByRole('region', { name: 'Our services' }).getByRole('link', {
          name: 'Custom Homes',
        }),
      ).toHaveAttribute('href', '/services/custom-homes/');
      await expect(
        page.getByRole('complementary').getByRole('link', { name: 'Start a Project' }),
      ).toHaveAttribute('href', '/contact/');
    });

    test('has no accessibility violations and no sideways scroll', async ({ page }) => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
    });

    test('shows its own title, description and canonical address', async ({ page }) => {
      await expect(page).toHaveTitle(/^Building in .+ \| Oceanic Building Group$/);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length).toBeGreaterThanOrEqual(50);
      expect(description?.length).toBeLessThanOrEqual(160);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://oceanicbuildinggroup.com/areas/${id}/`,
      );
    });
  });
}

test('a town with projects lists them as cards that link to their pages', async ({ page }) => {
  await page.goto(`/areas/${withProjects}/`);
  const section = page.getByRole('region', { name: /^Projects in / });
  const cards = section.locator('.project-list li');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const href of await section
    .locator('.project-list a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    expect(href).toMatch(/^\/portfolio\/[^/]+\/$/);
  }
});

test('a town with no projects says so and points to the portfolio and contact', async ({
  page,
}) => {
  await page.goto(`/areas/${withoutProjects}/`);
  const section = page.getByRole('region', { name: /^Projects in / });
  await expect(section.locator('.project-list')).toHaveCount(0);
  await expect(section).toContainText('does not yet include a finished project');
  await expect(section.getByRole('link', { name: 'Browse the full portfolio' })).toHaveAttribute(
    'href',
    '/portfolio/',
  );
  await expect(section.getByRole('link', { name: 'tell us about your site' })).toHaveAttribute(
    'href',
    '/contact/',
  );
});

test('a project page links its location to its town', async ({ page }) => {
  await page.goto('/portfolio/coastal-living-in-jupiter-inlet-colony/');
  await expect(page.locator('.facts dd a')).toHaveAttribute('href', `/areas/${withProjects}/`);
});

test('town pages carry breadcrumbs from Home through Areas We Serve', async ({ page }) => {
  await page.goto(`/areas/${withProjects}/`);
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
  );
  const trail = data['@graph'].find(
    (node: { '@type': string }) => node['@type'] === 'BreadcrumbList',
  );
  expect(trail.itemListElement.map((step: { name: string }) => step.name)).toEqual([
    'Home',
    'Areas We Serve',
    'Jupiter Inlet Colony',
  ]);
});
