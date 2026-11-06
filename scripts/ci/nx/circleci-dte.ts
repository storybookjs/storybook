// The CircleCI jobs of the NX DTE pipeline: Nx distributes the tasks that cover a CircleCI workflow
// (plan.ts) over CircleCI machines, with NX Cloud's manual distributed task execution. NX Cloud
// schedules the tasks and holds the remote cache; CircleCI provides the machines.
//
// - `nx-main` starts the NX Cloud run (`start-ci-run --distribute-on=manual`), then runs one Nx
//   command (run.ts): on a pull request `nx affected`, which runs only the tasks the change reaches,
//   otherwise `nx run-many`. It runs no task itself.
// - `nx-agent` and, a little later, `nx-agent-peak` ({@link NX_DTE_WAVES}) run as parallel
//   containers, each `nx start-agent`, which runs the tasks NX Cloud assigns.
//   `start-ci-run --stop-workers-after` names every target of the run, so NX Cloud knows when no
//   more tasks can come and stops each agent once it has nothing left for it, as the Nx docs
//   recommend; no `complete-ci-run` is needed.
// - The Windows tests (plan.ts `WINDOWS_TASKS`) run the same way in a second run of the same NX
//   Cloud pipeline: `nx-main-windows` and `nx-agent-windows`, with `NX_CI_EXECUTION_ENV=windows`,
//   so NX Cloud shows them in a tab of their own. The same targets as on Linux; their cache entries
//   are kept apart by the OS input in nx.json.
// - The Node 26 smoke job stays a plain CircleCI job, as CircleCI defines it.
//
// CircleCI's setup job asks Nx which tasks the run will run (selection.ts) and passes them to
// main.ts, which sizes each agent job to that work: a run with nothing to do starts no agent.
//
// Opt in with the `nxDte` pipeline parameter (.circleci/config.yml); main.ts then generates these
// jobs instead of the per-job ones. Like main.ts, this runs under plain Node before `yarn install`.
import { installWithCache, node26Smoke } from '../common-jobs.ts';
import { getChangedFiles } from '../focus.ts';
import { cache, git, node, testResults } from '../utils/helpers.ts';
import { isTrustedAuthor } from '../utils/runtime.ts';
import { type JobOrNoOpJob, type Workflow, defineJob } from '../utils/types.ts';
import { type Plan, planFor, windowsTasksOf } from './plan.ts';
import {
  type SelectedTask,
  type Selection,
  agentsNeeded,
  makespan,
  taskSeconds,
} from './selection.ts';

// The agents come in two waves, each one CircleCI job of parallel `large` containers (4 vCPUs; a
// task costs more on `xlarge`, which bills twice the credits per minute and ran the dev-server E2E
// tests only a quarter faster).
//
// - `first` starts with the run. Until the sandboxes exist, only the tasks that need none can
//   run: compile, lint, the unit and internal E2E tests, and creating the sandboxes.
// - `peak` starts {@link NX_DTE_PEAK_DELAY_SECONDS} later, behind a `small` job that only waits.
//   Once compile, publish and the sandboxes are done (about 100 seconds into the run), some 50
//   sandbox tasks become ready at once (E2E tests, Chromatic, Vitest). With one wave sized for
//   that peak, most agents idled, billed, for the first 100 seconds; with one sized for the start,
//   sandbox tasks waited up to two minutes for an agent. It only covers what the first wave cannot
//   ({@link PEAK_TASKS_PER_SANDBOX} per sandbox): a focused run with one sandbox needs none, and
//   24 agents that only started and stopped cost it a third more credits.
export const NX_DTE_WAVES = {
  first: { job: 'nx-agent', agents: 20 },
  peak: { job: 'nx-agent-peak', agents: 24 },
} as const;
export type NxDteWave = keyof typeof NX_DTE_WAVES;
export const NX_DTE_PEAK_DELAY_SECONDS = 75;
// The tasks of one sandbox that run at the same time once it is built.
const PEAK_TASKS_PER_SANDBOX = 3;
const PEAK_DELAY_JOB = 'nx-agent-peak-delay';

// Windows agents are `large` machines (120 credits a minute) that take about four minutes to boot,
// most of it `yarn install`; tasks run about twice as long as on the Linux agents.
export const NX_DTE_WINDOWS_AGENTS = 6;
const WINDOWS_SLOWDOWN = 2;

export type NxDteOptions = Partial<Record<NxDteWave, number>> & {
  // The commit a pull request branched from: the run then runs only the tasks a change since it
  // reaches (`nx affected`). Without it, every task of the plan runs.
  base?: string;
  // The tasks the run will run, from CircleCI's setup job (selection.ts). Without them, every wave
  // is sized for the whole plan.
  selection?: { linux: Selection; windows: Selection };
};

// The agents each wave runs for a selection: the fewest that end the run about as soon as all of
// them would (selection.ts), the first {@link NX_DTE_WAVES} wave's worth right away and the rest in
// the peak wave.
export function agentsForSelection(
  selection: Selection,
  options: Partial<Record<NxDteWave, number>> = {}
): Record<NxDteWave, number> {
  const firstMax = options.first ?? NX_DTE_WAVES.first.agents;
  const peakMax = options.peak ?? NX_DTE_WAVES.peak.agents;
  const total = agentsNeeded(selection, firstMax + peakMax);
  const first = Math.min(total, firstMax);
  return { first, peak: total - first };
}

// The Windows agents for a selection. Each one costs about 500 credits just to boot, so one more
// joins only while it ends the run at least {@link WINDOWS_AGENT_MIN_GAIN_SECONDS} sooner.
const WINDOWS_AGENT_MIN_GAIN_SECONDS = 120;
export function windowsAgentsFor(selection: Selection) {
  const seconds = (task: SelectedTask) => WINDOWS_SLOWDOWN * taskSeconds(task);
  const count = Math.min(NX_DTE_WINDOWS_AGENTS, Object.keys(selection.tasks).length);
  let agents = Math.min(1, count);
  while (
    agents < count &&
    makespan(selection, agents, seconds) - makespan(selection, agents + 1, seconds) >=
      WINDOWS_AGENT_MIN_GAIN_SECONDS
  ) {
    agents++;
  }
  return agents;
}

// The agents each wave runs for a plan, when the setup job could not say which tasks will run.
// The first wave never outnumbers a plan's tasks (a `docs` run has one), unless they expand to
// more in Nx: a `*` project or the affected check. The peak wave covers what the first cannot,
// {@link PEAK_TASKS_PER_SANDBOX} tasks per sandbox.
export function agentsFor(
  plan: Pick<Plan, 'tasks' | 'affectedCheck'>,
  options: Partial<Record<NxDteWave, number>> = {}
): Record<NxDteWave, number> {
  const expands = plan.affectedCheck || plan.tasks.some((task) => task.startsWith('*:'));
  const first = Math.min(
    options.first ?? NX_DTE_WAVES.first.agents,
    expands ? Infinity : plan.tasks.length
  );
  const sandboxes = plan.tasks.filter((task) => task.endsWith(':sandbox')).length;
  const peak = Math.min(
    options.peak ?? NX_DTE_WAVES.peak.agents,
    Math.max(0, PEAK_TASKS_PER_SANDBOX * sandboxes - first)
  );
  return { first, peak };
}

// dte-task-statuses.ts reads the failed tasks from this step of these jobs.
export const NX_MAIN_JOBS = { linux: 'nx-main', windows: 'nx-main-windows' } as const;
export const RUN_NX_STEP = 'Run nx';

// The agents' jobs, which `circleci-completion` does not wait for (main.ts).
export const NX_AGENT_JOB_IDS: readonly string[] = [
  ...Object.values(NX_DTE_WAVES).map((wave) => wave.job),
  PEAK_DELAY_JOB,
  'nx-agent-windows',
];

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

// The targets of a selection: `start-ci-run --stop-workers-after` names them all, so NX Cloud
// knows when no more tasks can come.
const targetsOf = (selection: Selection) =>
  [...new Set(Object.values(selection.tasks).map((task) => task.target))].sort();

const startCiRun = (os: Os, targets: readonly string[], npx: string) => ({
  run: {
    name: 'Start the NX Cloud run',
    // Before the install, so NX Cloud knows the run while the agents boot.
    // `--stop-workers-after` names every target the run's command runs, so NX Cloud knows when no
    // more tasks can come. It then stops each agent that has nothing left to run, instead of every
    // agent idling until the main job ends. A failed task does not stop them: the run reports
    // every failure, as CircleCI and nx.yml (`lifecycle.fail-after: 0`) do.
    // `start-ci-run` refuses to start while .nx/ci-config.yaml (the NX Cloud workers' config,
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
      // its machines for six hours. Not `nx stop-all-agents`, which may stop the other OS's agents
      // too. Git Bash's `timeout` on Windows.
      `/usr/bin/timeout --kill-after=1m ${os === 'windows' ? 75 : 45}m`,
      'yarn exec jiti ./scripts/ci/nx/run.ts',
      `--workflow=${selected.join(',')}`,
      `--env=${os}`,
      ...(base ? [`--base=${base}`] : []),
    ].join(' '),
  },
});

const mainJob = (
  selected: readonly Workflow[],
  changedFiles: readonly string[],
  selection: Selection,
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
      startCiRun('linux', targetsOf(selection), NX_CLOUD),
      ...restoreNodeModules(),
      ...fetchBase(base),
      runNx('linux', selected, base),
      ...saveNodeModules(),
    ],
  }));

const agentJob = (
  changedFiles: readonly string[],
  wave: NxDteWave,
  agents: number,
  requires: JobOrNoOpJob[] = []
) =>
  defineJob(
    NX_DTE_WAVES[wave].job,
    () => ({
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
            command: `NX_AGENT_NAME="circleci-${wave}-$CIRCLE_NODE_INDEX" /usr/bin/timeout --kill-after=1m 45m yarn nx start-agent`,
            // NX Cloud stops a worker that is silent for 10 minutes; the Chromatic task prints a
            // line every minute while it waits.
            no_output_timeout: '20m',
          },
        },
        testResults.persist('test-results'),
      ],
    }),
    requires
  );

// Only waits, on the smallest machine, so the peak wave starts when the sandboxes are nearly done.
const peakDelayJob = defineJob(PEAK_DELAY_JOB, () => ({
  executor: { name: 'sb_node_22_classic', class: 'small' },
  steps: [{ run: { name: 'Wait for the peak', command: `sleep ${NX_DTE_PEAK_DELAY_SECONDS}` } }],
}));

const WINDOWS_PLAYWRIGHT_KEY = 'v1-nx-dte-playwright-windows/{{ checksum "yarn.lock" }}';
const WINDOWS_PLAYWRIGHT_PATH = 'C:\\Users\\circleci\\AppData\\Local\\ms-playwright';

// What every Windows job does before Nx: Node, and node_modules from CircleCI's Windows cache.
const windowsSetup = () => [
  // Over https: through the checkout orb's ssh rewrite, the sandbox template's clone failed on
  // Windows with exit code 128 (the Linux agents clone the same way without trouble).
  git.checkout({ forceHttps: true }),
  node.installOnWindows(),
];

const windowsMainJob = (
  selected: readonly Workflow[],
  changedFiles: readonly string[],
  selection: Selection,
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
      startCiRun('windows', targetsOf(selection), NX_CLOUD),
      ...installWithCache('windows'),
      ...fetchBase(base),
      runNx('windows', selected, base),
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
      // Downloading Chromium took 3.5 minutes on GitHub's Windows runners, 6s from the cache.
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

  // The Linux tasks of a `windows` run only build what CircleCI's own Windows jobs unpack; the
  // Windows agents build their own.
  const linuxTasks = selected.every((workflow) => workflow === 'windows')
    ? false
    : plan.tasks.length > 0 || plan.affectedCheck;
  const linux = selection?.linux;
  if (linuxTasks && (!linux || Object.keys(linux.tasks).length > 0)) {
    const agents = linux ? agentsForSelection(linux, options) : agentsFor(plan, options);
    // Without a selection, the run's targets from the plan.
    const targets = linux ?? {
      tasks: Object.fromEntries(
        [...plan.tasks, ...(plan.affectedCheck ? ['*:check'] : [])].map((task) => [
          task,
          { project: '', target: task.slice(task.lastIndexOf(':') + 1) },
        ])
      ),
      dependencies: {},
    };
    jobs.push(
      mainJob(selected, changedFiles, targets, base, agents.first + agents.peak),
      agentJob(changedFiles, 'first', agents.first),
      ...(agents.peak > 0
        ? [peakDelayJob, agentJob(changedFiles, 'peak', agents.peak, [peakDelayJob])]
        : [])
    );
  }

  const windowsTasks = windowsTasksOf(plan);
  const windows = selection?.windows;
  if (windowsTasks.length > 0 && (!windows || Object.keys(windows.tasks).length > 0)) {
    const targets = windows ?? {
      tasks: Object.fromEntries(
        windowsTasks.map((task) => [task, { project: '', target: task.split(':').at(-1)! }])
      ),
      dependencies: {},
    };
    const agents = windows ? windowsAgentsFor(windows) : NX_DTE_WINDOWS_AGENTS;
    jobs.push(
      windowsMainJob(selected, changedFiles, targets, base, agents),
      windowsAgentJob(changedFiles, agents)
    );
  }

  if (plan.sideJobs.includes('node-26-smoke')) {
    jobs.push(node26Smoke);
  }
  return jobs;
}
