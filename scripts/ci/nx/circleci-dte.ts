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
// its cache, and how long each takes, and works out the agents each OS needs for that work
// (select.ts, agent-sizing.ts); all of them start at once.
//
// What the tasks on an agent see (its machine, environment and tools) is in agent-environment.ts,
// which every task hashes; this file only schedules, so a change to it keeps the cache.
//
// Opt in with the `nxDte` pipeline parameter (.circleci/config.yml); main.ts then generates these
// jobs instead of the per-job ones. Like main.ts, this runs under plain Node before `yarn install`.
import { node26Smoke } from '../common-jobs.ts';
import { artifact, cache, git, testResults } from '../utils/helpers.ts';
import { type FocusDiff, changedFilesEnvironment, focusDiff } from '../utils/changed-files.ts';
import { isTrustedAuthor } from '../utils/runtime.ts';
import { type JobOrNoOpJob, type Workflow, defineJob } from '../utils/types.ts';
import { installNodeOnWindows } from '../utils/windows-node.ts';
import { linuxRuns, planFor, windowsTasksOf } from './plan.ts';
import { AGENT_EXECUTORS, type Os, agentEnvironment, agentSetup } from './agent-environment.ts';
import { MAX_AGENTS } from './agent-sizing.ts';
import type { Selection } from './selection.ts';

export type NxDteOptions = {
  // At most this many Linux agents when the setup job sized none (the `nxDteMaxAgents` parameter).
  maxAgents?: number;
  // The commit a pull request branched from: the run then runs only the tasks a change since it
  // reaches (`nx affected`). Without it, every task of the plan runs.
  base?: string;
  // From CircleCI's setup job (select.ts): the tasks the run will run, and the agents each OS
  // needs for them. Without them (locally and in tests), every agent job starts at its maximum.
  selection?: { linux: Selection; windows: Selection };
  agents?: { linux: number; windows: number };
};

// dte-task-statuses.ts reads the failed tasks from this step of these jobs.
export const NX_MAIN_JOBS = { linux: 'nx-main', windows: 'nx-main-windows' } as const;
export const RUN_NX_STEP = 'Run nx';

// The agents' jobs, which `circleci-completion` does not wait for (main.ts).
export const NX_AGENT_JOBS = { linux: 'nx-agent', windows: 'nx-agent-windows' } as const;
export const NX_AGENT_JOB_IDS: readonly string[] = Object.values(NX_AGENT_JOBS);

// Pinned. Only for `start-ci-run`, which runs before the install, and for `stop-all-agents` when the
// job failed before it. The other commands go through the workspace's own Nx, which the NX Cloud
// client that `npx nx-cloud` loads cannot find.
const NX_CLOUD = 'npx --yes nx-cloud@19.1.5';

// The directory circleci-node-modules.sh keeps its archives in, and the hash of the manifests for
// the cache key, on each OS. The hash with forward slashes, as a backslash in a cache key's template
// starts an escape.
const NODE_MODULES_PATHS: Record<Os, { archives: string; sum: string }> = {
  linux: { archives: '/tmp/nx-dte-node_modules', sum: '/tmp/nx-dte-manifests.sha256' },
  windows: {
    archives: 'C:\\Users\\circleci\\nx-dte-node_modules',
    sum: 'C:/Users/circleci/nx-dte-manifests.sha256',
  },
};
// A Windows path as Git Bash names it: `C:\Users\…` or `C:/Users/…` as `/c/Users/…`.
export const inBash = (file: string) =>
  file
    .replace(/^([A-Za-z]):[\\/]/, (_, drive: string) => `/${drive.toLowerCase()}/`)
    .replaceAll('\\', '/');
export const NODE_MODULES_ARCHIVES = NODE_MODULES_PATHS.linux.archives;
export const MANIFESTS_SUM = NODE_MODULES_PATHS.linux.sum;
// Hashes the workspaces' manifests and Yarn's patches into the given file, for the key below.
const hashManifests = (sum: string) =>
  `shopt -s nullglob; cat package.json */package.json code/*/package.json code/*/*/package.json .yarn/patches/* | sha256sum > ${sum}`;
export const HASH_MANIFESTS_COMMAND = hashManifests(MANIFESTS_SUM);
// Everything that decides the installed tree, as CircleCI's own node_modules key (helpers.ts).
// The setup job (.circleci/config.yml) restores the Linux key; circleci-dte.test.ts keeps them equal.
const nodeModulesKey = (sum: string) =>
  [
    'v2-nx-dte-node_modules',
    '{{ arch }}',
    '{{ checksum ".nvmrc" }}',
    '{{ checksum ".yarnrc.yml" }}',
    '{{ checksum "yarn.lock" }}',
    '{{ checksum ".nx/workflows/prune-other-platforms.cjs" }}',
    '{{ checksum "scripts/ci/nx/circleci-node-modules.sh" }}',
    '{{ checksum "scripts/ci/nx/workspace-links.ts" }}',
    // The workspaces' manifests and the patches:
    // a change such as `installConfig` alters the installed tree without touching yarn.lock, and the
    // install that a changed patch needs is skipped on a hit.
    `{{ checksum "${sum}" }}`,
  ].join('/');
export const NODE_MODULES_KEY = nodeModulesKey(MANIFESTS_SUM);

const restoreNodeModules = (os: Os) => {
  const paths = NODE_MODULES_PATHS[os];
  return [
    {
      run: {
        name: 'Hash the package manifests and patches',
        command: hashManifests(inBash(paths.sum)),
      },
    },
    cache.attach([nodeModulesKey(paths.sum)]),
    {
      run: {
        name: 'Restore node_modules',
        command: `bash scripts/ci/nx/circleci-node-modules.sh restore ${inBash(paths.archives)}`,
      },
    },
  ];
};

// The main jobs store a fresh tree at their end, and only for a trusted author, as CircleCI's other
// jobs do (common-jobs.ts `installWithCache`), so a fork PR cannot hand its tree to the next run.
// On Linux the setup job stores it first when it installed (.circleci/config.yml); then this finds
// the tree came from the cache and packs nothing. At the end, because nothing in the main job waits
// for it.
const saveNodeModules = (os: Os) => {
  const paths = NODE_MODULES_PATHS[os];
  return isTrustedAuthor()
    ? [
        {
          run: {
            name: 'Pack node_modules',
            // Also when a task failed: the tree is the same either way.
            when: 'always',
            command: `bash scripts/ci/nx/circleci-node-modules.sh pack ${inBash(paths.archives)}`,
          },
        },
        {
          save_cache: {
            ...cache.persist([paths.archives], nodeModulesKey(paths.sum)).save_cache,
            when: 'always',
          },
        },
      ]
    : [];
};

// How long a main job's run and an agent may take, so a run that never ends frees its machines.
const TIMEOUT_MINUTES: Record<Os, number> = { linux: 45, windows: 75 };

// The environment every job of one OS shares.
const nxEnvironment = (os: Os, diff: FocusDiff | undefined) => ({
  // Reports under the pull request: API-triggered pipelines carry no PR number.
  NX_BRANCH: '<< pipeline.parameters.ghPrNumber >>',
  // The Linux and the Windows tasks run as two runs of one NX Cloud pipeline, each with its own
  // agents, which NX Cloud shows side by side.
  NX_CI_EXECUTION_ENV: os,
  // Report each finished task right away instead of in batches, so the tasks that depend on it
  // start sooner.
  NX_CLOUD_DISABLE_BUFFER_TASK_COMPLETIONS: 'true',
  // Selection from the repository's inputs only, as the setup job (without NX Cloud) makes it.
  NX_CLOUD_USE_ULTRACACHE: 'false',
  // The project's environment turns it on. Its lines bury the main job's summary, and on an agent its
  // lines about every extracted artifact pass CircleCI's 400,000-character step limit, which cuts
  // off the output of the last tasks.
  NX_VERBOSE_LOGGING: 'false',
  // The focused diff, for run.ts on the main job and affected.ts on the agents.
  ...changedFilesEnvironment(diff),
});

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
// name exactly these, or NX Cloud stops no agent before the run ends.
const commandTargets = (tasks: readonly string[]) =>
  [...new Set(tasks.map((task) => task.slice(task.lastIndexOf(':') + 1)))].sort();

// The background `start-ci-run` (startCiRun) leaves one of these for `Run nx`.
const CI_RUN_STARTED = '/tmp/nx-ci-run-started';
const CI_RUN_FAILED = '/tmp/nx-ci-run-failed';

const startCiRun = (os: Os, targets: readonly string[], npx: string) => ({
  run: {
    name: 'Start the NX Cloud run',
    // Before the install, so NX Cloud knows the run while the agents boot, and in the background,
    // so the install does not wait for npx to download the CLI. `Run nx` waits for it (waitForCiRun).
    // A failed task does not stop the agents: the run reports every failure, as CircleCI does.
    background: true,
    command: [
      `if ${[
        `${npx} start-ci-run --distribute-on=manual`,
        `--assignment-rules=${ASSIGNMENT_RULES[os]}`,
        `--stop-workers-after=${targets.join(',')}`,
        '--stop-workers-on-failure=false',
      ].join(' \\\n  ')}`,
      `then touch ${CI_RUN_STARTED}`,
      `else touch ${CI_RUN_FAILED}; exit 1`,
      'fi',
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

// One argument for bash, as it is.
const quote = (arg: string) => `'${arg.replaceAll("'", `'\\''`)}'`;

// Runs a command until another job of the workflow has ended (run-until-ended.sh): an agent until
// its main job has, a main job until all of its agents have.
const untilEnded = (job: string, code: number, message: string) =>
  `bash scripts/ci/nx/run-until-ended.sh ${job} ${code} ${quote(message)}`;
const AGENTS_GONE =
  'Every agent of this run has ended, but the run still waits for tasks: CircleCI lost an agent that held some. Rerun the workflow.';

// The setup job already worked out the run's Nx commands (select.ts): the main job runs them as
// they are, at the same time, instead of starting run.ts and the two Nx processes it needs for them.
const runCommands = (os: Os, commands: readonly (readonly string[])[]) =>
  [
    'status=0',
    'pids=()',
    ...commands.map(
      (command) =>
        `/usr/bin/timeout --kill-after=1m ${TIMEOUT_MINUTES[os]}m yarn ${command.map(quote).join(' ')} & pids+=($!)`
    ),
    'for pid in "${pids[@]}"; do wait "$pid" || status=1; done',
    'exit "$status"',
  ].join('\n');

const waitForCiRun = [
  'for _ in $(seq 300); do',
  `  [ -e ${CI_RUN_STARTED} ] && break`,
  `  [ -e ${CI_RUN_FAILED} ] && { echo "Starting the NX Cloud run failed."; exit 1; }`,
  '  sleep 1',
  'done',
  `[ -e ${CI_RUN_STARTED} ] || { echo "Starting the NX Cloud run took over 5 minutes."; exit 1; }`,
].join('\n');

const runNx = (
  os: Os,
  selected: readonly Workflow[],
  base: string | undefined,
  commands: readonly (readonly string[])[] | undefined
) => ({
  run: {
    name: RUN_NX_STEP,
    no_output_timeout: '30m',
    // Without the setup job's commands (locally and in tests), run.ts works them out.
    command: [
      waitForCiRun,
      `${untilEnded(NX_AGENT_JOBS[os], 1, AGENTS_GONE)} bash -c ${quote(
        commands
          ? runCommands(os, commands)
          : [
              // Bounded, as the agents are (TIMEOUT_MINUTES). Git Bash's `timeout` on Windows.
              `/usr/bin/timeout --kill-after=1m ${TIMEOUT_MINUTES[os]}m`,
              'yarn exec jiti ./scripts/ci/nx/run.ts',
              `--workflow=${selected.join(',')}`,
              `--env=${os}`,
              ...(base ? [`--base=${base}`] : []),
            ].join(' ')
      )}`,
    ].join('\n'),
  },
});

// As Nx's manual DTE recipes and lerna's Windows run do: once the command has ended, even when it
// failed or timed out, the run's agents need not wait for NX Cloud to notice.
// Also when the job failed before its install: the pinned CLI that started the run stops it then.
const stopAgents = () => ({
  run: {
    name: 'Stop the agents',
    when: 'always',
    command: `yarn nx stop-all-agents || ${NX_CLOUD} stop-all-agents`,
  },
});

// Each task writes its results to a folder of its own (scripts/utils/nx.ts `nxTaskResultsDirectory`).
const storeResults = () => [
  artifact.persist('test-results', 'test-results'),
  artifact.persist('code/playwright-results', 'playwright-results'),
  testResults.persist('test-results'),
];

// The tasks of an agent share its checkout, so a file one of them leaves there is read by the tasks
// NX Cloud happens to run after it, such as `oxfmt --check .`. scripts/task.ts fails the `yarn task`
// tasks that leave one; this step names what any other task, or a restored output, left. It does not
// fail: the agents are not part of the merge gate, so a red agent would only be noise.
export const CHECK_CHECKOUT_STEP = 'List what the tasks left in the checkout';
const checkCheckout = () => ({
  run: {
    name: CHECK_CHECKOUT_STEP,
    when: 'always',
    command: [
      'changes="$(git status --porcelain --untracked-files=all)"',
      'if [ -n "$changes" ]; then',
      '  echo "The tasks on this agent left files in the checkout that git does not ignore:"',
      '  echo "$changes"',
      '  echo "The later tasks on an agent read them. Write them to a gitignored path."',
      'else',
      '  echo "The checkout is as the commit has it."',
      'fi',
    ].join('\n'),
  },
});

const mainJob = (
  selected: readonly Workflow[],
  diff: FocusDiff | undefined,
  targets: readonly string[],
  base: string | undefined,
  agents: number,
  commands: readonly (readonly string[])[] | undefined
) =>
  defineJob(NX_MAIN_JOBS.linux, () => ({
    executor: { name: 'sb_node_22_classic', class: 'large' },
    environment: {
      ...nxEnvironment('linux', diff),
      // Tells NX Cloud how many agents there are, which it weighs when it stops agents early.
      NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: `${agents}`,
    },
    steps: [
      // One commit: `nx affected` diffs against the base the setup job found (fetched below), and
      // a focused run fetches the commit its diff starts at (scripts/ci/utils/changed-files.ts).
      git.checkout(),
      startCiRun('linux', targets, NX_CLOUD),
      ...restoreNodeModules('linux'),
      ...fetchBase(base),
      runNx('linux', selected, base, commands),
      stopAgents(),
      ...saveNodeModules('linux'),
    ],
  }));

const agentJob = (diff: FocusDiff | undefined, agents: number) =>
  defineJob(NX_AGENT_JOBS.linux, () => ({
    executor: AGENT_EXECUTORS.linux,
    parallelism: agents,
    environment: {
      ...nxEnvironment('linux', diff),
      ...agentEnvironment('linux'),
      // Matches the agent in .nx/workflows/circleci-assignment-rules.yaml.
      NX_AGENT_LAUNCH_TEMPLATE: LAUNCH_TEMPLATES.linux,
    },
    steps: [
      git.checkout(),
      ...restoreNodeModules('linux'),
      ...agentSetup('linux'),
      {
        run: {
          name: 'Run the tasks NX Cloud assigns',
          command: `NX_AGENT_NAME="circleci-linux-$CIRCLE_NODE_INDEX" ${untilEnded(NX_MAIN_JOBS.linux, 0, `${NX_MAIN_JOBS.linux} has ended, so this agent stops.`)} /usr/bin/timeout --kill-after=1m ${TIMEOUT_MINUTES.linux}m yarn nx start-agent`,
          // NX Cloud stops a worker that is silent for 10 minutes; the Chromatic task prints a
          // line every minute while it waits.
          no_output_timeout: '20m',
        },
      },
      ...storeResults(),
      checkCheckout(),
    ],
  }));

// Over https, as CircleCI's own Windows jobs check out.
const windowsCheckout = () => git.checkout({ forceHttps: true });

const windowsMainJob = (
  selected: readonly Workflow[],
  diff: FocusDiff | undefined,
  targets: readonly string[],
  base: string | undefined,
  agents: number,
  commands: readonly (readonly string[])[] | undefined
) =>
  defineJob(NX_MAIN_JOBS.windows, () => ({
    // Runs no task; on Windows so that it hashes the tasks on the OS that runs them.
    executor: { name: 'win/default', size: 'medium', shell: 'bash.exe' },
    environment: {
      ...nxEnvironment('windows', diff),
      NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: `${agents}`,
    },
    steps: [
      windowsCheckout(),
      // Before the NX Cloud run starts: `nvm use` swaps the Node that npx runs.
      installNodeOnWindows(),
      startCiRun('windows', targets, NX_CLOUD),
      ...restoreNodeModules('windows'),
      ...fetchBase(base),
      runNx('windows', selected, base, commands),
      stopAgents(),
      ...saveNodeModules('windows'),
    ],
  }));

const windowsAgentJob = (diff: FocusDiff | undefined, agents: number) =>
  defineJob(NX_AGENT_JOBS.windows, () => ({
    executor: AGENT_EXECUTORS.windows,
    parallelism: agents,
    environment: {
      ...nxEnvironment('windows', diff),
      ...agentEnvironment('windows'),
      NX_AGENT_LAUNCH_TEMPLATE: LAUNCH_TEMPLATES.windows,
    },
    steps: [
      windowsCheckout(),
      installNodeOnWindows(),
      ...restoreNodeModules('windows'),
      ...agentSetup('windows'),
      {
        run: {
          name: 'Run the tasks NX Cloud assigns',
          // Bounded as the main job is (`runNx`).
          command: `NX_AGENT_NAME="circleci-windows-$CIRCLE_NODE_INDEX" ${untilEnded(NX_MAIN_JOBS.windows, 0, `${NX_MAIN_JOBS.windows} has ended, so this agent stops.`)} /usr/bin/timeout --kill-after=1m ${TIMEOUT_MINUTES.windows}m yarn nx start-agent`,
          no_output_timeout: '20m',
        },
      },
      ...storeResults(),
      checkCheckout(),
    ],
  }));

// Every job of the NX DTE pipeline for the given CircleCI workflows.
export function getNxDteJobs(
  selected: readonly Workflow[],
  baseRef: string,
  options: NxDteOptions = {}
): JobOrNoOpJob[] {
  const diff = selected.includes('focus') ? focusDiff(baseRef) : undefined;
  const plan = planFor(selected, diff?.files ?? []);
  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }
  const { base, selection } = options;
  const jobs: JobOrNoOpJob[] = [];

  const linux = selection?.linux;
  if (linuxRuns(selected, plan) && (!linux || Object.keys(linux.tasks).length > 0)) {
    const agents = options.agents?.linux ?? options.maxAgents ?? MAX_AGENTS.linux;
    const targets = commandTargets([...plan.tasks, ...(plan.affectedCheck ? ['*:check'] : [])]);
    jobs.push(
      mainJob(selected, diff, targets, base, agents, linux?.commands),
      agentJob(diff, agents)
    );
  }

  const windowsTasks = windowsTasksOf(plan);
  const windows = selection?.windows;
  if (windowsTasks.length > 0 && (!windows || Object.keys(windows.tasks).length > 0)) {
    const targets = commandTargets(windowsTasks);
    const agents = options.agents?.windows ?? MAX_AGENTS.windows;
    jobs.push(
      windowsMainJob(selected, diff, targets, base, agents, windows?.commands),
      windowsAgentJob(diff, agents)
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
