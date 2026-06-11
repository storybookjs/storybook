// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';
import { join } from 'path/posix';

import { LINUX_ROOT_DIR, WINDOWS_ROOT_DIR, WORKING_DIR } from './utils/constants.ts';
import {
  CACHE_KEYS,
  CACHE_PATHS,
  artifact,
  cache,
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
import { defineJob, defineNoOpJob } from './utils/types.ts';

const dirname = import.meta.dirname;

export const build_linux = defineJob('Build (linux)', (workflowName) => ({
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    cache.attach(CACHE_KEYS()),
    npm.install('.'),
    ...(isTrustedAuthor() ? [cache.persist(CACHE_PATHS, CACHE_KEYS()[0])] : []),
    npm.check(),
    {
      run: {
        name: 'Compile',
        working_directory: `code`,
        command: 'yarn task --task compile --start-from=auto --no-link --debug',
      },
    },
    {
      run: {
        name: 'Publish to Verdaccio',
        working_directory: `code`,
        command: 'yarn local-registry --publish',
      },
    },
    git.check(),
    ...workflow.reportOnFailure(workflowName),
    artifact.persist(`code/bench/esbuild-metafiles`, 'bench'),
    workspace.persist([
      // Workspace-root node_modules folders. Yarn hoists shared/singleton
      // dependencies (e.g. `oxc-parser`, `vitest`, `type-fest`) here rather than
      // into the per-package `code/<pkg>/node_modules` folders below. Downstream
      // jobs otherwise only receive these via the shared `save_cache`, which is
      // gated on `isTrustedAuthor()` — so community/fork PRs end up with a
      // freshly-built `dist` but no root `node_modules`, producing errors like
      // `Cannot find package 'oxc-parser'`. Persisting them to the (pipeline-
      // scoped, un-gated) workspace makes downstream jobs correct for every PR.
      `${WORKING_DIR}/node_modules`,
      `${WORKING_DIR}/code/node_modules`,
      `${WORKING_DIR}/scripts/node_modules`,
      ...glob
        .sync(['*/src', '*/*/src'], {
          cwd: join(dirname, '../../code'),
          onlyDirectories: true,
        })
        .flatMap((p) => [
          `${WORKING_DIR}/code/${p.replace('src', 'dist')}`,
          `${WORKING_DIR}/code/${p.replace('src', 'node_modules')}`,
        ]),
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
    npm.install('.'),
    {
      run: {
        name: 'Format check',
        command: 'yarn fmt:check',
      },
    },
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
    npm.install('.'),
    {
      run: {
        name: 'Compile',
        working_directory: `code`,
        command: 'yarn task --task compile --start-from=auto --no-link --debug',
      },
    },
    git.check(),
    verdaccio.start(),
    workspace.persist(
      [
        ...glob
          .sync(['*/src', '*/*/src'], {
            cwd: join(dirname, '../../code'),
            onlyDirectories: true,
          })
          .flatMap((p) => [
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
  (workflowName) => ({
    executor: {
      name: 'sb_playwright',
      class: 'medium+',
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
      ...workflow.reportOnFailure(workflowName),
    ],
  }),
  [commonJobsNoOpJob]
);

export const check = defineJob(
  'TypeScript validation',
  (workflowName) => ({
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
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
      ...workflow.reportOnFailure(workflowName),
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

export const testsUnit_linux = defineJob(
  'Tests (linux)',
  (workflowName) => ({
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
            'TEST_FILES=$(circleci tests glob "code/**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" "scripts/**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" | sed "/e2e-sandbox\\//d" | sed "/e2e-internal\\//d" | sed "/node_modules\\//d")',
            'echo "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=./test-results/junit.xml" --verbose',
          ].join('\n'),
        },
      },
      testResults.persist(`test-results`),

      git.check(),
      ...workflow.reportOnFailure(workflowName),
      ...workflow.cancelOnFailure(),
    ],
  }),
  [commonJobsNoOpJob]
);

export const testsStories_linux = defineJob(
  'Tests stories (linux)',
  (workflowName) => ({
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
      ...workflow.reportOnFailure(workflowName),
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
      ...workflow.restoreWindows(`${WINDOWS_ROOT_DIR}\\${WORKING_DIR}`),
      {
        run: {
          command: 'yarn install',
          name: 'Install dependencies',
        },
      },
      {
        run: {
          command:
            'yarn test --reporter=junit --reporter=default --outputFile=./test-results/junit.xml',
          name: 'Run unit tests',
        },
      },
      testResults.persist(`test-results`),
    ],
  }),
  [build_windows]
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
