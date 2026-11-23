// The whole enquiry path: a visitor fills in the contact form on the built
// site, the built Worker checks it and hands it to the log transport, and the
// visitor lands on the right page. What the office would have been sent is
// read back from the Worker's log (tests/e2e/worker-under-test.ts), which
// holds only redacted lines.
//
// Nothing here reaches a mail or spam service. The browser is cut off from
// every other host, Turnstile's script is replaced by a stand-in that adds
// Cloudflare's dummy test token, the Worker answers Cloudflare's test secrets
// itself, and email goes to the log transport.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { notices, parseIntake } from '../../src/lib/intake';
import { leadKey } from '../../src/lib/intake-handler';
import { failingWorker, passingWorker, type WorkerUnderTest } from './worker-under-test';

const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Turnstile's script, replaced: it adds the token the real widget would. */
const TURNSTILE_STAND_IN = `
  for (const widget of document.querySelectorAll('.cf-turnstile')) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    input.value = '${DUMMY_TOKEN}';
    widget.append(input);
  }
`;

interface Visitor {
  name: string;
  email: string;
  phone: string;
  projectType: string;
  projectLabel: string;
  message: string;
}

/** Each test sends its own message, so its lines in the shared log can be told apart. */
function visitor(message: string, overrides: Partial<Visitor> = {}): Visitor {
  return {
    name: 'Dana Rivera',
    email: 'dana.rivera@example.test',
    phone: '(561) 555-0142',
    projectType: 'renovation',
    projectLabel: 'Renovation',
    message,
    ...overrides,
  };
}

/** The idempotency key the Worker gives these answers; its log names the first 12 characters. */
async function keyOf(person: Visitor): Promise<string> {
  const parsed = parseIntake({ ...person });
  if (!parsed.success) throw new Error('test visitor is not valid');
  return (await leadKey(parsed.data)).slice(0, 12);
}

const workerLog = (worker: WorkerUnderTest) => readFileSync(worker.logFile, 'utf8');

/** Cuts the browser off from every host but the site, and stands in for Turnstile. */
async function offline(page: Page): Promise<string[]> {
  const elsewhere: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    if (url.href.startsWith('https://challenges.cloudflare.com/turnstile/')) {
      return route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STAND_IN });
    }
    elsewhere.push(url.href);
    return route.abort();
  });
  return elsewhere;
}

async function fillIn(page: Page, person: Visitor) {
  await page.getByLabel('Name').fill(person.name);
  await page.getByLabel('Email').fill(person.email);
  await page.getByLabel('Phone').fill(person.phone);
  await page.getByRole('radio', { name: person.projectLabel }).check();
  await page.getByLabel('About your project').fill(person.message);
}

const send = (page: Page) => page.getByRole('button', { name: 'Send enquiry' });

/** Nothing the visitor typed appears in full in the Worker's log. */
function expectRedacted(log: string, person: Visitor) {
  expect(log).not.toContain(person.email);
  expect(log).not.toContain(person.name);
  expect(log).not.toContain('555-0142');
  expect(log).not.toContain(person.message);
  expect(log).not.toContain('office@example.test');
}

test.describe('an enquiry with JavaScript on', () => {
  test('passes the spam check, reaches the office and shows the thank-you page', async ({
    page,
  }) => {
    const elsewhere = await offline(page);
    const person = visitor('A new kitchen and a covered porch for a house in Tequesta.');
    const key = await keyOf(person);

    await page.goto('/contact/');
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(DUMMY_TOKEN);
    await fillIn(page, person);
    await send(page).click();

    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you');

    // The message the office would get, as the log transport recorded it.
    await expect
      .poll(() => workerLog(passingWorker))
      .toMatch(
        new RegExp(
          `\\[intake\\] email not sent \\(log transport\\): to o\\*\\*\\*@\\*\\*\\*\\.test, ` +
            `reply to d\\*\\*\\*@\\*\\*\\*\\.test, \\d+ characters, key ${key}`,
        ),
      );
    expect(workerLog(passingWorker)).toContain(
      `[intake] sent: D., d***@***.test, phone ***42, Renovation, message ${person.message.length} characters, spam check passed`,
    );
    expectRedacted(workerLog(passingWorker), person);
    expect(elsewhere).toEqual([]);
  });

  test('is refused when the spam check fails, and the form keeps every answer', async ({
    page,
  }) => {
    const elsewhere = await offline(page);
    const person = visitor('An office build-out on the second floor of a bank building.', {
      projectType: 'commercial',
      projectLabel: 'Commercial',
    });
    const key = await keyOf(person);

    await page.goto(`${failingWorker.baseURL}/contact/`);
    await fillIn(page, person);
    await send(page).click();

    await expect(page).toHaveURL(`${failingWorker.baseURL}/api/intake/`);
    await expect(page.getByText(notices.spamCheckFailed)).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue(person.name);
    await expect(page.getByLabel('Email')).toHaveValue(person.email);
    await expect(page.getByLabel('Phone')).toHaveValue(person.phone);
    await expect(page.getByRole('radio', { name: 'Commercial' })).toBeChecked();
    await expect(page.getByLabel('About your project')).toHaveValue(person.message);
    // A fresh spam check is ready for the next try.
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(DUMMY_TOKEN);

    await expect
      .poll(() => workerLog(failingWorker))
      .toContain('[intake] refused: spam check failed (invalid-input-response)');
    expect(workerLog(failingWorker)).not.toContain(key);
    expectRedacted(workerLog(failingWorker), person);
    expect(elsewhere).toEqual([]);
  });
});

test.describe('an enquiry with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('reaches the office flagged as unchecked, and shows the thank-you page', async ({
    page,
  }) => {
    const elsewhere = await offline(page);
    const person = visitor('A pool house and summer kitchen behind an existing home.');
    const key = await keyOf(person);

    await page.goto('/contact/');
    await fillIn(page, person);
    await send(page).click();

    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect.poll(() => workerLog(passingWorker)).toContain(`key ${key}`);
    expect(workerLog(passingWorker)).toContain(
      `message ${person.message.length} characters, spam check not-run`,
    );
    expectRedacted(workerLog(passingWorker), person);
    expect(elsewhere).toEqual([]);
  });

  test('comes back with every answer kept when one needs fixing, then goes through', async ({
    page,
  }) => {
    await offline(page);
    // The browser accepts a one-letter top-level domain; the shared schema does not.
    const person = visitor('A second-story addition over the garage, with a balcony.', {
      email: 'dana.rivera@example.x',
    });

    await page.goto('/contact/');
    await fillIn(page, person);
    await send(page).click();

    await expect(page).toHaveURL(/\/api\/intake\/$/);
    await expect(page.locator('#email-error')).toBeVisible();
    for (const [label, value] of [
      ['Name', person.name],
      ['Email', person.email],
      ['Phone', person.phone],
      ['About your project', person.message],
    ]) {
      await expect(page.getByLabel(label!)).toHaveValue(value!);
    }
    await expect(page.getByRole('radio', { name: 'Renovation' })).toBeChecked();

    const fixed = { ...person, email: 'dana.rivera@example.test' };
    await page.getByLabel('Email').fill(fixed.email);
    await send(page).click();
    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect.poll(() => workerLog(passingWorker)).toContain(`key ${await keyOf(fixed)}`);
  });

  test('with the spam trap filled is dropped, though the sender sees a thank-you', async ({
    page,
  }) => {
    await offline(page);
    const person = visitor('Cheap pills and fast loans, click the link in my website.');
    const key = await keyOf(person);

    await page.goto('/contact/');
    await fillIn(page, person);
    // Hidden from people; programs fill it in.
    await page.locator('input[name="website"]').fill('https://spam.example.test', { force: true });
    await send(page).click();

    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect
      .poll(() => workerLog(passingWorker))
      .toContain('[intake] dropped: spam trap filled');
    expect(workerLog(passingWorker)).not.toContain(key);
  });
});
