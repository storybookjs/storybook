import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename } from 'pathe';

import {
  checkPlanText,
  planBatches,
  planFromWindow,
  PlanDraft,
  planHash,
  planRuns,
  renderPlan,
} from './lib/qa-plan.ts';
import { Window } from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/qa-plan.ts render --window <file> [--draft <file>] --out <file>
       node ecosystem-qa/qa-plan.ts check <file> [--window <file>]

render writes a QA plan from the JSON that window.ts wrote and an optional JSON draft of entries,
discovered repos, decisions, and groups. A PR without a decision gets an empty cell.

check accepts a plan only in the form that render writes and when every rule holds, and then prints
its entries, batches, runs, and an upper estimate of its cost. With --window it also checks that the
tables hold exactly the PRs of that window. It exits 1 with the line of each problem.`;

// The most expensive of 32 static runs on Haiku at low effort cost 2.59 dollars.
const USD_PER_RUN_UPPER = 2.59;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    window: { type: 'string' },
    draft: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const readWindow = (file: string) => Window.parse(readJson(file));
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const [command, file] = positionals;

if (command === 'render' && values.window && values.out && !file) {
  const draft = PlanDraft.parse(values.draft ? readJson(values.draft) : {});
  let text: string;
  try {
    text = renderPlan(planFromWindow(readWindow(values.window), draft));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  writeFileSync(values.out, text);
  console.log(`Wrote ${values.out}. Run check on it before you open the plan PR.`);
} else if (command === 'check' && file && !values.draft && !values.out) {
  const text = readFileSync(file, 'utf8');
  const { plan, problems } = checkPlanText(
    text,
    values.window ? { window: readWindow(values.window) } : {}
  );
  if (!plan || problems.length) {
    for (const problem of problems) {
      console.error(`${file}:${problem.line}: ${problem.message}`);
    }
    console.error(`${plural(problems.length, 'problem')}.`);
    process.exit(1);
  }
  const batches = planBatches(plan);
  const runs = batches.map((batch) => planRuns(plan, batch));
  const total = runs.flat().length;
  console.log(
    `${basename(file)}: plan ${planHash(text)} for ${plan.line} at ${plan.version}, ${plural(plan.entries.length, 'entry', 'entries')}, ${plural(batches.length, 'batch', 'batches')}, ${plural(plan.discovered.length, 'discovered repo')}.`
  );
  for (const [index, batch] of batches.entries()) {
    const batchRuns = runs[index]!;
    const parts = [...new Set(batchRuns.map((run) => run.repo))].map(
      (repo) => `${repo} ${plural(batchRuns.filter((run) => run.repo === repo).length, 'part')}`
    );
    const entries = plan.entries.filter((entry) => entry.batch === batch).length;
    console.log(
      `Batch ${batch}: ${plural(entries, 'entry', 'entries')} in ${plural(batchRuns.length, 'run')} (${parts.join(', ')}).`
    );
  }
  console.log(
    `At most ${(total * USD_PER_RUN_UPPER).toFixed(2)} dollars: ${plural(total, 'run')} at ${USD_PER_RUN_UPPER} dollars, the most expensive static run so far.`
  );
} else {
  console.error(HELP);
  process.exit(1);
}
