/**
 * The CircleCI jobs of the NX DTE pipeline: Nx distributes the tasks that cover a CircleCI workflow
 * (plan.ts) over CircleCI machines, with NX Cloud's manual distributed task execution. NX Cloud
 * schedules the tasks and holds the remote cache; CircleCI provides the machines.
 *
 * - `nx-main` starts the NX Cloud run (`start-ci-run --distribute-on=manual`), then runs the same
 *   `nx run-many` commands as .github/workflows/nx.yml (run.ts). It runs no task itself.
 * - `nx-agent` runs as {@link NX_DTE_AGENTS} parallel containers, each `nx-cloud start-agent`,
 *   which runs the tasks NX Cloud assigns until `nx-main` completes the run.
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

/** Parallel CircleCI agent containers. NX Cloud's own workers run 20 (the Team plan's maximum). */
export const NX_DTE_AGENTS = 20;

/** Pinned as in nx.yml, so both pipelines talk to NX Cloud the same way. */
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
            command: `bash scripts/ci/nx/circleci-node-modules.sh pack ${NODE_MODULES_ARCHIVE}`,
          },
        },
        cache.persist([NODE_MODULES_ARCHIVE], NODE_MODULES_KEY),
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

const mainJob = (selected: readonly Workflow[], changedFiles: readonly string[]) =>
  defineJob('nx-main', () => ({
    executor: { name: 'sb_node_22_classic', class: 'large' },
    environment: nxEnvironment(changedFiles),
    steps: [
      // A focused run asks Nx which projects the diff affects, so it needs the merge base: the
      // history the setup job fetches (.circleci/config.yml).
      selected.includes('focus')
        ? {
            'git-shallow-clone/checkout_advanced': {
              clone_options: '--depth 500 --filter=blob:none --no-tags',
              fetch_options: '--depth 500 --filter=blob:none',
              tag_fetch_options: '--no-tags',
            },
          }
        : git.checkout(),
      {
        run: {
          name: 'Start the NX Cloud run',
          // Before the install, so NX Cloud knows the run while the agents boot. The agents finish
          // when `complete-ci-run` below says so, not when the first of the run-many commands
          // (run.ts starts several at once) ends. A failed task does not stop them: the run reports
          // every failure, as CircleCI and nx.yml (`lifecycle.fail-after: 0`) do.
          command: [
            `${NX_CLOUD} start-ci-run --distribute-on=manual`,
            '--assignment-rules=.nx/workflows/circleci-assignment-rules.yaml',
            '--require-explicit-completion',
            '--stop-workers-on-failure=false',
          ].join(' \\\n  '),
        },
      },
      ...restoreNodeModules(),
      ...(selected.includes('focus')
        ? [
            {
              run: {
                name: 'Fetch the base branch',
                command: [
                  'git fetch --depth=500 --filter=blob:none --no-tags origin \\',
                  '  "<< pipeline.parameters.ghBaseBranch >>:refs/remotes/origin/<< pipeline.parameters.ghBaseBranch >>"',
                  'echo "export NX_BASE=$(git merge-base origin/<< pipeline.parameters.ghBaseBranch >> HEAD)" >> "$BASH_ENV"',
                  'echo "export NX_HEAD=$(git rev-parse HEAD)" >> "$BASH_ENV"',
                ].join('\n'),
              },
            },
          ]
        : []),
      {
        run: {
          name: 'Run nx',
          // Wide enough that the task summary table never truncates task names.
          environment: { COLUMNS: 250 },
          no_output_timeout: '30m',
          command: `yarn exec jiti ./scripts/ci/nx/run.ts --workflow=${selected.join(',')}`,
        },
      },
      {
        run: {
          name: 'Complete the NX Cloud run',
          when: 'always',
          command: `${NX_CLOUD} complete-ci-run`,
        },
      },
      ...saveNodeModules(),
    ],
  }));

const agentJob = (changedFiles: readonly string[]) =>
  defineJob('nx-agent', () => ({
    // 8 vCPUs and 16 GB, as NX Cloud's extra_large workers (.nx/workflows/agents.yaml).
    executor: { name: 'sb_node_22_browsers', class: 'xlarge' },
    parallelism: NX_DTE_AGENTS,
    environment: {
      ...nxEnvironment(changedFiles),
      // The NX Cloud workers' environment (.nx/workflows/agents.yaml).
      STORYBOOK_DISABLE_TELEMETRY: 'true',
      IN_STORYBOOK_SANDBOX: 'true',
      PLAYWRIGHT_WORKERS: '6',
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
          name: 'Run the tasks NX Cloud assigns',
          command: 'NX_AGENT_NAME="circleci-$CIRCLE_NODE_INDEX" ' + `${NX_CLOUD} start-agent`,
          // NX Cloud stops a worker that is silent for 10 minutes; the Chromatic task prints a
          // line every minute while it waits.
          no_output_timeout: '20m',
        },
      },
      testResults.persist('test-results'),
    ],
  }));

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
              run(
                'Create the sandbox',
                `yarn task sandbox --template ${WINDOWS_TEMPLATE} --no-link -s sandbox --debug`,
                { environment: { STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: 1 } }
              ),
              run('Install Playwright', 'yarn playwright install chromium'),
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
                  `yarn task e2e-tests --template ${WINDOWS_TEMPLATE} --no-link -s e2e-tests`,
                ].join('\n')
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
                  `yarn task e2e-tests-dev --template ${WINDOWS_TEMPLATE} --no-link -s e2e-tests-dev --junit`,
                ].join('\n')
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
export function getNxDteJobs(selected: readonly Workflow[], baseRef: string): JobOrNoOpJob[] {
  const changedFiles = selected.includes('focus') ? getChangedFiles(baseRef) : [];
  const plan = planFor(selected, changedFiles);
  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }

  const jobs: JobOrNoOpJob[] = [];
  if (plan.tasks.length > 0 || plan.affectedCheck) {
    jobs.push(mainJob(selected, changedFiles), agentJob(changedFiles));
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
