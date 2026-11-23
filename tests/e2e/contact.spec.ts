import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { messages } from '../../src/lib/intake';

const visitor = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  message: 'A four bedroom home on a corner lot, starting next spring.',
};

const escape = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const form = (page: Page) => page.getByRole('form', { name: 'Project enquiry' });
const send = (page: Page) => page.getByRole('button', { name: 'Send enquiry' });

/**
 * The static test server runs no server code, so these tests record each post
 * to the intake endpoint and answer it themselves. intake.spec.ts posts to the
 * real endpoint in the built Worker.
 */
async function captureSubmissions(page: Page) {
  const bodies: string[] = [];
  await page.route('**/api/intake/', async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Thank you</h1>' });
  });
  return bodies;
}

/**
 * Keeps Cloudflare's spam-check script out of these tests, so they need no
 * network and post exactly what the visitor typed. The widget's own markup is
 * still checked.
 */
async function blockSpamCheck(page: Page) {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
}

test.describe('contact page', () => {
  test.beforeEach(async ({ page }) => {
    await blockSpamCheck(page);
    await page.goto('/contact/');
  });

  test("has a slot for the spam check with Cloudflare's test key", async ({ page }) => {
    // Preview builds use the always-pass test key; launched builds need a real one.
    await expect(form(page).locator('.cf-turnstile')).toHaveAttribute(
      'data-sitekey',
      '1x00000000000000000000AA',
    );
    await expect(
      page.locator('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'),
    ).toHaveCount(1);
  });

  test('has one main heading and a matching title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Start a project');
    await expect(page).toHaveTitle(/^Contact \| Oceanic Building Group/);
  });

  test('is where the header button leads', async ({ page }) => {
    const header = page.getByRole('banner');
    // On phones the link sits in the closed menu, so it is looked up including hidden elements.
    const link = header.getByRole('link', { name: 'Start a Project', includeHidden: true });
    await expect(link).toHaveAttribute('href', '/contact/');
  });

  test('posts to the intake endpoint', async ({ page }) => {
    await expect(form(page)).toHaveAttribute('action', '/api/intake/');
    await expect(form(page)).toHaveAttribute('method', 'post');
  });

  test('shows the office address with a directions link and no unknown facts', async ({ page }) => {
    const office = page.getByRole('complementary', { name: 'The office' });
    await expect(office).toContainText('357 S. Cypress Drive, Suite 13');
    await expect(office.getByRole('link', { name: 'Get directions' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
    );
    await expect(page.locator('main')).not.toContainText(/null|undefined/);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('keeps the spam trap away from people but in the page for programs', async ({ page }) => {
    const trap = page.locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(trap).toHaveAttribute('autocomplete', 'off');
    expect(await trap.evaluate((input) => input.closest('[aria-hidden="true"]') !== null)).toBe(
      true,
    );
    expect(await trap.evaluate((input) => getComputedStyle(input).display)).not.toBe('none');
  });

  test('shows a message under each answer to fix, a summary, and focuses the first', async ({
    page,
  }) => {
    await send(page).click();

    await expect(
      page.getByRole('heading', { name: 'Please fix 4 answers before sending' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name')).toBeFocused();
    await expect(page).toHaveURL(/\/contact\/$/);

    const expected = [
      [page.getByLabel('Name'), messages.nameRequired],
      [page.getByLabel('Email'), messages.emailRequired],
      [page.getByRole('radio', { name: 'Custom home' }), messages.projectTypeRequired],
      [page.getByLabel('About your project'), messages.messageRequired],
    ] as const;
    for (const [control, message] of expected) {
      await expect(control).toHaveAttribute('aria-invalid', 'true');
      await expect(control).toHaveAccessibleDescription(escape(message));
    }
    await expect(page.getByLabel('Phone')).not.toHaveAttribute('aria-invalid');
  });

  test('explains answers in the wrong shape and clears each message once fixed', async ({
    page,
  }) => {
    await page.getByLabel('Name').fill(visitor.name);
    await page.getByLabel('Email').fill('dana@example');
    await page.getByLabel('Phone').fill('555-0142');
    await page.getByRole('radio', { name: 'Renovation' }).check();
    await page.getByLabel('About your project').fill('Kitchen');
    await send(page).click();

    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.locator('#email-error')).toHaveText(messages.emailInvalid);
    await expect(page.locator('#phone-error')).toHaveText(messages.phoneInvalid);
    await expect(page.locator('#message-error')).toHaveText(messages.messageTooShort);

    await page.getByLabel('Email').fill(visitor.email);
    await expect(page.locator('#email-error')).toBeHidden();
    await expect(page.getByLabel('Email')).not.toHaveAttribute('aria-invalid');
    await expect(
      page.getByRole('heading', { name: 'Please fix 2 answers before sending' }),
    ).toBeVisible();
  });

  test('summary links move focus to the answer', async ({ page }) => {
    await send(page).click();
    await page.getByRole('link', { name: messages.projectTypeRequired }).click();
    await expect(page.getByRole('radio', { name: 'Custom home' })).toBeFocused();
  });

  test('sends a complete enquiry with an empty spam trap', async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.getByLabel('Name').fill(visitor.name);
    await page.getByLabel('Email').fill(visitor.email);
    await page.getByLabel('Phone').fill(visitor.phone);
    await page.getByRole('radio', { name: 'Investor partnership' }).check();
    await page.getByLabel('About your project').fill(visitor.message);
    await send(page).click();

    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
    const sent = new URLSearchParams(submissions[0]);
    expect(Object.fromEntries(sent)).toEqual({
      ...visitor,
      projectType: 'investor-partnership',
      // Optional follow-ups left blank. Radio groups with nothing chosen send nothing.
      town: '',
      building: '',
      website: '',
    });
  });

  test('asks follow-up questions only once a project type is chosen, and only its own', async ({
    page,
  }) => {
    const where = page.getByLabel('Where is the project?');
    const lot = page.getByRole('group', { name: 'Do you own the lot?' });
    const building = page.getByLabel('What kind of building?');
    await expect(where).toBeHidden();
    await expect(lot).toBeHidden();

    await page.getByRole('radio', { name: 'Custom home' }).check();
    await expect(where).toBeVisible();
    await expect(page.getByRole('group', { name: 'When would you like to start?' })).toBeVisible();
    await expect(lot).toBeVisible();
    await expect(building).toBeHidden();

    await page.getByRole('radio', { name: 'Commercial' }).check();
    await expect(building).toBeVisible();
    await expect(lot).toBeHidden();
    await expect(page.getByRole('group', { name: 'What kind of renovation?' })).toBeHidden();
  });

  test('moves focus from the project type straight to its follow-up questions', async ({
    page,
    browserName,
  }) => {
    // Safari's Tab key skips buttons, radios and menus unless the visitor turns that on.
    test.skip(browserName === 'webkit', 'WebKit tabs only to text fields by default');
    const renovation = page.getByRole('radio', { name: 'Renovation' });
    await renovation.check();
    await renovation.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Where is the project?')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Within 6 months' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'A room or two' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('About your project')).toBeFocused();
  });

  test('sends the follow-up answers with the enquiry', async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.getByLabel('Name').fill(visitor.name);
    await page.getByLabel('Email').fill(visitor.email);
    await page.getByRole('radio', { name: 'Commercial' }).check();
    await page.getByLabel('Where is the project?').selectOption({ label: 'Somewhere else' });
    await page.getByLabel('What kind of building?').fill('A small medical office');
    await page.getByRole('radio', { name: 'Not sure yet' }).check();
    await page.getByLabel('About your project').fill(visitor.message);
    await send(page).click();

    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
    const sent = Object.fromEntries(new URLSearchParams(submissions[0]));
    expect(sent).toMatchObject({
      projectType: 'commercial',
      town: 'elsewhere',
      building: 'A small medical office',
      start: 'not-sure',
    });
  });

  test('has no accessibility violations, before and after a failed attempt', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    // Submitted from the keyboard so the pointer does not leave the button mid-hover.
    await send(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-error-summary]')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('has no accessibility violations with every follow-up question showing', async ({
    page,
  }) => {
    for (const type of ['Custom home', 'Renovation', 'Commercial', 'Investor partnership']) {
      await page.getByRole('radio', { name: type }).check();
      expect((await new AxeBuilder({ page }).analyze()).violations, type).toEqual([]);
    }
  });

  test('never scrolls sideways', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('contact page without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test.beforeEach(async ({ page }) => {
    await blockSpamCheck(page);
  });

  test('the browser stops an incomplete enquiry', async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/contact/');
    await send(page).click();

    await expect(page).toHaveURL(/\/contact\/$/);
    expect(submissions).toHaveLength(0);
    for (const label of ['Name', 'Email', 'About your project']) {
      const control = page.getByLabel(label);
      await expect(control).toHaveAttribute('required');
      expect(await control.evaluate((input: HTMLInputElement) => input.validationMessage)).not.toBe(
        '',
      );
    }
    await expect(page.locator('[data-error-summary]')).toBeHidden();
  });

  test('the browser rejects a malformed phone number', async ({ page }) => {
    await page.goto('/contact/');
    await page.getByLabel('Phone').fill('555-0142');
    expect(
      await page.getByLabel('Phone').evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false);
    await page.getByLabel('Phone').fill('561-555-0142');
    expect(
      await page.getByLabel('Phone').evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(true);
  });

  test('a complete enquiry is sent', async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/contact/');
    await page.getByLabel('Name').fill(visitor.name);
    await page.getByLabel('Email').fill(visitor.email);
    await page.getByRole('radio', { name: 'Commercial' }).check();
    await page.getByLabel('About your project').fill(visitor.message);
    await send(page).click();

    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
    expect(new URLSearchParams(submissions[0]).get('projectType')).toBe('commercial');
  });
});
