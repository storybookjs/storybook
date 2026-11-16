import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { loadEntries } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import { planOfPush } from './lib/plan-push.ts';
import { readPlanScope } from './lib/plan-scope.ts';
import { planBatches, planHash } from './lib/qa-plan.ts';
import { planMatrix, sweepMatrix } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/plan.ts --repos <id or class>[,...] --os <linux|windows>[,...] --engines <claude|codex>[,...]
       node ecosystem-qa/plan.ts --plan <file> --batch <n> [--engines <claude|codex>[,...]] [--outputs [--hash <hash>] [--version <version>]]
       node ecosystem-qa/plan.ts --push < name-status

Prints the job matrix of one sweep as one line of JSON: every named catalog repo on every system and
engine. A repo class (owned, tier1, tier2) stands for every catalog entry of that class. A repo runs
on Windows only when the catalog marks it for Windows; a repo named by its id that is left out for
that reason, and a class without entries, are reported on stderr.

With --plan, prints one Linux job for each repo and part of batch <n> of the QA plan, with every
engine of --engines (default: claude), and fails on a plan that qa-plan.ts check rejects.
--outputs prints the lines the plan job writes to GITHUB_OUTPUT instead: the matrix, the plan, its
hash, the batch, the number of batches, and the version, which is --version or the plan's own. It
fails when --version is not on the plan's line. When --hash is not the hash of the plan, it says why
on stderr and prints an empty matrix, the plan, --hash, the batch, and ended=<the plan's hash now,
or gone>.

With --push, reads the --name-status diff over ecosystem-qa/plans/ of the commits of a push, and
prints the plan file that the push runs. It prints nothing and says why on stderr when the push runs
no plan, and fails when the push adds or changes more than one.`;

const { values } = parseArgs({
  options: {
    repos: { type: 'string' },
    os: { type: 'string' },
    engines: { type: 'string' },
    plan: { type: 'string' },
    batch: { type: 'string' },
    outputs: { type: 'boolean', default: false },
    hash: { type: 'string' },
    version: { type: 'string' },
    push: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const fail = (message: string): never => {
  console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : message);
  process.exit(1);
};

const notice = (message: string) =>
  console.error(process.env.GITHUB_ACTIONS ? `::notice::${message}` : message);

const pushed = () => {
  const push = planOfPush(readFileSync(0, 'utf8'));
  if (push.kind === 'run') {
    console.log(push.file);
  } else if (push.kind === 'skip') {
    notice(push.reason);
  } else {
    fail(push.reason);
  }
};

const planned = () => {
  const { repos, os, engines = 'claude' } = values;
  if (repos || os) {
    return fail(
      `--plan takes its repos from the plan and runs on Linux, so it takes no --repos or --os.\n\n${HELP}`
    );
  }
  const scope = readPlanScope(values)!;
  return { scope, matrix: planMatrix(scope.plan, scope.batch, engines) };
};

const changedPlan = (): string[] | undefined => {
  const { plan, hash, batch = '' } = values;
  if (hash === undefined || !plan) {
    return undefined;
  }
  const now = existsSync(plan) ? planHash(readFileSync(plan, 'utf8')) : undefined;
  if (now === hash) {
    return undefined;
  }
  const state = now ? `has the hash ${now}` : 'does not exist';
  notice(
    `${plan} ${state} at this commit and its chain started from the hash ${hash}, so this batch of the plan as it was is not run.`
  );
  return [
    'matrix={"include":[]}',
    `plan=${plan}`,
    `plan_hash=${hash}`,
    `batch=${/^[1-9]\d*$/.test(batch) ? batch : fail(`--batch must be a whole number from 1, found "${batch}".`)}`,
    `ended=${now ?? 'gone'}`,
  ];
};

const outputsOf = ({ scope, matrix }: ReturnType<typeof planned>): string[] => {
  const { version } = values;
  if ('problems' in matrix) {
    return fail(matrix.problems.join('\n'));
  }
  if (version !== undefined && versionLine(version) !== scope.plan.line) {
    return fail(
      `${values.plan} plans line ${scope.plan.line}, and the version ${version} is not on it.`
    );
  }
  return [
    `matrix=${JSON.stringify({ include: matrix.include })}`,
    `plan=${values.plan}`,
    `plan_hash=${scope.hash}`,
    `batch=${scope.batch}`,
    `batches=${planBatches(scope.plan).length}`,
    `version=${version ?? scope.plan.version}`,
  ];
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

if (values.push) {
  pushed();
} else if (values.plan && values.outputs) {
  console.log((changedPlan() ?? outputsOf(planned())).join('\n'));
} else {
  const matrix = values.plan ? planned().matrix : swept();
  if ('problems' in matrix) {
    fail(matrix.problems.join('\n'));
  } else {
    for (const note of 'notes' in matrix ? matrix.notes : []) {
      notice(note);
    }
    // Only `include`: Actions reads every other key of a matrix as one more dimension.
    console.log(JSON.stringify({ include: matrix.include }));
  }
}
