// Repository hygiene check. Fails when a file (or, with --commits, a commit
// message) contains something that must never reach the repository:
//
//   - an email address outside the allowed test and no-reply domains
//   - a phone number anywhere except the public office line in src/lib/site.ts
//   - an authorship or tooling attribution line
//
// Usage:
//   node scripts/check-hygiene.mjs                    checks every file git would track
//   node scripts/check-hygiene.mjs --commits A..B     also checks commit messages in the range
//
// The rules themselves are documented in AGENTS.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const SELF = 'scripts/check-hygiene.mjs';

const SKIPPED_FILES = new Set([SELF, 'package-lock.json']);
const BINARY_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.pdf',
  '.mp4',
  '.webm',
]);

const ALLOWED_EMAIL_DOMAINS = ['example.test', 'example.com', 'users.noreply.github.com'];
const PHONE_ALLOWED_FILES = new Set(['src/lib/site.ts']);

// The last label must be alphabetic, so "package@1.2.3" is not mistaken for an address.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// North American numbers written with separators: 561-555-0100, (561) 555-0100, 561.555.0100
const PHONE = /(?<![\d.])\(?\b\d{3}\)?[-. ]\d{3}[-.]\d{4}\b(?![\d.])/g;
// 555-01xx numbers are reserved for fiction and safe to use in tests and examples.
const FICTIONAL_PHONE = /555[-.]01\d{2}$/;

// Attribution markers are assembled from fragments so this file does not
// contain the phrases it forbids.
const ATTRIBUTION = [
  ['co-authored', '-by'],
  ['generated', ' with ['],
  ['generated', ' with ht'],
  ['cl', 'aude'],
  ['anth', 'ropic'],
  ['chat', 'gpt'],
  ['open', 'ai'],
  ['co', 'pilot'],
].map((parts) => parts.join(''));

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function findProblems(text, { allowPhones = false } = {}) {
  const problems = [];
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const where = index + 1;

    for (const match of line.matchAll(EMAIL)) {
      const domain = match[0].split('@')[1].toLowerCase();
      const allowed = ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
      if (!allowed)
        problems.push({ line: where, message: 'email address outside the allowed domains' });
    }

    if (!allowPhones) {
      for (const match of line.matchAll(PHONE)) {
        if (!FICTIONAL_PHONE.test(match[0])) {
          problems.push({
            line: where,
            message: 'phone number (only src/lib/site.ts may hold one)',
          });
        }
      }
    }

    const lower = line.toLowerCase();
    for (const marker of ATTRIBUTION) {
      if (lower.includes(marker)) {
        problems.push({ line: where, message: 'authorship or tooling attribution' });
      }
    }
  });

  return problems;
}

let failures = 0;
const report = (source, problem) => {
  failures += 1;
  console.error(`${source}:${problem.line}  ${problem.message}`);
};

// Files: everything tracked plus anything new that is not git-ignored.
const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
  .split('\0')
  .filter(Boolean)
  .filter(
    (file) => !SKIPPED_FILES.has(file) && !BINARY_EXTENSIONS.has(extname(file).toLowerCase()),
  );

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree but still in the index
  }
  for (const problem of findProblems(text, { allowPhones: PHONE_ALLOWED_FILES.has(file) })) {
    report(file, problem);
  }
}

// CI runners. Standard GitHub-hosted runners are free on a public repository; larger runners
// are billed even there. Every job must name a standard Ubuntu runner, so a one-line change can
// never start charging the account. An expression is rejected too, since it cannot be checked.
const FREE_RUNNER = /^ubuntu-(?:latest|\d{2}\.\d{2})$/;
for (const file of files.filter((name) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(name))) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((text, index) => {
      const value = text.match(/^\s*runs-on:(.*)$/)?.[1];
      if (value === undefined) return;
      // A list, group or label set on the following lines leaves this line empty.
      const runner = value
        .replace(/#.*$/, '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (!FREE_RUNNER.test(runner)) {
        report(file, {
          line: index + 1,
          message: `runs-on "${runner || '(list or group)'}" is not a free standard runner; use ubuntu-latest`,
        });
      }
    });
}

// Commit messages, when a range is given.
const commitsFlag = process.argv.indexOf('--commits');
if (commitsFlag !== -1) {
  const range = process.argv[commitsFlag + 1];
  if (!range) {
    console.error('--commits needs a range, for example origin/main..HEAD');
    process.exit(2);
  }
  const log = git('log', '--format=%H%x00%B%x01', range);
  for (const entry of log.split('\x01')) {
    const [hash, message] = entry.trim().split('\0');
    if (!hash || message === undefined) continue;
    for (const problem of findProblems(message)) {
      report(`commit ${hash.slice(0, 9)}`, problem);
    }
  }
}

if (failures > 0) {
  console.error(`\nHygiene check failed: ${failures} problem(s). See AGENTS.md for the rules.`);
  process.exit(1);
}
console.log(`Hygiene check passed (${files.length} files).`);
