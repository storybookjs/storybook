import { parseArgs } from 'node:util';

import { z } from 'zod';

import { loadEntries } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import { readPlanScope } from './lib/plan-scope.ts';
import { loadResults } from './lib/results.ts';
import { writeStepSummary } from './lib/step-summary.ts';
import { withoutResult } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/missing-runs.ts --results <dir> --version <storybook version> --planned <matrix> [--plan <file> --batch <n> [--tier <tier>]]

Names every job of a sweep that left no result under --results that can be read.
--planned is the job matrix of the sweep, as plan.ts prints it. A job of a plan run names its part.
A job whose runner stops answering uploads nothing, so the plan is the only place that still knows
it was meant to run. Exits 0 whatever it finds: the results that are there are still collected.
--plan, --batch and --tier count only the results of that batch of the plan, as collect.ts loads
them.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    planned: { type: 'string' },
    plan: { type: 'string' },
    batch: { type: 'string' },
    tier: { type: 'string' },
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
const scope = readPlanScope(values);

const Planned = z.object({
  include: z.array(
    z.object({
      repo: z.string(),
      part: z.int().min(1).optional(),
      os: z.string(),
      engine: z.string(),
    })
  ),
});
const { include } = Planned.parse(JSON.parse(planned));
// The collect names every record it cannot read, with the reason.
const loaded = loadResults(results, {
  version,
  catalog: loadEntries(scope?.plan),
  ...(scope ? { plan: scope } : {}),
  warn: () => {},
});
const missing = withoutResult(
  include,
  loaded.map(({ result }) => ({
    repo: result.request.entry.id,
    part: result.request.plan?.part,
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
