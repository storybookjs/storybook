import { parseArgs } from 'node:util';

import { z } from 'zod';

import { loadCatalog } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import { loadResults } from './lib/results.ts';
import { writeStepSummary } from './lib/step-summary.ts';
import { withoutResult } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/missing-runs.ts --results <dir> --version <storybook version> --planned <matrix>

Names every job of a sweep that left no result under --results that can be read.
--planned is the job matrix of the sweep, as plan.ts prints it.
A job whose runner stops answering uploads nothing, so the plan is the only place that still knows
it was meant to run. Exits 0 whatever it finds: the results that are there are still collected.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    planned: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { results, version, planned } = values;
if (!results || !version || !planned) {
  console.error(`Missing one of --results, --version, --planned.\n\n${HELP}`);
  process.exit(1);
}
versionLine(version);

const Planned = z.object({
  include: z.array(z.object({ repo: z.string(), os: z.string(), engine: z.string() })),
});
const { include } = Planned.parse(JSON.parse(planned));
// The collect names every record it cannot read, with the reason.
const loaded = loadResults(results, { version, catalog: loadCatalog(), warn: () => {} });
const missing = withoutResult(
  include,
  loaded.map(({ result }) => ({
    repo: result.request.entry.id,
    os: result.request.os,
    engine: result.request.engine,
  }))
);
for (const run of missing) {
  console.log(
    `${process.env.GITHUB_ACTIONS ? '::warning::' : ''}No result that can be read from ${run}. A lost runner or a cancelled job leaves none at all.`
  );
}
if (missing.length > 0) {
  writeStepSummary(
    ['### Runs without a result', '', ...missing.map((run) => `- ${run}`), ''].join('\n')
  );
}
console.log(`${missing.length} of the ${include.length} planned runs left no result.`);
