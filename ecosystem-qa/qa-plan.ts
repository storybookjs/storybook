import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename, dirname } from 'pathe';
import { z } from 'zod';

import { loadEntries } from './lib/catalog.ts';
import { renderManualChecklist } from './lib/manual-qa.ts';
import { diffPlans } from './lib/plan-diff.ts';
import {
  checkPlanText,
  draftOfPlan,
  planBatches,
  planFromWindow,
  PlanDraft,
  planHash,
  planRuns,
  readStep,
  renderLedger,
  renderPlan,
  USD_PER_RUN,
} from './lib/qa-plan.ts';
import { Window } from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/qa-plan.ts render --window <file> [--draft <file>] --out <file>
       node ecosystem-qa/qa-plan.ts check <file> [--window <file>]
       node ecosystem-qa/qa-plan.ts draft <file> --window <file> --out <file>
       node ecosystem-qa/qa-plan.ts ledger <file> --window <file> [--out <file>]
       node ecosystem-qa/qa-plan.ts manual <file> --window <file> [--out <file>]
       node ecosystem-qa/qa-plan.ts diff <before> <after> --window <file> [--moved <prs>]

render writes a QA plan from the JSON that window.ts wrote and an optional JSON draft of entries,
discovered repos, decisions, and groups. A PR without a decision gets an empty cell.

draft writes the draft that render turns into the plan again with that window, so a plan can be
changed and rendered again. It exits 1 when the plan is not what render writes from that window.

check accepts a plan only in the form that render writes and when every rule holds against the
catalog, among them that a batch holds probes only or no probe, and then prints its entries,
how many of its entries with more than one PR name the PR behind each step, its batches, runs,
and an estimate of its cost. With --window it also checks that every PR of that window marked qa:needed or without a QA label is in the PRs of an
entry or in one row of manual QA or of no QA, that every PR marked qa:skip is in one group, and
that the plan names no other PR. Without --window it cannot tell a PR that has no place. It exits 1
with the line of each problem.

ledger prints where each PR of the window ended up in the plan, with its status, area, and title,
or writes it to --out.

manual prints the manual checks of a plan that passes check with that window as one Markdown
checklist for an issue or a discussion, in one section for each reason why the sweep does not test
them, with the title of each PR, or writes it to --out. It creates nothing on GitHub.

diff prints what differs between two plans of that window: each PR whose place changed, with where
it was and where it is, the entries removed, added, and changed, with their batch and repos and
whether they are probes, the discovered repos removed and added, and the manual checks and the
reasons for no QA removed and added. --moved is a comma-separated list of the PRs that the change
is meant to move. A PR that moved and that --moved does not name is marked so in its line. diff
exits 1 with a line for each such PR, and for each PR that --moved names and that did not move.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    window: { type: 'string' },
    draft: { type: 'string' },
    out: { type: 'string' },
    moved: { type: 'string' },
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

const readPlan = (file: string) => {
  const { plan, problems } = checkPlanText(readFileSync(file, 'utf8'), { catalog: [] });
  if (!plan) {
    console.error(`${file}:${problems[0]!.line}: ${problems[0]!.message}`);
    process.exit(1);
  }
  return plan;
};

const [command, ...files] = positionals;
const [file, after] = files;
const fileCount = command === 'diff' ? 2 : 1;

if (files.length > fileCount) {
  console.error(
    `${command} takes ${fileCount === 1 ? 'one file' : 'two files'}, and was given ${files.length}.\n\n${HELP}`
  );
  process.exit(1);
} else if (command === 'render' && values.window && values.out && !file) {
  const parsed = PlanDraft.safeParse(values.draft ? readJson(values.draft) : {});
  if (!parsed.success) {
    console.error(`${values.draft} is no draft:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }
  const draft = parsed.data;
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
  const bundles = plan.entries.filter((entry) => entry.prs.length > 1);
  const named = bundles.filter((entry) =>
    entry.steps.every((step) => readStep(step).prs.length > 0)
  );
  console.log(
    `${basename(file)}: plan ${planHash(bytes)} for ${plan.line} at ${plan.version}, ${plural(plan.entries.length, 'entry', 'entries')}, ${plural(batches.length, 'batch', 'batches')}, ${plural(plan.discovered.length, 'discovered repo')}.`
  );
  console.log(
    `Entries with more than one PR whose every step names the PRs it tests: ${named.length} of ${bundles.length}.`
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
      `${file} is not the plan that render writes from ${values.window}. check --window names each row that differs from the window; when it passes, set Entries per run, Version, and the order of the rows back to what render writes.`
    );
    process.exit(1);
  }
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(draft, null, 2)}\n`);
  console.log(`Wrote ${values.out}. Change it, then render the plan again.`);
} else if (command === 'ledger' && file && values.window && !values.draft) {
  const ledger = renderLedger(readPlan(file), readWindow(values.window));
  if (values.out) {
    mkdirSync(dirname(values.out), { recursive: true });
    writeFileSync(values.out, ledger);
    console.log(`Wrote ${values.out}.`);
  } else {
    process.stdout.write(ledger);
  }
} else if (command === 'manual' && file && values.window && !values.draft) {
  const window = readWindow(values.window);
  const { plan, problems } = checkPlanText(readFileSync(file, 'utf8'), {
    catalog: loadEntries(),
    window,
  });
  if (!plan || problems.length) {
    for (const problem of problems) {
      console.error(`${file}:${problem.line}: ${problem.message}`);
    }
    process.exit(1);
  }
  const checklist = renderManualChecklist(plan, window);
  if (values.out) {
    mkdirSync(dirname(values.out), { recursive: true });
    writeFileSync(values.out, checklist);
    console.log(`Wrote ${values.out}.`);
  } else {
    process.stdout.write(checklist);
  }
} else if (
  command === 'diff' &&
  file &&
  after &&
  values.window &&
  !values.draft &&
  !values.out &&
  /^(\d+(,\d+)*)?$/.test(values.moved ?? '')
) {
  const named = values.moved ? values.moved.split(',').map(Number) : [];
  const { lines, unnamed, unmoved } = diffPlans(
    readPlan(file),
    readPlan(after),
    readWindow(values.window),
    named
  );
  console.log(
    lines.length
      ? lines.join('\n')
      : 'No PR moved, and no entry, discovered repo, manual check, or reason for no QA differs.'
  );
  for (const pr of unnamed) {
    console.error(`#${pr} moved, and --moved does not name it.`);
  }
  for (const pr of unmoved) {
    console.error(`#${pr} did not move, and --moved names it.`);
  }
  process.exitCode = unnamed.length || unmoved.length ? 1 : 0;
} else {
  console.error(HELP);
  process.exit(1);
}
