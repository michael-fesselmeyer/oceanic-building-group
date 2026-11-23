// The intake endpoint in the built Worker (the "worker" project in
// playwright.config.ts). Email goes to the log transport, so nothing is sent.
// Without JavaScript the Turnstile widget never runs, so these posts carry no
// spam-check token and take the path a visitor without JavaScript takes.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { messages } from '../../src/lib/intake';

const visitor = {
  name: 'Dana Rivera',
  email: 'dana.rivera@example.test',
  phone: '(561) 555-0142',
  message: 'A four bedroom home on a corner lot, starting next spring.',
};

const send = (page: Page) => page.getByRole('button', { name: 'Send enquiry' });

async function fillIn(page: Page, email = visitor.email) {
  await page.getByLabel('Name').fill(visitor.name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill(visitor.phone);
  await page.getByRole('radio', { name: 'Renovation' }).check();
  await page.getByLabel('About your project').fill(visitor.message);
}

test.describe('intake endpoint without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test.beforeEach(async ({ page }) => {
    await page.goto('/contact/');
  });

  test('a complete enquiry reaches the thank-you page', async ({ page }) => {
    await fillIn(page);
    await send(page).click();

    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('an answer only the server rejects comes back with everything kept', async ({ page }) => {
    // The browser accepts a one-letter top-level domain; the shared schema does not.
    await fillIn(page, 'dana.rivera@example.x');
    await send(page).click();

    await expect(page).toHaveURL(/\/api\/intake\/$/);
    await expect(page).toHaveTitle(/^Check your enquiry \|/);
    await expect(
      page.getByRole('heading', { name: 'Please fix one answer before sending' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: messages.emailInvalid })).toHaveAttribute(
      'href',
      '#email',
    );
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#email-error')).toHaveText(messages.emailInvalid);

    await expect(page.getByLabel('Name')).toHaveValue(visitor.name);
    await expect(page.getByLabel('Email')).toHaveValue('dana.rivera@example.x');
    await expect(page.getByLabel('Phone')).toHaveValue(visitor.phone);
    await expect(page.getByRole('radio', { name: 'Renovation' })).toBeChecked();
    await expect(page.getByLabel('About your project')).toHaveValue(visitor.message);
    await expect(page.getByLabel('Name')).not.toHaveAttribute('aria-invalid');

    // Fixing the answer and sending again goes through.
    await page.getByLabel('Email').fill(visitor.email);
    await send(page).click();
    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
  });
});

test.describe('intake endpoint with JavaScript', () => {
  test('the form sent back is focused on its summary and has no accessibility violations', async ({
    page,
  }) => {
    // No spam-check script, so the post carries no token, as without JavaScript.
    await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
    await page.goto('/contact/');
    await fillIn(page, 'dana.rivera@example.x');
    await send(page).click();

    await expect(page).toHaveURL(/\/api\/intake\/$/);
    await expect(page.locator('[data-error-summary]')).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // The inline messages pick up from the server's: fixing the answer clears it.
    await page.getByLabel('Email').fill(visitor.email);
    await expect(page.locator('#email-error')).toBeHidden();
    await expect(page.locator('[data-error-summary]')).toBeHidden();
  });
});

test.describe('intake endpoint', () => {
  test('sends a visitor who opens the address back to the form', async ({ page }) => {
    await page.goto('/api/intake/');
    await expect(page).toHaveURL(/\/contact\/$/);
  });

  test('answers a post that is not a form with 415', async ({ request }) => {
    const response = await request.post('/api/intake/', {
      data: { name: visitor.name },
      headers: { Origin: test.info().project.use.baseURL! },
    });
    expect(response.status()).toBe(415);
  });

  test('drops a post with the spam trap filled while looking like a success', async ({
    request,
  }) => {
    const response = await request.post('/api/intake/', {
      form: { ...visitor, projectType: 'renovation', website: 'https://spam.example.test' },
      headers: { Origin: test.info().project.use.baseURL! },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toMatch(/\/contact\/thanks\/$/);
  });

  test('refuses a form posted from another site', async ({ request }) => {
    const response = await request.post('/api/intake/', {
      form: { ...visitor, projectType: 'renovation' },
      headers: { Origin: 'https://elsewhere.example.test' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
  });
});
