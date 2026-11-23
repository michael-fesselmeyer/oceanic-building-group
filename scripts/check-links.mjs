// Fails when a built page links to a page, file or #fragment that is not in the
// build. External links are listed, never fetched.
//
// Usage: npm run check:links [-- <build folder>]   (default: dist/client)
//
// Run it after `npm run build`, and again after a launched build
// (PUBLIC_SITE_LAUNCHED=true), where drafts are not built and so no page may
// link to one. The checks are in scripts/link-check.mjs.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkLinks, formatReport, readBuild } from './link-check.mjs';

const dir = resolve(process.argv[2] ?? 'dist/client');
if (!existsSync(dir)) {
  console.error(`No build found at ${dir}. Run "npm run build" first.`);
  process.exit(1);
}

const report = checkLinks(readBuild(dir));
console.log(formatReport(report));
process.exitCode = report.broken.length === 0 ? 0 : 1;
