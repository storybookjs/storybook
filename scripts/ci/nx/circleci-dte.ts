// The CircleCI jobs of the NX DTE pipeline: Nx distributes the tasks that cover a CircleCI workflow
// (plan.ts) over CircleCI machines, with NX Cloud's manual distributed task execution. NX Cloud
// schedules the tasks and holds the remote cache; CircleCI provides the machines.
//
// - `nx-main` starts the NX Cloud run (`start-ci-run --distribute-on=manual`), then runs one Nx
//   command (run.ts): on a pull request `nx affected`, which runs only the tasks the change reaches,
//   otherwise `nx run-many`. It runs no task itself.
// - `nx-agent` runs as parallel containers, each `nx start-agent`, which runs the tasks NX Cloud
//   assigns.
// - The Windows tests (plan.ts `WINDOWS_TASKS`) run the same way in a second run of the same NX
//   Cloud pipeline: `nx-main-windows` and `nx-agent-windows`, with `NX_CI_EXECUTION_ENV=windows`,
//   so NX Cloud shows them in a tab of their own. The same targets as on Linux; their cache entries
//   are kept apart by the OS input in nx.json.
// - The Node 26 smoke job stays a plain CircleCI job, as CircleCI defines it.
//
// CircleCI's setup job asks Nx which tasks the run will run, which of them NX Cloud already has in
// its cache, and how long the rest take (select.ts). Each agent job gets the fewest agents that
// run that work about as fast as any number could (agent-sizing.ts).
//
// Opt in with the `nxDte` pipeline parameter (.circleci/config.yml); main.ts then generates these
// jobs instead of the per-job ones. Like main.ts, this runs under plain Node before `yarn install`.
import { installWithCache, node26Smoke } from '../common-jobs.ts';
import { getChangedFiles } from '../focus.ts';
import { cache, git, node, testResults } from '../utils/helpers.ts';
import { isTrustedAuthor } from '../utils/runtime.ts';
import { type JobOrNoOpJob, type Workflow, defineJob } from '../utils/types.ts';
import { linuxRuns, planFor, windowsTasksOf } from './plan.ts';
import { agentsFor } from './agent-sizing.ts';
import { type Selection, workOf } from './selection.ts';

// Linux agents are `large` containers (4 vCPUs; a task costs more on `xlarge`, which bills twice
// the credits per minute and ran the dev-server E2E tests only a quarter faster). A Windows `large`
// agent costs 120 credits a minute and boots in about four minutes, which also bounds how many pay
// off.
export const MAX_AGENTS = { linux: 44, windows: 4 } as const;
// From the job's start until `nx start-agent` takes a task: checkout, node_modules, Chromium.
export const AGENT_BOOT_SECONDS = { linux: 60, windows: 240 } as const;

export type NxDteOptions = {
  // At most this many Linux agents (the `nxDteMaxAgents` pipeline parameter).
  maxAgents?: number;
  // The commit a pull request branched from: the run then runs only the tasks a change since it
  // reaches (`nx affected`). Without it, every task of the plan runs.
  base?: string;
  // The tasks the run will run, from CircleCI's setup job (select.ts). Without them (locally and in
  // tests), every agent job starts at its maximum.
  selection?: { linux: Selection; windows: Selection };
};

// The agents a selection needs (agent-sizing.ts).
export const agentsForSelection = (
  selection: Selection,
  os: Os,
  max: number = MAX_AGENTS[os]
): number => agentsFor(workOf(selection), { max, bootSeconds: AGENT_BOOT_SECONDS[os] }).agents;

// dte-task-statuses.ts reads the failed tasks from this step of these jobs.
export const NX_MAIN_JOBS = { linux: 'nx-main', windows: 'nx-main-windows' } as const;
export const RUN_NX_STEP = 'Run nx';

// The agents' jobs, which `circleci-completion` does not wait for (main.ts).
export const NX_AGENT_JOB_IDS: readonly string[] = ['nx-agent', 'nx-agent-windows'];

// Pinned as in nx.yml. Only for `start-ci-run`, which runs before the install. The commands after
// it go through the workspace's own Nx: the NX Cloud client that `npx nx-cloud` loads resolves Nx
// next to itself, outside the workspace, and the agents failed with "Cannot find module".
const NX_CLOUD = 'npx --yes nx-cloud@19.1.5';

export const NODE_MODULES_ARCHIVE = '/tmp/nx-dte-node_modules.tar.zst';
export const MANIFESTS_SUM = '/tmp/nx-dte-manifests.sha256';
// Hashes the workspaces' manifests into MANIFESTS_SUM, for the key below.
export const HASH_MANIFESTS_COMMAND = `cat package.json */package.json code/*/package.json code/*/*/package.json | sha256sum > ${MANIFESTS_SUM}`;
// Everything that decides the installed tree, as CircleCI's own node_modules key (helpers.ts).
// The setup job (.circleci/config.yml) restores the same key; circleci-dte.test.ts keeps them equal.
export const NODE_MODULES_KEY = [
  'v1-nx-dte-node_modules',
  '{{ arch }}',
  '{{ checksum ".nvmrc" }}',
  '{{ checksum ".yarnrc.yml" }}',
  '{{ checksum "yarn.lock" }}',
  '{{ checksum ".nx/workflows/prune-other-platforms.cjs" }}',
  '{{ checksum "scripts/ci/nx/circleci-node-modules.sh" }}',
  // The workspaces' manifests, as NX Cloud's key does (.nx/workflows/agents.yaml): a change such
  // as `installConfig` alters the installed tree without touching yarn.lock.
  `{{ checksum "${MANIFESTS_SUM}" }}`,
].join('/');

const restoreNodeModules = () => [
  { run: { name: 'Hash the package manifests', command: HASH_MANIFESTS_COMMAND } },
  cache.attach([NODE_MODULES_KEY]),
  {
    run: {
      name: 'Restore node_modules',
      command: `bash scripts/ci/nx/circleci-node-modules.sh restore ${NODE_MODULES_ARCHIVE}`,
    },
  },
];

// `nx-main` stores a fresh tree at its end, and only for a trusted author, as CircleCI's other jobs
// do (common-jobs.ts `installWithCache`), so a fork PR cannot hand its tree to the next run. The
// setup job stores it first when it installed (.circleci/config.yml); then this finds the tree
// came from the cache and packs nothing. At the end, because packing takes about a minute and
// nothing in the main job waits for it.
const saveNodeModules = () =>
  isTrustedAuthor()
    ? [
        {
          run: {
            name: 'Pack node_modules',
            // Also when a task failed: the tree is the same either way.
            when: 'always',
            command: `bash scripts/ci/nx/circleci-node-modules.sh pack ${NODE_MODULES_ARCHIVE}`,
          },
        },
        {
          save_cache: {
            ...cache.persist([NODE_MODULES_ARCHIVE], NODE_MODULES_KEY).save_cache,
            when: 'always',
          },
        },
      ]
    : [];

type Os = 'linux' | 'windows';

// The environment every job of one OS shares.
const nxEnvironment = (os: Os, changedFiles: readonly string[]) => ({
  // Reports under the pull request, as nx.yml does: API-triggered pipelines carry no PR number.
  NX_BRANCH: '<< pipeline.parameters.ghPrNumber >>',
  // The Linux and the Windows tasks run as two runs of one NX Cloud pipeline, each with its own
  // agents, which NX Cloud shows side by side.
  NX_CI_EXECUTION_ENV: os,
  // Report each finished task right away instead of in batches, so the tasks that depend on it
  // start sooner (nx.yml).
  NX_CLOUD_DISABLE_BUFFER_TASK_COMPLETIONS: 'true',
  // Selection from the repository's inputs only, as the setup job (without NX Cloud) makes it.
  NX_CLOUD_USE_ULTRACACHE: 'false',
  // affected.ts reads the focused diff on the agents; the count tells a mangled list from an empty one.
  CI_CHANGED_FILES: changedFiles.join('\n'),
  CI_CHANGED_FILES_COUNT: `${changedFiles.length}`,
});

// The environment of the agents of both OSes: as on the NX Cloud workers (.nx/workflows/agents.yaml).
const agentEnvironment = {
  STORYBOOK_DISABLE_TELEMETRY: 'true',
  IN_STORYBOOK_SANDBOX: 'true',
  // bench-packages.ts uploads the benchmarks for this pull request.
  BENCH_BASE_BRANCH: '<< pipeline.parameters.ghBaseBranch >>',
  BENCH_PR_NUMBER: '<< pipeline.parameters.ghPrNumber >>',
};

const ASSIGNMENT_RULES: Record<Os, string> = {
  linux: '.nx/workflows/circleci-assignment-rules.yaml',
  windows: '.nx/workflows/circleci-windows-assignment-rules.yaml',
};
// The agent each OS's assignment rules name.
export const LAUNCH_TEMPLATES: Record<Os, string> = {
  linux: 'circleci-linux',
  windows: 'circleci-windows',
};

// The targets of a run's command (run.ts `--targets`). `start-ci-run --stop-workers-after` must
// name exactly these: with only the targets a change reaches, NX Cloud stopped no agent before the
// run ended, and a core run cost a third more.
const commandTargets = (tasks: readonly string[]) =>
  [...new Set(tasks.map((task) => task.slice(task.lastIndexOf(':') + 1)))].sort();

const startCiRun = (os: Os, targets: readonly string[], npx: string) => ({
  run: {
    name: 'Start the NX Cloud run',
    // Before the install, so NX Cloud knows the run while the agents boot. A failed task does not
    // stop the agents: the run reports every failure, as CircleCI does. `start-ci-run` refuses to start while .nx/ci-config.yaml (the NX Cloud workers' config,
    // which only `start-workers` reads) exists, so it is out of the way for this command only.
    command: [
      'mv .nx/ci-config.yaml /tmp/ci-config.yaml',
      [
        `${npx} start-ci-run --distribute-on=manual`,
        `--assignment-rules=${ASSIGNMENT_RULES[os]}`,
        `--stop-workers-after=${targets.join(',')}`,
        '--stop-workers-on-failure=false',
      ].join(' \\\n  '),
      'mv /tmp/ci-config.yaml .nx/ci-config.yaml',
    ].join('\n'),
  },
});

// The commit `nx affected` diffs against, which a shallow checkout lacks.
const fetchBase = (base: string | undefined) =>
  base
    ? [
        {
          run: {
            name: 'Fetch the commit the pull request branched from',
            command: `git fetch --depth=1 --no-tags origin ${base}`,
          },
        },
      ]
    : [];

const runNx = (os: Os, selected: readonly Workflow[], base: string | undefined) => ({
  run: {
    name: RUN_NX_STEP,
    // The project's environment turns it on; it buries the summary under thousands of lines.
    environment: { NX_VERBOSE_LOGGING: 'false' },
    no_output_timeout: '30m',
    command: [
      // Bounded, as the agents are: on NX Cloud's own Windows agents a run once never ended and held
      // its machines for six hours. Git Bash's `timeout` on Windows.
      `/usr/bin/timeout --kill-after=1m ${os === 'windows' ? 75 : 45}m`,
      'yarn exec jiti ./scripts/ci/nx/run.ts',
      `--workflow=${selected.join(',')}`,
      `--env=${os}`,
      ...(base ? [`--base=${base}`] : []),
    ].join(' '),
  },
});

// As Nx's manual DTE recipes and lerna's Windows run do: once the command has ended, even when it
// failed or timed out, the run's agents need not wait for NX Cloud to notice.
const stopAgents = () => ({
  run: { name: 'Stop the agents', when: 'always', command: 'yarn nx stop-all-agents' },
});

const mainJob = (
  selected: readonly Workflow[],
  changedFiles: readonly string[],
  targets: readonly string[],
  base: string | undefined,
  agents: number
) =>
  defineJob(NX_MAIN_JOBS.linux, () => ({
    executor: { name: 'sb_node_22_classic', class: 'large' },
    environment: {
      ...nxEnvironment('linux', changedFiles),
      // Tells NX Cloud how many agents there are, which it weighs when it stops agents early.
      NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: `${agents}`,
    },
    steps: [
      // One commit: `nx affected` diffs against the base the setup job found (fetched below), and
      // a focused run's check reads the changed files (CI_CHANGED_FILES), not a git range.
      git.checkout(),
      startCiRun('linux', targets, NX_CLOUD),
      ...restoreNodeModules(),
      ...fetchBase(base),
      runNx('linux', selected, base),
      stopAgents(),
      ...saveNodeModules(),
    ],
  }));

const agentJob = (changedFiles: readonly string[], agents: number) =>
  defineJob('nx-agent', () => ({
    executor: { name: 'sb_node_22_browsers', class: 'large' },
    parallelism: agents,
    environment: {
      ...nxEnvironment('linux', changedFiles),
      ...agentEnvironment,
      // The sandboxes install from the global yarn cache (scripts/utils/yarn.ts), so the installs
      // of one sandbox, and of every sandbox task an agent runs after it, share their downloads.
      // A fresh container starts with an empty cache, and nothing here saves it between runs;
      // the step below clears @storybook/* from it anyway, as NX Cloud's workers do.
      STORYBOOK_NX_CLOUD_AGENT: 'true',
      // CircleCI's own e2e jobs run 3 workers on 4 vCPUs; the dev-server E2E targets set 4 in nx.json.
      PLAYWRIGHT_WORKERS: '3',
      // Matches the agent in .nx/workflows/circleci-assignment-rules.yaml.
      NX_AGENT_LAUNCH_TEMPLATE: LAUNCH_TEMPLATES.linux,
    },
    steps: [
      git.checkout(),
      ...restoreNodeModules(),
      cache.attach(['v1-nx-dte-playwright/{{ arch }}/{{ checksum "yarn.lock" }}']),
      {
        run: {
          name: 'Install Chromium for Playwright',
          // The image has Chrome's system libraries, so no `--with-deps`.
          command: 'yarn playwright install chromium',
        },
      },
      ...(isTrustedAuthor()
        ? [
            cache.persist(
              ['~/.cache/ms-playwright'],
              'v1-nx-dte-playwright/{{ arch }}/{{ checksum "yarn.lock" }}'
            ),
          ]
        : []),
      {
        run: {
          name: 'Clear Storybook packages from the global yarn cache',
          command:
            'rm -f ~/.yarn/berry/cache/storybook-npm-*.zip ~/.yarn/berry/cache/@storybook-*.zip',
        },
      },
      {
        run: {
          name: 'Run the tasks NX Cloud assigns',
          command: `NX_AGENT_NAME="circleci-linux-$CIRCLE_NODE_INDEX" /usr/bin/timeout --kill-after=1m 45m yarn nx start-agent`,
          // NX Cloud stops a worker that is silent for 10 minutes; the Chromatic task prints a
          // line every minute while it waits.
          no_output_timeout: '20m',
        },
      },
      testResults.persist('test-results'),
    ],
  }));

const WINDOWS_PLAYWRIGHT_KEY = 'v1-nx-dte-playwright-windows/{{ checksum "yarn.lock" }}';
const WINDOWS_PLAYWRIGHT_PATH = 'C:\\Users\\circleci\\AppData\\Local\\ms-playwright';

// What every Windows job does before Nx: Node, and node_modules from CircleCI's Windows cache.
const windowsSetup = () => [
  // Over https, as CircleCI's own Windows jobs check out.
  git.checkout({ forceHttps: true }),
  node.installOnWindows(),
];

const windowsMainJob = (
  selected: readonly Workflow[],
  changedFiles: readonly string[],
  targets: readonly string[],
  base: string | undefined,
  agents: number
) =>
  defineJob(NX_MAIN_JOBS.windows, () => ({
    // Runs no task; on Windows so that it hashes the tasks on the OS that runs them.
    executor: { name: 'win/default', size: 'medium', shell: 'bash.exe' },
    environment: {
      ...nxEnvironment('windows', changedFiles),
      NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: `${agents}`,
    },
    steps: [
      ...windowsSetup(),
      startCiRun('windows', targets, NX_CLOUD),
      ...installWithCache('windows'),
      ...fetchBase(base),
      runNx('windows', selected, base),
      stopAgents(),
    ],
  }));

const windowsAgentJob = (changedFiles: readonly string[], agents: number) =>
  defineJob('nx-agent-windows', () => ({
    // As CircleCI's own Windows E2E jobs.
    executor: { name: 'win/default', size: 'large', shell: 'bash.exe' },
    parallelism: agents,
    environment: {
      ...nxEnvironment('windows', changedFiles),
      ...agentEnvironment,
      PLAYWRIGHT_WORKERS: '3',
      NX_AGENT_LAUNCH_TEMPLATE: LAUNCH_TEMPLATES.windows,
    },
    steps: [
      ...windowsSetup(),
      ...installWithCache('windows'),
      {
        run: {
          name: 'Clone GitHub over https',
          // The checkout orb rewrites every https://github.com URL to ssh globally.
          command: [
            'git config --global --unset-all url.ssh://git@github.com.insteadOf || true',
            "git config --global --get-regexp '^url\\.' || echo 'No URL rewrites left.'",
          ].join('\n'),
        },
      },
      cache.attach([WINDOWS_PLAYWRIGHT_KEY]),
      {
        run: {
          name: 'Install Chromium for Playwright',
          command: 'yarn playwright install chromium',
        },
      },
      ...(isTrustedAuthor()
        ? [cache.persist([WINDOWS_PLAYWRIGHT_PATH], WINDOWS_PLAYWRIGHT_KEY)]
        : []),
      {
        run: {
          name: 'Run the tasks NX Cloud assigns',
          // Bounded as the main job is (`runNx`).
          command: `NX_AGENT_NAME="circleci-windows-$CIRCLE_NODE_INDEX" /usr/bin/timeout --kill-after=1m 75m yarn nx start-agent`,
          no_output_timeout: '20m',
        },
      },
      testResults.persist('test-results'),
    ],
  }));

// Every job of the NX DTE pipeline for the given CircleCI workflows.
export function getNxDteJobs(
  selected: readonly Workflow[],
  baseRef: string,
  options: NxDteOptions = {}
): JobOrNoOpJob[] {
  const changedFiles = selected.includes('focus') ? getChangedFiles(baseRef) : [];
  const plan = planFor(selected, changedFiles);
  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }
  const { base, selection } = options;
  const jobs: JobOrNoOpJob[] = [];

  const linux = selection?.linux;
  if (linuxRuns(selected, plan) && (!linux || Object.keys(linux.tasks).length > 0)) {
    const max = options.maxAgents ?? MAX_AGENTS.linux;
    const agents = linux ? agentsForSelection(linux, 'linux', max) : max;
    const targets = commandTargets([...plan.tasks, ...(plan.affectedCheck ? ['*:check'] : [])]);
    jobs.push(
      mainJob(selected, changedFiles, targets, base, agents),
      agentJob(changedFiles, agents)
    );
  }

  const windowsTasks = windowsTasksOf(plan);
  const windows = selection?.windows;
  if (windowsTasks.length > 0 && (!windows || Object.keys(windows.tasks).length > 0)) {
    const targets = commandTargets(windowsTasks);
    const agents = windows ? agentsForSelection(windows, 'windows') : MAX_AGENTS.windows;
    jobs.push(
      windowsMainJob(selected, changedFiles, targets, base, agents),
      windowsAgentJob(changedFiles, agents)
    );
  }

  if (plan.sideJobs.includes('node-26-smoke')) {
    jobs.push(node26Smoke);
  }
  // A CircleCI workflow needs a job, and a `windows` run has no completion job.
  if (jobs.length === 0) {
    jobs.push(nothingToRunJob);
  }
  return jobs;
}

const nothingToRunJob = defineJob('nx-nothing-to-run', () => ({
  executor: { name: 'sb_node_22_classic', class: 'small' },
  steps: [{ run: { name: 'Nothing to run', command: 'echo "The change reaches no NX task."' } }],
}));
