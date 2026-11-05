/**
 * What the NX Cloud pipeline (.github/workflows/nx.yml) runs for a CircleCI workflow.
 *
 * CircleCI's generated config (scripts/ci/main.ts) stays the source of truth for which jobs a
 * workflow has. This module maps every one of those jobs to the NX tasks that test the same thing,
 * so the NX pipeline cannot drift from CircleCI: a new CircleCI job without an NX equivalent fails
 * `plan.test.ts`.
 *
 * Like main.ts, this file runs under plain Node before `yarn install`, so it imports only Node
 * built-ins and the CircleCI generator.
 */
import { readFileSync } from 'node:fs';

import {
  allTemplates,
  docgenServerTemplates,
  type TemplateKey,
} from '../../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { getFocusJobs } from '../focus.ts';
import { ensureRequiredJobs, toId } from '../utils/helpers.ts';
import { type JobOrNoOpJob, type Workflow, workflows } from '../utils/types.ts';
import { getJobs } from '../workflow-jobs.ts';

/** Jobs NX runs outside NX Cloud's Linux workers, as their own GitHub Actions jobs in nx.yml. */
export const sideJobs = ['windows', 'windows-init-empty', 'node-26-smoke'] as const;
export type SideJob = (typeof sideJobs)[number];

/** How NX covers one CircleCI job. */
export type Equivalent =
  /** NX tasks, as `project:target`. */
  | { tasks: string[] }
  /** The `check` of every project Nx finds affected by the diff, resolved once Nx is installed. */
  | { affectedCheck: true }
  | { sideJob: SideJob }
  /** Nothing to run: the reason why. */
  | { none: string };

const sandboxTasks = (key: TemplateKey, kind: string): string[] | undefined => {
  const { skipTasks = [] } = allTemplates[key];
  switch (kind) {
    case 'create':
      return [
        `${key}:sandbox`,
        `${key}:build`,
        ...(docgenServerTemplates().includes(key) ? [`${key}:docgen-baselines`] : []),
      ];
    case 'dev':
      // The dev E2E tests in two halves on different workers: in one task they ended most runs.
      return skipTasks.includes('e2e-tests-dev')
        ? [`${key}:smoke-test`]
        : [`${key}:e2e-tests-dev-1`, `${key}:e2e-tests-dev-2`];
    case 'chromatic':
      return [`${key}:chromatic`];
    case 'vitest':
      return [`${key}:vitest-integration`];
    case 'e2e':
      return [`${key}:e2e-tests`];
    default:
      return undefined;
  }
};

/** CircleCI job ids of every template's sandbox jobs, as `defineSandboxFlow` names them. */
const sandboxJobs = new Map(
  (Object.keys(allTemplates) as TemplateKey[]).flatMap((key) =>
    ['create', 'dev', 'chromatic', 'vitest', 'e2e'].map(
      (kind) => [toId(`${allTemplates[key].name} (${kind})`), { key, kind }] as const
    )
  )
);

/** CircleCI runs the Playwright tests of the test Storybooks that have them (test-storybooks.ts). */
const portable = (directory: string) => {
  const project = `portable-stories-kitchen-sink/${directory}`;
  const read = (file: string) =>
    JSON.parse(
      readFileSync(new URL(`../../../test-storybooks/${project}/${file}`, import.meta.url), 'utf8')
    );
  const { scripts } = read('package.json');
  // A long suite is split into parts (`e2e-ui-1`, `e2e-ui-2`, …) that run on separate workers.
  const parts = Object.keys(read('project.json').targets).filter((t) => /^e2e-ui-\d+$/.test(t));
  return [
    `${project}:jest`,
    `${project}:vitest`,
    ...(scripts['playwright-e2e']
      ? (parts.length > 0 ? parts : ['e2e-ui']).map((target) => `${project}:${target}`)
      : []),
    `${project}:cypress`,
  ];
};

const fixedJobs: Record<string, Equivalent> = {
  // `compile` is a dependency of almost every task; publishing fills the local registry. The job
  // also runs `yarn dedupe --check`.
  'build--linux': { tasks: ['*:compile', 'scripts:publish', 'scripts:dedupe-check'] },
  // The internal Storybook's stories are their own Vitest project, `storybook-ui`.
  'tests--linux': { tasks: ['code:test'] },
  'tests-stories--linux': { tasks: ['code:test-stories'] },
  eslint: { tasks: ['code:lint', 'scripts:lint'] },
  'format-check': { tasks: ['code:fmt'] },
  'typescript-validation': { tasks: ['*:check'] },
  'knip-validation': { tasks: ['code:knip'] },
  'local-storybook---chromatic': { tasks: ['code:storybook-ui-chromatic'] },
  // In shards: on one worker the suite took 6.5 minutes, the longest task of the run.
  'internal-storybook-e2e': {
    tasks: [
      'code:e2e-internal-1',
      'code:e2e-internal-2',
      'code:e2e-internal-3',
      'code:e2e-internal-4',
    ],
  },
  'internal-storybook-build-e2e': { tasks: ['code:e2e-internal-static'] },
  'benchmark-packages': { tasks: ['scripts:bench-packages'] },
  'docgen-memory-gate': { tasks: ['docgen-harness:docgen-memory-gate'] },
  'docgen-perf-gate': { tasks: ['docgen-harness:docgen-perf-gate'] },
  'test-storybooks-mcp': { tasks: ['test-storybooks/mcp:vitest'] },
  'init-features': { tasks: ['init-empty/features:init-empty'] },

  // Focused runs check, lint and test only what the diff affects.
  'typescript-validation--affected': { affectedCheck: true },
  'lint-and-format--affected': { tasks: ['code:lint-affected'] },
  'tests--linux--affected': { tasks: ['code:test-affected'] },

  'build--windows': { sideJob: 'windows' },
  'tests-unit--windows': { sideJob: 'windows' },
  'init-empty-windows': { sideJob: 'windows-init-empty' },
  'node-26-smoke': { sideJob: 'node-26-smoke' },

  'common-jobs': { none: 'groups jobs in the CircleCI UI' },
  sandboxes: { none: 'groups jobs in the CircleCI UI' },
  'test-storybooks': { none: 'groups jobs in the CircleCI UI' },
  'init-empty': { none: 'groups jobs in the CircleCI UI' },
  'circleci-completion': {
    none: 'the `nx` commit status, which the `completion` job sets, plays this role',
  },
  // TODO: post a failed nightly run to Slack too; that needs the Slack secrets in GitHub.
  'nightly-failure-report': { none: 'not ported yet: the nightly run only sets the `nx` status' },
};

/**
 * Templates still in development are generated before they are created (`yarn task generate`),
 * which NX does not do yet. They only run in the nightly `daily` workflow.
 */
export const isInDevelopment = (key: TemplateKey) => Boolean(allTemplates[key].inDevelopment);

/** The NX equivalent of a CircleCI job, or `undefined` when there is none yet. */
export function equivalentOf(jobId: string): Equivalent | undefined {
  if (fixedJobs[jobId]) {
    return fixedJobs[jobId];
  }

  const sandbox = sandboxJobs.get(jobId);
  if (sandbox) {
    if (isInDevelopment(sandbox.key)) {
      return { none: `${sandbox.key} is in development and needs \`yarn task generate\` first` };
    }
    const tasks = sandboxTasks(sandbox.key, sandbox.kind);
    return tasks && { tasks };
  }

  const portableMatch = jobId.match(/^test-storybooks-portable-(.+)$/);
  if (portableMatch) {
    return { tasks: portable(portableMatch[1]) };
  }

  const initEmpty = jobId.match(/^init-empty-(.+)$/);
  if (initEmpty) {
    return { tasks: [`init-empty/${initEmpty[1]}:init-empty`] };
  }

  // The Windows sandbox jobs: `<sandbox>--build-windows` and `<sandbox dev job>-windows`.
  if (/(--build-windows|---dev-windows)$/.test(jobId)) {
    return { sideJob: 'windows' };
  }

  return undefined;
}

export type Group = { targets: string[]; projects: string[] };

export type Plan = {
  /** The CircleCI jobs this plan covers, by id. */
  jobs: string[];
  /** NX tasks, as `project:target`; `*` stands for every project with the target. */
  tasks: string[];
  affectedCheck: boolean;
  sideJobs: SideJob[];
  /** CircleCI jobs without an NX equivalent. */
  missing: string[];
};

/**
 * The CircleCI jobs of the given workflows, as main.ts selects them, including the jobs they
 * require.
 */
export function circleJobs(selected: readonly Workflow[], changedFiles: readonly string[]) {
  const jobs: JobOrNoOpJob[] = selected.flatMap((workflow) =>
    workflow === 'focus' ? getFocusJobs(changedFiles) : getJobs(workflow, 'unused')
  );
  return [...new Set(ensureRequiredJobs(jobs).map((job) => job.id))].sort();
}

export function planFor(selected: readonly Workflow[], changedFiles: readonly string[] = []): Plan {
  const jobs = circleJobs(selected, changedFiles);
  const tasks = new Set<string>();
  const side = new Set<SideJob>();
  const missing: string[] = [];
  let affectedCheck = false;

  for (const id of jobs) {
    const equivalent = equivalentOf(id);
    if (!equivalent) {
      missing.push(id);
    } else if ('tasks' in equivalent) {
      equivalent.tasks.forEach((task) => tasks.add(task));
    } else if ('affectedCheck' in equivalent) {
      affectedCheck = true;
    } else if ('sideJob' in equivalent) {
      side.add(equivalent.sideJob);
    }
  }

  return {
    jobs,
    tasks: [...tasks].sort(),
    affectedCheck,
    sideJobs: sideJobs.filter((job) => side.has(job)),
    missing,
  };
}

/**
 * Split the wanted tasks into `nx run-many` commands that each run exactly what they are asked for.
 *
 * `nx run-many -t <targets> -p <projects>` runs every target on every project that has it, so one
 * command can run more than the plan asks for, for example the dev E2E tests of a sandbox that a
 * focused run only sends to Chromatic. Projects that one shared command would over-run get a
 * command of their own per set of targets.
 *
 * @param wanted - The targets to run, by project. Each must be one of the project's targets.
 * @param targetsOf - Every target a project has.
 */
export function groupTasks(
  wanted: ReadonlyMap<string, ReadonlySet<string>>,
  targetsOf: (project: string) => ReadonlySet<string>
): Group[] {
  const allTargets = new Set([...wanted.values()].flatMap((targets) => [...targets]));
  const runsExactly = (project: string, targets: ReadonlySet<string>) =>
    [...targetsOf(project)].filter((target) => targets.has(target)).length ===
    wanted.get(project)!.size;

  const shared: string[] = [];
  const bySignature = new Map<string, string[]>();
  for (const project of [...wanted.keys()].sort()) {
    if (runsExactly(project, allTargets)) {
      shared.push(project);
    } else {
      const signature = [...wanted.get(project)!].sort().join(',');
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), project]);
    }
  }

  const groups: Group[] = [];
  if (shared.length > 0) {
    groups.push({
      targets: [...new Set(shared.flatMap((project) => [...wanted.get(project)!]))].sort(),
      projects: shared,
    });
  }
  for (const [signature, projects] of bySignature) {
    groups.push({ targets: signature.split(','), projects });
  }
  return groups;
}

/** Parse `--workflow=a,b` the way main.ts does. */
export function parseWorkflows(value: string): Workflow[] {
  const requested = value.split(',').filter(Boolean);
  const unknown = requested.filter((w) => !(workflows as readonly string[]).includes(w));
  if (unknown.length > 0 || requested.length === 0) {
    throw new Error(
      `Unknown workflow "${value}". Expected a comma-separated list of: ${workflows.join(', ')}`
    );
  }
  return workflows.filter((w) => requested.includes(w));
}
