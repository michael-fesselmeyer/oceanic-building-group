// Repository hygiene check. Fails when a file (or, with --commits, a commit
// message) contains something that must never reach the repository:
//
//   - an email address outside the allowed test and no-reply domains
//   - a phone number anywhere except the public office line in src/lib/site.ts
//   - an authorship or tooling attribution line
//
// It also fails on a CI job that does not run on a free standard runner, and on a raw color,
// length, font or weight in a style outside src/styles/tokens.css (see "Styles" below).
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

// Styles. Every color, length, font and weight in a component, layout, page or shared style
// sheet comes from a token in src/styles/tokens.css, so a re-skin edits that one file. Checked:
// <style> blocks of .astro files under src/, and .css files under src/ other than tokens.css.
// Only declaration values are read; selectors and at-rule conditions (@media lengths cannot be
// custom properties) are skipped, and so are comments and quoted strings.
//
// Raw values that are allowed, because they are structure rather than look:
const STYLE_ALLOWED_LENGTHS = new Set([
  '1px', // hairline borders, outlines, underlines
  '2px', // the heavier hairline: current-page markers, focus rings
  '100vh', // a full screen
  '100svh',
  '100dvh',
  '100vw',
]);
// ...plus zero in any unit, any `ch` measure (line length in characters of the text's own size),
// percentages, `fr`, unitless numbers (line heights, flex factors), and durations (not checked).
const TOKENS_FILE = 'src/styles/tokens.css';
const STYLE_LENGTH =
  /(?<![\w.#-])-?(\d*\.?\d+)(px|r?em|ex|ch|cap|lh|rlh|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max)|pt|pc|cm|mm|in|q)(?![\w-])/gi;
const STYLE_COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const STYLE_HEX = /#[0-9a-f]{3,8}(?![\w-])/gi;
// The CSS named colors; transparent and currentColor are fine.
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
const STYLE_WORD = /(?<![\w-])[a-z]+(?![\w(-])/gi;
const FONT_WEIGHT_KEYWORDS = /^(?:inherit|initial|unset|revert)$/;

// Blank out comments and quoted strings, keeping every newline so line numbers still match.
function maskCss(css) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return css
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, (s) => s[0] + blank(s.slice(1, -1)) + s[0]);
}

// Problems in one stretch of CSS. `firstLine` is the file line the stretch starts on.
function findStyleProblems(css, firstLine) {
  const problems = [];
  const text = maskCss(css);
  const lineAt = (offset) => firstLine + (text.slice(0, offset).match(/\n/g)?.length ?? 0);

  // Each piece between { } ; is either a prelude (followed by "{") or a declaration.
  const pieces = /[^{};]+/g;
  for (const piece of text.matchAll(pieces)) {
    const end = piece.index + piece[0].length;
    if (text[end] === '{') continue; // selector or at-rule prelude
    const declaration = piece[0].match(/^(\s*)(--[\w-]+|[a-z-]+)\s*:([\s\S]*)$/i);
    if (!declaration) continue;
    const property = declaration[2].toLowerCase();
    const valueStart = piece.index + piece[0].length - declaration[3].length;
    const value = declaration[3];
    const add = (offset, message) => problems.push({ line: lineAt(valueStart + offset), message });

    for (const match of value.matchAll(STYLE_LENGTH)) {
      const [raw, number, unit] = match;
      const length = raw.replace(/^-/, '').toLowerCase();
      if (Number(number) === 0 || unit.toLowerCase() === 'ch' || STYLE_ALLOWED_LENGTHS.has(length))
        continue;
      add(match.index, `raw length ${raw} in ${property}; use a token from ${TOKENS_FILE}`);
    }
    for (const match of [...value.matchAll(STYLE_HEX), ...value.matchAll(STYLE_COLOR_FUNCTION)]) {
      add(match.index, `raw color ${match[0]} in ${property}; use a token from ${TOKENS_FILE}`);
    }
    // Custom property names (var(--color-white)) contain color words; drop them first.
    const words = value.replace(/--[\w-]+/g, (s) => ' '.repeat(s.length));
    for (const match of words.matchAll(STYLE_WORD)) {
      if (NAMED_COLORS.has(match[0].toLowerCase())) {
        add(match.index, `named color ${match[0]} in ${property}; use a token from ${TOKENS_FILE}`);
      }
    }
    const bare = value.replace(/var\([^)]*\)/g, '').trim();
    if ((property === 'font-family' || property === 'font') && bare && bare !== 'inherit') {
      add(0, `${property} must come from a --font-* token`);
    }
    if (property === 'font-weight' && bare && !FONT_WEIGHT_KEYWORDS.test(bare)) {
      add(0, `font-weight ${bare} must come from a --weight-* token`);
    }
  }
  return problems;
}

for (const file of files.filter((name) => /^src\/.+\.(astro|css)$/.test(name))) {
  if (file === TOKENS_FILE) continue;
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const blocks = file.endsWith('.css')
    ? [{ css: source, offset: 0 }]
    : [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => ({
        css: m[1],
        offset: m.index + m[0].indexOf('>') + 1,
      }));
  for (const { css, offset } of blocks) {
    const firstLine = 1 + (source.slice(0, offset).match(/\n/g)?.length ?? 0);
    for (const problem of findStyleProblems(css, firstLine)) report(file, problem);
  }
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
