import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename, dirname } from 'pathe';

import { loadEntries } from './lib/catalog.ts';
import {
  checkPlanText,
  draftOfPlan,
  planBatches,
  planFromWindow,
  PlanDraft,
  planHash,
  planRuns,
  renderPlan,
  USD_PER_RUN,
} from './lib/qa-plan.ts';
import { Window } from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/qa-plan.ts render --window <file> [--draft <file>] --out <file>
       node ecosystem-qa/qa-plan.ts check <file> [--window <file>]
       node ecosystem-qa/qa-plan.ts draft <file> --window <file> --out <file>

render writes a QA plan from the JSON that window.ts wrote and an optional JSON draft of entries,
discovered repos, decisions, and groups. A PR without a decision gets an empty cell.

draft writes the draft that render turns into the plan again with that window, so a plan can be
changed and rendered again. It exits 1 when the plan is not what render writes from that window.

check accepts a plan only in the form that render writes and when every rule holds against the
catalog, and then prints its entries, batches, runs, and an estimate of its cost. With --window it
also checks that the tables hold exactly the PRs of that window. It exits 1 with the line of each
problem.`;

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

const [command, file, ...extra] = positionals;

if (extra.length) {
  console.error(`${command} takes one file, and was given ${extra.length + 1}.\n\n${HELP}`);
  process.exit(1);
} else if (command === 'render' && values.window && values.out && !file) {
  const draft = PlanDraft.parse(values.draft ? readJson(values.draft) : {});
  let text: string;
  try {
    text = renderPlan(planFromWindow(readWindow(values.window), draft));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, text);
  console.log(`Wrote ${values.out}. Run check on it before you open the plan PR.`);
} else if (command === 'check' && file && !values.draft && !values.out) {
  const bytes = readFileSync(file);
  const { plan, problems } = checkPlanText(bytes.toString('utf8'), {
    catalog: loadEntries(),
    window: values.window ? readWindow(values.window) : undefined,
  });
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
    `${basename(file)}: plan ${planHash(bytes)} for ${plan.line} at ${plan.version}, ${plural(plan.entries.length, 'entry', 'entries')}, ${plural(batches.length, 'batch', 'batches')}, ${plural(plan.discovered.length, 'discovered repo')}.`
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
    `About ${(total * USD_PER_RUN).toFixed(2)} dollars: ${plural(total, 'run')} at ${USD_PER_RUN} dollars, what the most expensive static run so far cost.`
  );
} else if (command === 'draft' && file && values.window && values.out && !values.draft) {
  const text = readFileSync(file, 'utf8');
  const { plan, problems } = checkPlanText(text, { catalog: [] });
  if (!plan) {
    console.error(`${file}:${problems[0]!.line}: ${problems[0]!.message}`);
    process.exit(1);
  }
  const draft = draftOfPlan(plan);
  const window = readWindow(values.window);
  let again: string | undefined;
  try {
    again = renderPlan(planFromWindow(window, draft));
  } catch {
    again = undefined;
  }
  if (again !== text) {
    console.error(
      `${file} is not the plan that render writes from ${values.window}. Run check with --window on it.`
    );
    process.exit(1);
  }
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(draft, null, 2)}\n`);
  console.log(`Wrote ${values.out}. Change it, then render the plan again.`);
} else {
  console.error(HELP);
  process.exit(1);
}
