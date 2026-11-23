import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The names the page should list, worked out from the team files with the
// page's own rules: drafts show unless the site is launched, and a real
// estate licensee never shows without a brokerage.
const launched = process.env.PUBLIC_SITE_LAUNCHED === 'true';
const teamFolder = join(import.meta.dirname, '../../src/content/team');
const expectedTeam = readdirSync(teamFolder)
  .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
  .map((file) => {
    const front = readFileSync(join(teamFolder, file), 'utf8').match(/^---\n([\s\S]*?)\n---/)![1];
    const field = (name: string) =>
      front.match(new RegExp(`^${name}: ([^#\\n]+)`, 'm'))?.[1].trim();
    return {
      name: field('name')!,
      order: Number(field('order') ?? 100),
      shown:
        (!launched || field('draft') !== 'true') &&
        (field('realEstateLicensee') !== 'true' || Boolean(field('brokerage'))),
    };
  })
  .filter((member) => member.shown)
  .sort((a, b) => a.order - b.order)
  .map((member) => member.name);

test.describe('/about/ page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about/');
  });

  test('has one main heading, headings in order, no accessibility violations and no sideways scroll', async ({
    page,
  }) => {
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
  });

  test('is titled and described for search', async ({ page }) => {
    await expect(page).toHaveTitle(/^About \| Oceanic Building Group/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(50);
    expect(description?.length).toBeLessThanOrEqual(160);
  });

  test('marks About as the current page in the navigation', async ({ page }) => {
    await expect(page.locator('.site-nav [aria-current="page"]')).toHaveAttribute(
      'href',
      '/about/',
    );
  });

  test('describes experience as the principals’, never the company’s age', async ({ page }) => {
    const facts = page.locator('.facts');
    await expect(facts.locator('dt')).toHaveText(['Office', 'Serving', 'Principals’ experience']);
    await expect(facts.locator('dd').last()).toHaveText('30+ years');
    await expect(page.locator('main')).toContainText('Our principals bring more than 30 years');
    await expect(page.locator('main')).not.toContainText(/since \d{4}|founded|established/i);
  });

  test('tells the story and links to the services, process and design partner', async ({
    page,
  }) => {
    const story = page.getByRole('region', { name: 'What we do' });
    await expect(story).toContainText('custom homes');
    await expect(story).toContainText('a plan, a budget and a realistic timeline');
    const hrefs = await story
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual(['/services/', '/process/', '/interior-design/']);
  });

  test('lists the team in order, text-only while there are no portraits', async ({ page }) => {
    const team = page.getByRole('region', { name: 'Who you will work with' });
    await expect(team.getByRole('heading', { level: 3 })).toHaveText(expectedTeam);
    await expect(team.getByText('Managing member')).toHaveCount(2);
    await expect(team.locator('img')).toHaveCount(0);
  });

  test('never shows a real estate licensee without a brokerage', async ({ page }) => {
    await expect(page.getByText('Kim Armato')).toHaveCount(
      expectedTeam.includes('Kim Armato') ? 1 : 0,
    );
  });

  test('ends with a link to the contact page', async ({ page }) => {
    await expect(page.locator('main a').last()).toHaveAttribute('href', '/contact/');
  });
});

test.describe('team list in the style guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-guide/');
  });

  test('shows a portrait, the brokerage for a licensee and a long name', async ({ page }) => {
    const team = page.locator('.team-list');
    await expect(team.getByRole('img', { name: 'Portrait of Alex Example' })).toHaveCount(1);
    const agent = team.getByRole('listitem').filter({ hasText: 'Sam Example' });
    await expect(agent).toContainText('Brokerage');
    await expect(agent).toContainText('Example Realty');
    await expect(team.getByRole('listitem')).toHaveCount(3);
  });

  test('lines the names up across a row when one entry has a portrait', async ({ page }) => {
    test.skip(page.viewportSize()!.width <= 520, 'one column on phones');
    const names = page.locator('.team-list .name');
    const tops = await names.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(new Set(tops.slice(0, 2)).size).toBe(1);
  });
});
