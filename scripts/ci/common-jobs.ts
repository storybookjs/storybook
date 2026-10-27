import { globSync, statSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'path/posix';

import { isGlobalInput } from './global-inputs.ts';
import { LINUX_ROOT_DIR, WINDOWS_ROOT_DIR, WORKING_DIR } from './utils/constants.ts';
import {
  type CachePlatform,
  NODE_MODULES_CACHE_KEY,
  NODE_MODULES_CACHE_PATHS,
  PACKED_NODE_MODULES_ARCHIVE,
  artifact,
  cache,
  compileStep,
  git,
  node,
  npm,
  server,
  testResults,
  verdaccio,
  workflow,
  workspace,
} from './utils/helpers.ts';
import { isTrustedAuthor } from './utils/runtime.ts';
import { type JobOrNoOpJob, defineJob, defineNoOpJob } from './utils/types.ts';

const codeDir = new URL('../../code/', import.meta.url);
const packageDirs = ['*/src', '*/*/src'].flatMap((pattern) =>
  globSync(pattern, { cwd: fileURLToPath(codeDir), exclude: ['node_modules/**'] })
    .map((dir) => dir.split(sep).join('/'))
    .filter((dir) => statSync(new URL(dir, codeDir)).isDirectory())
    .sort((a, b) => (a.replaceAll('/', '\0') < b.replaceAll('/', '\0') ? -1 : 1))
);

/**
 * Every job that installs goes through here, so none is left on the orb's own cache: one job saving
 * a mismatched tree there would hand it to all the others. Saving stays gated on a trusted author so
 * a fork PR cannot put a tree where the next run will find it.
 */
const installWithCache = (platform: CachePlatform = 'linux') => [
  cache.attach([NODE_MODULES_CACHE_KEY(platform)]),
  npm.install('.'),
  ...(isTrustedAuthor()
    ? [cache.persist(NODE_MODULES_CACHE_PATHS, NODE_MODULES_CACHE_KEY(platform))]
    : []),
];

export const build_linux = defineJob('Build (linux)', () => ({
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    ...installWithCache(),
    npm.check(),
    workspace.pack(
      [
        // Workspace-root node_modules folders. Yarn hoists shared/singleton
        // dependencies (e.g. `oxc-parser`, `vitest`, `type-fest`) here rather than
        // into the per-package `code/<pkg>/node_modules` folders below. Downstream
        // jobs otherwise only receive these via the shared `save_cache`, which is
        // gated on `isTrustedAuthor()` — so community/fork PRs end up with a
        // freshly-built `dist` but no root `node_modules`, producing errors like
        // `Cannot find package 'oxc-parser'`. Packing them into the (pipeline-
        // scoped, un-gated) workspace makes downstream jobs correct for every PR.
        `${WORKING_DIR}/node_modules`,
        `${WORKING_DIR}/code/node_modules`,
        `${WORKING_DIR}/scripts/node_modules`,
        // agent-eval nests all its dependencies (installConfig.hoistingLimits),
        // so downstream checks need its node_modules packed explicitly.
        `${WORKING_DIR}/agent-eval/node_modules`,
      ],
      packageDirs.map((p) => `${WORKING_DIR}/code/${p.replace('src', 'node_modules')}`)
    ),
    compileStep(),
    {
      run: {
        name: 'Publish to Verdaccio',
        working_directory: `code`,
        command: 'yarn local-registry --publish',
      },
    },
    git.check(),
    artifact.persist(`code/bench/esbuild-metafiles`, 'bench'),
    workspace.awaitPack(),
    workspace.persist([
      PACKED_NODE_MODULES_ARCHIVE,
      ...packageDirs.map((p) => `${WORKING_DIR}/code/${p.replace('src', 'dist')}`),
      `${WORKING_DIR}/.verdaccio-cache`,
      `${WORKING_DIR}/code/bench`,
    ]),
  ],
}));

export const fmt = defineJob('Format check', () => ({
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    ...installWithCache(),
    {
      run: {
        name: 'Format check',
        command: 'yarn fmt:check',
      },
    },
    ...workflow.cancelOnFailure(),
  ],
}));

export const build_windows = defineJob('Build (windows)', () => ({
  executor: {
    name: 'win/default',
    size: 'xlarge',
    shell: 'bash.exe',
  },
  steps: [
    git.checkout({ forceHttps: true }),
    node.installOnWindows(),
    ...installWithCache('windows'),
    compileStep(),
    git.check(),
    verdaccio.start(),
    workspace.persist(
      [
        ...packageDirs.flatMap((p) => [
          `code/${p.replace('src', 'dist')}`,
          `code/${p.replace('src', 'node_modules')}`,
        ]),
        `.verdaccio-cache`,
        `code/bench`,
      ],
      `${WINDOWS_ROOT_DIR}\\${WORKING_DIR}`
    ),
  ],
}));

export const commonJobsNoOpJob = defineNoOpJob('Common Jobs', [build_linux]);

export const storybookChromatic = defineJob(
  'Local storybook & chromatic',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...workflow.restoreLinux({ shallow: false }),
      {
        run: {
          name: 'Build internal storybook',
          command: 'yarn storybook:ui:build',
          working_directory: 'code',
        },
      },
      {
        run: {
          name: 'Run Chromatic',
          command: 'yarn storybook:ui:chromatic',
          working_directory: 'code',
        },
      },
    ],
  }),
  [commonJobsNoOpJob]
);

export const internalStorybookE2e = defineJob(
  'Internal storybook E2E',
  () => ({
    executor: {
      name: 'sb_playwright',
      // The tools-attach.spec.ts CLIs build every manifest next to the dev server; OOMs on medium+.
      class: 'large',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Run internal Storybook',
          working_directory: 'code',
          background: true,
          command: 'yarn storybook:ui',
        },
      },
      server.wait(['6006']),
      {
        run: {
          name: 'Run internal Storybook E2E tests',
          command: 'yarn task e2e-tests-internal --no-link -s e2e-tests-internal --junit',
        },
      },
      artifact.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results'), 'test-results'),
      artifact.persist(
        join(LINUX_ROOT_DIR, WORKING_DIR, 'code', 'playwright-results'),
        'playwright-results'
      ),
      testResults.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results')),
    ],
  }),
  [commonJobsNoOpJob]
);

export const internalStorybookBuildE2e = defineJob(
  'Internal storybook build E2E',
  () => ({
    executor: {
      name: 'sb_playwright',
      class: 'medium+',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Build internal storybook',
          working_directory: 'code',
          command: 'yarn storybook:ui:build',
        },
      },
      {
        run: {
          name: 'Serve internal storybook static build',
          working_directory: 'code',
          background: true,
          command: 'yarn http-server storybook-static --port 6006 -s',
        },
      },
      server.wait(['6006']),
      {
        run: {
          name: 'Run internal Storybook static E2E tests',
          command:
            'STORYBOOK_TYPE=static yarn task e2e-tests-internal --no-link -s e2e-tests-internal --junit',
        },
      },
      artifact.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results'), 'test-results'),
      artifact.persist(
        join(LINUX_ROOT_DIR, WORKING_DIR, 'code', 'playwright-results'),
        'playwright-results'
      ),
      testResults.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results')),
    ],
  }),
  [commonJobsNoOpJob]
);

export const check = defineJob(
  'TypeScript validation',
  () => ({
    // xlarge because each of the 4 concurrent native-tsc processes in the
    // check task is itself multi-threaded (~4 threads), so throughput still
    // wants the full 8 vCPUs; roughly cost-neutral vs the previous serial run
    // on medium+ and much faster feedback for the cancel-on-failure gate.
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'TypeCheck code',
          working_directory: `code`,
          command: 'yarn task --task check --no-link',
        },
      },
      {
        run: {
          name: 'TypeCheck scripts',
          working_directory: `scripts`,
          command: 'yarn check',
        },
      },
      ...workflow.cancelOnFailure(),
    ],
  }),
  [commonJobsNoOpJob]
);

export const lint = defineJob(
  'ESLint',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'large',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Lint code JS',
          working_directory: `code`,
          command: 'yarn lint:js',
        },
      },
      {
        run: {
          name: 'Lint scripts',
          working_directory: `scripts`,
          command: 'yarn lint',
        },
      },
    ],
  }),
  [commonJobsNoOpJob]
);

export const knip = defineJob(
  'Knip validation',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Run Knip',
          working_directory: `code`,
          command: 'yarn knip --no-exit-code',
        },
      },
    ],
  }),
  [commonJobsNoOpJob]
);

/**
 * Builds a sandbox from scratch in the smoke job. Unlike the daily create jobs,
 * the smoke job has no workspace restore and no saved task state, so
 * `--start-from=auto` silently runs full sandbox creation (create → install →
 * init), and init under `--yes` auto-installs Playwright Chromium via the
 * vitest addon. Match the create jobs' guard (scripts/ci/sandboxes.ts): skip
 * that installation, and pass `--debug` so `exec.ts` relays child output
 * instead of piping it away. Piped output lets any slow init phase trip
 * CircleCI's 10-min no-output deadline invisibly.
 */
const smokeSandboxBuildStep = (template: string, label: string) => ({
  run: {
    name: `Build ${label} sandbox`,
    command: `yarn task build --template ${template} --start-from=auto --no-link --debug`,
    environment: {
      STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: '1',
    },
  },
});

/**
 * One job, not a second sandbox matrix. The generated sandbox workflow is a job
 * per template, so Node 26 only runs the unit suite plus one Vite build and one
 * Webpack build. It installs on its own: the shared node_modules cache is keyed
 * on `.nvmrc`, which is still Node 22.
 */
export const node26Smoke = defineJob('Node 26 smoke', () => ({
  executor: {
    name: 'sb_node_26',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    {
      run: {
        name: 'Install npm 12',
        command: ['node --version', 'sudo npm install -g npm@12', 'npm --version'].join('\n'),
      },
    },
    {
      run: {
        // Node 25 stopped bundling corepack. Without it, sandboxes run the
        // image's global yarn instead of the Yarn 4 their `packageManager`
        // field pins, and `create-storybook` hangs. `--force` replaces the
        // image's own yarn and pnpm binaries, as `corepack enable` would.
        name: 'Install corepack',
        command: [
          'sudo npm install -g --force corepack@0',
          'sudo corepack enable',
          'which yarn',
          'yarn --version',
        ].join('\n'),
      },
    },
    npm.install('.'),
    compileStep(),
    {
      run: {
        name: 'Run unit tests',
        // storybook-ui is the browser story project. The linux unit job never
        // runs it; stories have their own Playwright job. The scripts tests run
        // `main.ts` under plain Node with `--experimental-transform-types`, a
        // flag Node 26 dropped, so they keep running on the default-Node jobs.
        command: "yarn test --project '!storybook-ui' --project '!scripts'",
      },
    },
    smokeSandboxBuildStep('react-vite/default-ts', 'React Vite'),
    smokeSandboxBuildStep('react-webpack/18-ts', 'React Webpack'),
  ],
}));

const UNIT_TEST_REPORTERS =
  '--reporter=junit --reporter=default --outputFile=./test-results/junit.xml';

export const testsUnit_linux = defineJob(
  'Tests (linux)',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'large',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Run tests',
          command: [
            'TEST_FILES=$(circleci tests glob "code/**/*.{test,spec,test-d}.{ts,tsx,js,jsx,cjs}" "scripts/**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" "agent-eval/**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" | sed "/e2e-sandbox\\//d" | sed "/e2e-internal\\//d" | sed "/node_modules\\//d")',
            `echo "$TEST_FILES" | circleci tests run --command="xargs yarn test ${UNIT_TEST_REPORTERS}" --verbose`,
          ].join('\n'),
        },
      },
      testResults.persist(`test-results`),

      git.check(),
      ...workflow.cancelOnFailure(),
    ],
  }),
  [commonJobsNoOpJob]
);

const CHANGED_FILES_PATH = '/tmp/changed-files.txt';

const writeChangedFiles = (changedFiles: readonly string[]) => ({
  run: {
    name: 'Write changed files',
    environment: { CHANGED_FILES: changedFiles.join('\n') },
    command: `printf '%s\\n' "$CHANGED_FILES" > ${CHANGED_FILES_PATH}`,
  },
});

/**
 * Typecheck only the projects Nx considers affected by `changedFiles`. The restored workspace
 * already holds every compiled package, so the `compile` dependencies are skipped.
 */
export const defineAffectedCheck = (changedFiles: readonly string[]) =>
  defineJob(
    'TypeScript validation (affected)',
    () => ({
      executor: {
        name: 'sb_node_22_classic',
        class: 'xlarge',
      },
      steps: [
        ...workflow.restoreLinux(),
        writeChangedFiles(changedFiles),
        {
          run: {
            name: 'TypeCheck affected projects',
            // With Nx Cloud on, CI logs show only a cloud link per task instead of the type errors.
            environment: { NX_NO_CLOUD: 'true' },
            command: `yarn nx affected -t check --exclude-task-dependencies --parallel=4 --stdin < ${CHANGED_FILES_PATH}`,
          },
        },
        ...workflow.cancelOnFailure(),
      ],
    }),
    [commonJobsNoOpJob]
  );

const LINT_CONFIG = /(^|\/)\.oxlintrc\.json$/;
const FORMAT_CONFIG = /(^|\/)\.oxfmtrc\.json$/;

/**
 * Run `command` with the changed files under `dir` as arguments, relative to `dir`, because oxlint
 * rejects paths outside its working directory. Nothing runs when no changed file is under `dir`.
 */
const runOnChangedFiles = (
  name: string,
  dir: string,
  changedFiles: readonly string[],
  command: string
) => {
  const files = dir
    ? changedFiles
        .filter((file) => file.startsWith(`${dir}/`))
        .map((file) => file.slice(dir.length + 1))
    : changedFiles;

  return files.length === 0
    ? []
    : [
        {
          run: {
            name,
            ...(dir ? { working_directory: dir } : {}),
            environment: { FILES: files.join('\n') },
            command: `printf '%s\\n' "$FILES" | tr '\\n' '\\0' | xargs -0 ${command}`,
          },
        },
      ];
};

/**
 * Format-check and lint only the changed files. Both tools work per file, and the lint rules that
 * read other files are warnings, which `--quiet` drops. A config or global input change checks
 * everything.
 */
export const defineAffectedLintAndFormat = (changedFiles: readonly string[]) => {
  const checkAll = (config: RegExp) =>
    changedFiles.some((file) => isGlobalInput(file) || config.test(file));

  return defineJob(
    'Lint and format (affected)',
    () => ({
      executor: {
        name: 'sb_node_22_classic',
        class: 'medium',
      },
      steps: [
        ...workflow.restoreLinux(),
        ...(checkAll(FORMAT_CONFIG)
          ? [{ run: { name: 'Format check', command: 'yarn fmt:check' } }]
          : runOnChangedFiles(
              'Format check changed files',
              '',
              changedFiles,
              'yarn oxfmt --check --no-error-on-unmatched-pattern'
            )),
        ...(checkAll(LINT_CONFIG)
          ? [
              { run: { name: 'Lint code JS', working_directory: 'code', command: 'yarn lint:js' } },
              { run: { name: 'Lint scripts', working_directory: 'scripts', command: 'yarn lint' } },
            ]
          : ['code', 'scripts'].flatMap((dir) =>
              runOnChangedFiles(
                `Lint changed ${dir} files`,
                dir,
                changedFiles,
                'yarn lint:js:cmd --quiet --no-error-on-unmatched-pattern'
              )
            )),
        ...workflow.cancelOnFailure(),
      ],
    }),
    [commonJobsNoOpJob]
  );
};

/** Run the unit tests whose imports reach `changedFiles`. */
export const defineAffectedUnitTests = (changedFiles: readonly string[]) =>
  defineJob(
    'Tests (linux, affected)',
    () => ({
      executor: {
        name: 'sb_node_22_classic',
        class: 'large',
      },
      steps: [
        ...workflow.restoreLinux(),
        writeChangedFiles(changedFiles),
        {
          run: {
            name: 'Run affected tests',
            command: `NODE_OPTIONS=--max_old_space_size=4096 yarn vitest related --run --project '!storybook-ui' ${UNIT_TEST_REPORTERS} $(cat ${CHANGED_FILES_PATH})`,
          },
        },
        testResults.persist(`test-results`),

        git.check(),
        ...workflow.cancelOnFailure(),
      ],
    }),
    [commonJobsNoOpJob]
  );

export const testsStories_linux = defineJob(
  'Tests stories (linux)',
  () => ({
    executor: {
      name: 'sb_playwright',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Run stories tests',
          command: [
            'TEST_FILES=$(circleci tests glob "code/**/*.{stories}.{ts,tsx,js,jsx,cjs}" | sed "/e2e-sandbox\\//d" | sed "/e2e-internal\\//d" | sed "/node_modules\\//d")',
            'echo "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=./test-results/junit.xml" --verbose',
          ].join('\n'),
        },
      },
      testResults.persist(`test-results`),

      git.check(),
      ...workflow.cancelOnFailure(),
    ],
  }),
  [commonJobsNoOpJob]
);

export const testUnit_windows = defineJob(
  'Tests unit (windows)',
  () => ({
    executor: {
      name: 'win/default',
      size: 'large',
      shell: 'bash.exe',
    },
    steps: [
      git.checkout({ forceHttps: true }),
      node.installOnWindows(),
      workspace.attach(`${WINDOWS_ROOT_DIR}\\${WORKING_DIR}`),
      {
        run: {
          name: 'Install dependencies',
          // The unit tests load no native addon; building them only compiles agent-eval's node-gyp deps.
          command: 'yarn install --mode=skip-build',
        },
      },
      {
        run: {
          command:
            "yarn test --project '!agent-eval' --reporter=junit --reporter=default --outputFile=./test-results/junit.xml",
          name: 'Run unit tests',
        },
      },
      testResults.persist(`test-results`),
    ],
  }),
  [build_windows]
);

export const defineCircleciCompletion = (requires: JobOrNoOpJob[]) =>
  defineJob(
    'CircleCI completion',
    () => ({
      executor: {
        name: 'sb_barebones',
        class: 'small',
      },
      steps: [
        {
          run: {
            name: 'Workflow completed',
            command: 'echo "All required jobs completed successfully"',
          },
        },
      ],
    }),
    requires
  );

/** Report the failed jobs of a nightly `next` run to Slack, whatever state the workflow ends in. */
export const defineNightlyFailureReport = (completion: JobOrNoOpJob) =>
  defineJob(
    'Nightly failure report',
    () => ({
      executor: {
        name: 'sb_barebones',
        class: 'small',
      },
      steps: [
        git.checkout(),
        {
          run: {
            name: 'Report failed jobs to Slack',
            environment: {
              PIPELINE_NUMBER: '<< pipeline.number >>',
            },
            command: 'bash scripts/ci/report-nightly-failure.sh',
          },
        },
      ],
    }),
    [completion],
    { runsEvenIfRequirementsFail: true }
  );

const DOCGEN_HARNESS_DIR = 'code/lib/docgen-harness';
const DOCGEN_PERF_RESULTS_DIR = 'perf-results';

export const docgenMemoryGate = defineJob(
  'Docgen memory gate',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Docgen-server re-extraction memory gate',
          working_directory: DOCGEN_HARNESS_DIR,
          command: 'yarn bench:docgen-memory',
        },
      },
    ],
  }),
  [commonJobsNoOpJob]
);

export const docgenPerfGate = defineJob(
  'Docgen perf gate',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...workflow.restoreLinux(),
      {
        run: {
          name: 'Per-engine docgen perf budgets',
          working_directory: DOCGEN_HARNESS_DIR,
          command: `yarn bench:docgen-perf-gate --out ./${DOCGEN_PERF_RESULTS_DIR}`,
          // A full run is ~5 minutes; the ceiling covers a hung compodoc child's ten-minute kill.
          no_output_timeout: '30m',
        },
      },
      artifact.persist(
        join(LINUX_ROOT_DIR, WORKING_DIR, DOCGEN_HARNESS_DIR, DOCGEN_PERF_RESULTS_DIR),
        'docgen-perf-results'
      ),
    ],
  }),
  [commonJobsNoOpJob]
);

export const benchmarkPackages = defineJob(
  'Benchmark packages',
  () => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...workflow.restoreLinux(),
      npm.installPinnedVersion(),
      verdaccio.start(),
      server.wait([...verdaccio.ports]),
      {
        run: {
          name: 'Benchmarking packages against base branch',
          command:
            'yarn bench-packages --base-branch << pipeline.parameters.ghBaseBranch >> --pull-request << pipeline.parameters.ghPrNumber >> --upload',
          working_directory: 'scripts',
        },
      },
    ],
  }),
  [commonJobsNoOpJob]
);
