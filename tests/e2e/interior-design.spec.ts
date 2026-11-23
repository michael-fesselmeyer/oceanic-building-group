import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The interior design page is checked three ways:
//   - /interior-design/                         the real page, from site.ts and the content file
//   - /style-guide/interior-design/             a made-up partner with every section filled in
//   - /style-guide/interior-design/no-partner/  site.designPartner set to null
// and the project page credit is followed from the style guide project.

const partner = { name: 'Ashley Manfred', url: 'https://www.ashleymanfred.com/' };

/** Published content files whose fields include the given line. */
function countContent(folder: string, line: string): number {
  const base = join(import.meta.dirname, '../../src/content', folder);
  return readdirSync(base)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => readFileSync(join(base, file), 'utf8'))
    .filter((text) => !/^draft: true$/m.test(text) || process.env.PUBLIC_SITE_LAUNCHED !== 'true')
    .filter((text) => new RegExp(`^${line}$`, 'm').test(text)).length;
}

async function expectSharedBasics(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  const levels = await page
    .locator('main :is(h1, h2, h3, h4)')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i += 1) {
    expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('/interior-design/ page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interior-design/');
  });

  test('has one main heading, headings in order, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expectSharedBasics(page);
  });

  test('is titled and described for search', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(partner.name);
    await expect(page).toHaveTitle(/^Interior Design \| Oceanic Building Group/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(50);
    expect(description?.length).toBeLessThanOrEqual(160);
  });

  test('marks Interior Design as the current page in the navigation', async ({ page }) => {
    const current = page.locator('header a[aria-current="page"]');
    await expect(current).toHaveAttribute('href', '/interior-design/');
  });

  test('introduces the partner with facts and a biography', async ({ page }) => {
    const facts = page.locator('.opening dl');
    await expect(facts.locator('dt')).toHaveText(['Based in', 'Works in', 'Website']);
    await expect(facts.getByRole('link')).toHaveAttribute('href', partner.url);

    const bio = page.getByRole('region', { name: 'Biography' });
    await expect(bio).toContainText('University of Michigan');
    await expect(bio.locator('p')).not.toHaveCount(0);
  });

  test('shows credited projects and testimonials only when the content has them', async ({
    page,
  }) => {
    const credited = countContent('projects', 'interiorDesignPartner: true');
    const projects = page.getByRole('region', { name: `Projects with ${partner.name}` });
    if (credited === 0) {
      await expect(projects).toHaveCount(0);
    } else {
      await expect(projects.getByRole('listitem')).toHaveCount(credited);
    }

    const quotes = countContent('testimonials', 'aboutDesignPartner: true');
    const testimonials = page.getByRole('region', { name: 'In clients’ words' });
    if (quotes === 0) {
      await expect(testimonials).toHaveCount(0);
    } else {
      await expect(testimonials.locator('figure')).toHaveCount(quotes);
    }
  });

  test('ends with the partner’s website and the contact page', async ({ page }) => {
    const closing = page.getByRole('complementary', { name: 'Tell us about your project' });
    const links = closing.getByRole('link');
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute('href', partner.url);
    await expect(links.last()).toHaveAttribute('href', '/contact/');
    await expect(page.locator('main a').last()).toHaveAttribute('href', '/contact/');
  });
});

test.describe('interior design page with every section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/interior-design/');
  });

  test('has one main heading, headings in order, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
    await expectSharedBasics(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Example Interiors Studio');
  });

  test('lists the credited projects as cards linking to their pages', async ({ page }) => {
    const projects = page.getByRole('region', { name: 'Projects with Example Interiors Studio' });
    const links = projects.getByRole('listitem').getByRole('link');
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute('href', '/portfolio/example-credited-home/');
  });

  test('shows each testimonial with its attribution and project', async ({ page }) => {
    const quotes = page.getByRole('region', { name: 'In clients’ words' }).locator('figure');
    await expect(quotes).toHaveCount(2);
    await expect(quotes.first().locator('figcaption')).toContainText(
      'Example Intracoastal Residence',
    );
    await expect(quotes.last().locator('.source')).toHaveCount(0);
  });

  test('keeps a long biography at reading width', async ({ page }) => {
    const prose = page.getByRole('region', { name: 'Biography' }).locator('.prose');
    await expect(prose.locator('p')).toHaveCount(5);
    const box = await prose.boundingBox();
    // 42rem of 17px text, plus a little for rounding.
    expect(box!.width).toBeLessThanOrEqual(42 * 16 + 2);
  });
});

test.describe('interior design page with no partner set', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/interior-design/no-partner/');
  });

  test('says the partner is coming and still offers the contact page', async ({ page }) => {
    await expectSharedBasics(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Interior Design');
    await expect(page.locator('.opening dl')).toHaveCount(0);
    await expect(page.locator('main').getByRole('region')).toHaveCount(0);
    const closing = page.getByRole('complementary', { name: 'Tell us about your project' });
    await expect(closing.getByRole('link')).toHaveCount(1);
    await expect(closing.getByRole('link')).toHaveAttribute('href', '/contact/');
  });
});

test('the project page credit leads to the interior design page', async ({ page }) => {
  await page.goto('/style-guide/project/');
  const credit = page.getByRole('region', { name: 'Interiors' }).getByRole('link');
  await expect(credit).toHaveAttribute('href', '/interior-design/');
  await credit.click();
  await expect(page).toHaveURL(/\/interior-design\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(partner.name);
});
