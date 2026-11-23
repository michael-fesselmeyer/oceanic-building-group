// Tells the owner whether the site is ready to go live: one PASS or FAIL line
// per launch gate in docs/roadmap.md, with what to do next, and a non-zero
// exit code if any gate fails.
//
// Usage: npm run launch-check
//
// The Lighthouse gate reads the latest CI run on main through the GitHub CLI
// (`gh`), so it needs `gh` installed and signed in. The checks themselves are
// in scripts/launch-gates.mjs.
import { formatReport, gatherInputs, runGates } from './launch-gates.mjs';

const results = runGates(gatherInputs(process.cwd()));
console.log(formatReport(results));
process.exitCode = results.every((result) => result.ok) ? 0 : 1;
