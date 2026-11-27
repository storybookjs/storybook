import { parseArgs } from 'node:util';

import { loadCatalog } from './lib/catalog.ts';
import { sweepMatrix } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/plan.ts --repos <id or class>[,...] --os <linux|windows>[,...] --engines <claude|codex>[,...]

Prints the job matrix of one sweep as one line of JSON: every named catalog repo on every system and
engine. A repo class (owned, tier1, tier2) stands for every catalog entry of that class. A repo runs
on Windows only when the catalog marks it for Windows; a repo named by its id that is left out for
that reason, and a class without entries, are reported on stderr.`;

const { values } = parseArgs({
  options: {
    repos: { type: 'string' },
    os: { type: 'string' },
    engines: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { repos, os, engines } = values;
if (!repos || !os || !engines) {
  console.error(`Missing one of --repos, --os, --engines.\n\n${HELP}`);
  process.exit(1);
}

const matrix = sweepMatrix(loadCatalog(), { repos, oses: os, engines });
if ('problems' in matrix) {
  console.error(matrix.problems.join('\n'));
  process.exit(1);
}
for (const note of matrix.notes) {
  console.error(process.env.GITHUB_ACTIONS ? `::notice::${note}` : note);
}
// Only `include`: Actions reads every other key of a matrix as one more dimension.
console.log(JSON.stringify({ include: matrix.include }));
