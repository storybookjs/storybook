import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { loadEntries } from './lib/catalog.ts';
import { checkPlanText } from './lib/qa-plan.ts';
import { planMatrix, sweepMatrix } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/plan.ts --repos <id or class>[,...] --os <linux|windows>[,...] --engines <claude|codex>[,...]
       node ecosystem-qa/plan.ts --plan <file> --batch <n> [--engines <claude|codex>[,...]]

Prints the job matrix of one sweep as one line of JSON: every named catalog repo on every system and
engine. A repo class (owned, tier1, tier2) stands for every catalog entry of that class. A repo runs
on Windows only when the catalog marks it for Windows; a repo named by its id that is left out for
that reason, and a class without entries, are reported on stderr.

With --plan, prints one Linux job for each repo and part of batch <n> of the QA plan, with every
engine of --engines (default: claude), and fails on a plan that qa-plan.ts check rejects.`;

const { values } = parseArgs({
  options: {
    repos: { type: 'string' },
    os: { type: 'string' },
    engines: { type: 'string' },
    plan: { type: 'string' },
    batch: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const planned = () => {
  const { plan: file, batch, repos, os, engines = 'claude' } = values;
  if (repos || os) {
    return fail(
      `--plan takes its repos from the plan and runs on Linux, so it takes no --repos or --os.\n\n${HELP}`
    );
  }
  const batchNumber = Number(batch);
  if (!Number.isInteger(batchNumber) || batchNumber < 1) {
    return fail(`--batch must be a whole number from 1, found "${batch ?? ''}".`);
  }
  const { plan, problems } = checkPlanText(readFileSync(file!, 'utf8'), { catalog: loadEntries() });
  if (!plan || problems.length > 0) {
    const [first] = problems;
    return fail(`${file} is not a plan that can run, line ${first!.line}: ${first!.message}`);
  }
  return planMatrix(plan, batchNumber, engines);
};

const swept = () => {
  const { repos, os, engines, batch } = values;
  if (batch) {
    return fail('--batch needs --plan.');
  }
  if (!repos || !os || !engines) {
    return fail(`Missing one of --repos, --os, --engines.\n\n${HELP}`);
  }
  return sweepMatrix(loadEntries(), { repos, oses: os, engines });
};

const matrix = values.plan ? planned() : swept();
if ('problems' in matrix) {
  fail(matrix.problems.join('\n'));
} else {
  for (const note of 'notes' in matrix ? matrix.notes : []) {
    console.error(process.env.GITHUB_ACTIONS ? `::notice::${note}` : note);
  }
  // Only `include`: Actions reads every other key of a matrix as one more dimension.
  console.log(JSON.stringify({ include: matrix.include }));
}
