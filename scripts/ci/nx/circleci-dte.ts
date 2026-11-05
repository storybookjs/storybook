/**
 * The CircleCI jobs of the NX DTE pipeline: Nx distributes the tasks that cover a CircleCI workflow
 * (plan.ts) over CircleCI machines, with NX Cloud's manual distributed task execution. NX Cloud
 * schedules the tasks and holds the remote cache; CircleCI provides the machines.
 *
 * - `nx-main` starts the NX Cloud run (`start-ci-run --distribute-on=manual`), then runs the same
 *   `nx run-many` commands as .github/workflows/nx.yml (run.ts). It runs no task itself.
 * - `nx-agent` and, a little later, `nx-agent-peak` ({@link NX_DTE_WAVES}) run as parallel
 *   containers, each `nx start-agent`, which runs the tasks NX Cloud assigns. `start-ci-run --stop-workers-after` names every target
 *   of the run, so NX Cloud knows when no more tasks can come and stops each agent once it has
 *   nothing left for it, as the Nx docs recommend; no `complete-ci-run` is needed.
 * - The jobs NX Cloud's Linux workers cannot run (plan.ts `sideJobs`) are plain CircleCI jobs: the
 *   Node 26 smoke job as CircleCI defines it, and the Windows parts as .github/workflows/nx.yml runs
 *   them, which builds its sandbox on Windows instead of unpacking the Linux one.
 *
 * Opt in with the `nxDte` pipeline parameter (.circleci/config.yml); main.ts then generates these
 * jobs instead of the per-job ones. Like main.ts, this runs under plain Node before `yarn install`.
 */
import { daily } from '../../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { installWithCache, node26Smoke } from '../common-jobs.ts';
import { getChangedFiles } from '../focus.ts';
import { cache, git, node, testResults } from '../utils/helpers.ts';
import { isTrustedAuthor } from '../utils/runtime.ts';
import { type JobOrNoOpJob, type Workflow, defineJob } from '../utils/types.ts';
import { planFor } from './plan.ts';

/**
 * The agents come in two waves, each one CircleCI job of parallel `large` containers (4 vCPUs; a
 * task costs more on `xlarge`, which bills twice the credits per minute and ran the dev-server E2E
 * tests only a quarter faster).
 *
 * - `first` starts with the run and takes the tasks that need no sandbox: compile, lint, the unit
 *   and internal E2E tests.
 * - `peak` starts {@link NX_DTE_PEAK_DELAY_SECONDS} later, behind a `small` job that only waits.
 *   Once compile, publish and the sandboxes are done (about 100 seconds into the run), some 50
 *   sandbox tasks become ready at once (E2E tests, Chromatic, Vitest). With one wave sized for
 *   that peak, most agents idled, billed, for the first 100 seconds; with one sized for the start,
 *   sandbox tasks waited up to two minutes for an agent.
 */
export const NX_DTE_WAVES = {
  first: { job: 'nx-agent', agents: 20 },
  peak: { job: 'nx-agent-peak', agents: 24 },
} as const;
export type NxDteWave = keyof typeof NX_DTE_WAVES;
export const NX_DTE_PEAK_DELAY_SECONDS = 75;
const PEAK_DELAY_JOB = 'nx-agent-peak-delay';

/** How many agents each wave runs, when not its default. */
export type NxDteOptions = Partial<Record<NxDteWave, number>>;

/** The agents' jobs, which `circleci-completion` does not wait for (main.ts). */
export const NX_AGENT_JOB_IDS: readonly string[] = [
  ...Object.values(NX_DTE_WAVES).map((wave) => wave.job),
  PEAK_DELAY_JOB,
];

/**
 * Pinned as in nx.yml. Only for `start-ci-run`, which runs before the install. The commands after
 * it go through the workspace's own Nx: the NX Cloud client that `npx nx-cloud` loads resolves Nx
 * next to itself, outside the workspace, and the agents failed with "Cannot find module".
 */
const NX_CLOUD = 'npx --yes nx-cloud@19.1.5';

const NODE_MODULES_ARCHIVE = '/tmp/nx-dte-node_modules.tar.zst';
/** Everything that decides the installed tree, as CircleCI's own node_modules key (helpers.ts). */
const NODE_MODULES_KEY = [
  'v1-nx-dte-node_modules',
  '{{ arch }}',
  '{{ checksum ".nvmrc" }}',
  '{{ checksum ".yarnrc.yml" }}',
  '{{ checksum "yarn.lock" }}',
  '{{ checksum ".nx/workflows/prune-other-platforms.cjs" }}',
  '{{ checksum "scripts/ci/nx/circleci-node-modules.sh" }}',
].join('/');

const restoreNodeModules = () => [
  cache.attach([NODE_MODULES_KEY]),
  {
    run: {
      name: 'Restore node_modules',
      command: `bash scripts/ci/nx/circleci-node-modules.sh restore ${NODE_MODULES_ARCHIVE}`,
    },
  },
];

/**
 * Only `nx-main` stores a fresh tree, at its end, and only for a trusted author, as CircleCI's other
 * jobs do (common-jobs.ts `installWithCache`), so a fork PR cannot hand its tree to the next run.
 * At the end, because packing takes about a minute and nothing in the main job waits for it.
 */
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

/** The environment both kinds of jobs share. */
const nxEnvironment = (changedFiles: readonly string[]) => ({
  // Reports under the pull request, as nx.yml does: API-triggered pipelines carry no PR number.
  NX_BRANCH: '<< pipeline.parameters.ghPrNumber >>',
  // Report each finished task right away instead of in batches, so the tasks that depend on it
  // start sooner (nx.yml).
  NX_CLOUD_DISABLE_BUFFER_TASK_COMPLETIONS: 'true',
  // affected.ts reads the focused diff on the agents; the count tells a mangled list from an empty one.
  CI_CHANGED_FILES: changedFiles.join('\n'),
  CI_CHANGED_FILES_COUNT: `${changedFiles.length}`,
});

const mainJob = (
  selected: readonly Workflow[],
  changedFiles: readonly string[],
  targets: readonly string[],
  agents: number
) =>
  defineJob('nx-main', () => ({
    executor: { name: 'sb_node_22_classic', class: 'large' },
    environment: {
      ...nxEnvironment(changedFiles),
      // Tells NX Cloud how many agents there are, which it weighs when it stops agents early.
      NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: `${agents}`,
    },
    steps: [
      // One commit, also for a focused run: run.ts asks Nx which projects the changed files affect
      // (CI_CHANGED_FILES, from the setup job), not a git range.
      git.checkout(),
      {
        run: {
          name: 'Start the NX Cloud run',
          // Before the install, so NX Cloud knows the run while the agents boot.
          // `--stop-workers-after` names every target the run-many commands run (run.ts starts
          // several at once), so NX Cloud knows when no more tasks can come. It then stops each
          // agent that has nothing left to run, instead of every agent idling until the main job
          // ends. A failed task does not stop them: the run reports every failure, as CircleCI and
          // nx.yml (`lifecycle.fail-after: 0`) do.
          // `start-ci-run` refuses to start while .nx/ci-config.yaml (the NX Cloud workers' config,
          // which only `start-workers` reads) exists, so it is out of the way for this command only.
          command: [
            'mv .nx/ci-config.yaml /tmp/ci-config.yaml',
            [
              `${NX_CLOUD} start-ci-run --distribute-on=manual`,
              '--assignment-rules=.nx/workflows/circleci-assignment-rules.yaml',
              `--stop-workers-after=${targets.join(',')}`,
              '--stop-workers-on-failure=false',
            ].join(' \\\n  '),
            'mv /tmp/ci-config.yaml .nx/ci-config.yaml',
          ].join('\n'),
        },
      },
      ...restoreNodeModules(),
      {
        run: {
          name: 'Run nx',
          // Wide enough that the task summary table never truncates task names.
          environment: { COLUMNS: 250 },
          no_output_timeout: '30m',
          command: `yarn exec jiti ./scripts/ci/nx/run.ts --workflow=${selected.join(',')}`,
        },
      },
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
        ...nxEnvironment(changedFiles),
        // The NX Cloud workers' environment (.nx/workflows/agents.yaml).
        STORYBOOK_DISABLE_TELEMETRY: 'true',
        IN_STORYBOOK_SANDBOX: 'true',
        // The sandboxes install from the global yarn cache (scripts/utils/yarn.ts), so the installs
        // of one sandbox, and of every sandbox task an agent runs after it, share their downloads.
        // With it, a stale @storybook/* zip in that cache would be installed instead of the
        // packages this run publishes (same version, other contents), so the step below clears
        // them first, as NX Cloud's workers do (.nx/workflows/agents.yaml).
        STORYBOOK_NX_CLOUD_AGENT: 'true',
        // CircleCI's own e2e jobs run 3 workers on 4 vCPUs; the dev-server E2E targets set 4 in nx.json.
        PLAYWRIGHT_WORKERS: '3',
        // bench-packages.ts uploads the benchmarks for this pull request.
        BENCH_BASE_BRANCH: '<< pipeline.parameters.ghBaseBranch >>',
        BENCH_PR_NUMBER: '<< pipeline.parameters.ghPrNumber >>',
        // Matches the agent in .nx/workflows/circleci-assignment-rules.yaml.
        NX_AGENT_LAUNCH_TEMPLATE: 'circleci-linux',
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
            command: `NX_AGENT_NAME="circleci-${wave}-$CIRCLE_NODE_INDEX" yarn nx start-agent`,
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

/** Only waits, on the smallest machine, so the peak wave starts when the sandboxes are nearly done. */
const peakDelayJob = defineJob(PEAK_DELAY_JOB, () => ({
  executor: { name: 'sb_node_22_classic', class: 'small' },
  steps: [{ run: { name: 'Wait for the peak', command: `sleep ${NX_DTE_PEAK_DELAY_SECONDS}` } }],
}));

const WINDOWS_PLAYWRIGHT_KEY = 'v1-nx-dte-playwright-windows/{{ checksum "yarn.lock" }}';
const WINDOWS_PLAYWRIGHT_PATH = 'C:\\Users\\circleci\\AppData\\Local\\ms-playwright';

/** CircleCI's first daily sandbox, as `getWindowsSandboxes` (sandboxes.ts) and nx.yml use. */
const WINDOWS_TEMPLATE = daily[0];

const windowsParts = ['unit-1', 'unit-2', 'init-empty', 'e2e-build', 'e2e-dev'] as const;
type WindowsPart = (typeof windowsParts)[number];

/**
 * A part of the Windows tests, as nx.yml's `windows` matrix runs them: CircleCI's own Windows
 * sandbox jobs unpack the sandbox a Linux job created, and init-empty-windows the packages the
 * Linux build published, which the NX agents do not hand to CircleCI.
 */
const windowsJob = (part: WindowsPart) =>
  defineJob(`Windows (${part})`, () => {
    const registry = part === 'init-empty' || part.startsWith('e2e-');
    const run = (name: string, command: string, extra: Record<string, unknown> = {}) => ({
      run: { name, command, ...extra },
    });
    return {
      executor: {
        name: 'win/default',
        // As CircleCI's Windows jobs: init-empty on medium, the others on large.
        size: part === 'init-empty' ? 'medium' : 'large',
        shell: 'bash.exe',
      },
      environment: { NX_NO_CLOUD: 'true', STORYBOOK_DISABLE_TELEMETRY: 'true' },
      steps: [
        git.checkout({ forceHttps: true }),
        node.installOnWindows(),
        ...installWithCache('windows'),
        // The unit tests check that `dist` is built (dist-contract.test.ts).
        run('Compile', 'yarn task --task compile --start-from=auto --no-link --debug'),
        git.check(),
        ...(part.startsWith('unit-')
          ? [
              run(
                'Unit tests',
                `yarn test --project '!agent-eval' --shard=${part.slice('unit-'.length)}/2 --reporter=junit --reporter=default --outputFile=./test-results/junit.xml`
              ),
              testResults.persist('test-results'),
            ]
          : []),
        ...(registry
          ? [
              run('Publish to the local registry', 'yarn local-registry --publish', {
                working_directory: 'code',
              }),
              run('Local registry', 'yarn local-registry --open', {
                working_directory: 'code',
                background: true,
              }),
              run(
                'Wait for the local registry',
                'yarn wait-on --timeout 120000 tcp:127.0.0.1:6001 tcp:127.0.0.1:6002',
                { working_directory: 'code' }
              ),
            ]
          : []),
        ...(part === 'init-empty'
          ? [
              run(
                'Storybook init from an empty directory',
                'yarn exec jiti ./scripts/ci/nx/init-empty.ts react-vite-ts'
              ),
            ]
          : []),
        ...(part.startsWith('e2e-')
          ? [
              // The checkout orb rewrites every https://github.com URL to ssh globally, and on
              // Windows the sandbox template's clone through that rewrite failed with exit code 128
              // (the Linux agents clone the same way without trouble).
              run(
                'Clone GitHub over https',
                [
                  'git config --global --unset-all url.ssh://git@github.com.insteadOf || true',
                  "git config --global --get-regexp '^url\\.' || echo 'No URL rewrites left.'",
                ].join('\n')
              ),
              run(
                'Create the sandbox',
                `yarn task sandbox --template ${WINDOWS_TEMPLATE} --no-link -s sandbox --debug`,
                { environment: { STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: 1 } }
              ),
              // Downloading Chromium took 3.5 minutes on GitHub's Windows runners, 6s from the cache.
              cache.attach([WINDOWS_PLAYWRIGHT_KEY]),
              run('Install Playwright', 'yarn playwright install chromium'),
              ...(isTrustedAuthor()
                ? [cache.persist([WINDOWS_PLAYWRIGHT_PATH], WINDOWS_PLAYWRIGHT_KEY)]
                : []),
            ]
          : []),
        // Server and tests in one step: CircleCI may stop what a step leaves in the background.
        ...(part === 'e2e-build'
          ? [
              run(
                'Build and serve the sandbox, then run its E2E tests',
                [
                  `yarn task build --template ${WINDOWS_TEMPLATE} --no-link -s build`,
                  `(yarn task serve --template ${WINDOWS_TEMPLATE} --no-link -s serve > serve.log 2>&1 &)`,
                  '(cd code && yarn wait-on --timeout 120000 tcp:127.0.0.1:8001)',
                  // As the dev E2E tests below.
                  `/usr/bin/timeout --kill-after=1m 20m yarn task e2e-tests --template ${WINDOWS_TEMPLATE} --no-link -s e2e-tests`,
                ].join('\n'),
                { no_output_timeout: '10m' }
              ),
            ]
          : []),
        ...(part === 'e2e-dev'
          ? [
              run(
                'Run the sandbox in dev mode, then run its dev E2E tests',
                [
                  // `yarn task dev` also makes the sandbox a git repository, which the change
                  // detection tests need.
                  'export STORYBOOK_SERVE_PORT=8002',
                  `(yarn task dev --template ${WINDOWS_TEMPLATE} --no-link -s dev > dev.log 2>&1 &)`,
                  '(cd code && yarn wait-on --timeout 300000 tcp:127.0.0.1:8002)',
                  // A run once stopped printing halfway and held a Windows large machine (120
                  // credits a minute) for an hour; CircleCI's no-output timeout did not end it. The
                  // whole suite takes about 10 minutes. Git Bash's own `timeout`, not Windows'.
                  `/usr/bin/timeout --kill-after=1m 20m yarn task e2e-tests-dev --template ${WINDOWS_TEMPLATE} --no-link -s e2e-tests-dev --junit`,
                ].join('\n'),
                { no_output_timeout: '10m' }
              ),
            ]
          : []),
        ...(part.startsWith('e2e-')
          ? [
              run('Server logs', `tail -n 200 ${part === 'e2e-build' ? 'serve' : 'dev'}.log`, {
                when: 'on_fail',
              }),
            ]
          : []),
      ],
    };
  });

/** Every job of the NX DTE pipeline for the given CircleCI workflows. */
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

  const agents = {
    first: options.first ?? NX_DTE_WAVES.first.agents,
    peak: options.peak ?? NX_DTE_WAVES.peak.agents,
  };
  const targets = [
    ...new Set([
      ...plan.tasks.map((task) => task.slice(task.lastIndexOf(':') + 1)),
      ...(plan.affectedCheck ? ['check'] : []),
    ]),
  ].sort();
  const jobs: JobOrNoOpJob[] = [];
  if (plan.tasks.length > 0 || plan.affectedCheck) {
    jobs.push(
      mainJob(selected, changedFiles, targets, agents.first + agents.peak),
      agentJob(changedFiles, 'first', agents.first),
      peakDelayJob,
      agentJob(changedFiles, 'peak', agents.peak, [peakDelayJob])
    );
  }
  if (plan.sideJobs.includes('windows')) {
    jobs.push(...windowsParts.filter((part) => part !== 'init-empty').map(windowsJob));
  }
  if (plan.sideJobs.includes('windows-init-empty')) {
    jobs.push(windowsJob('init-empty'));
  }
  if (plan.sideJobs.includes('node-26-smoke')) {
    jobs.push(node26Smoke);
  }
  return jobs;
}
