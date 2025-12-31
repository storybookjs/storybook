// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';
import { join } from 'path/posix';

import { WORKING_DIR } from './utils/constants';
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
} from './utils/helpers';
import { defineHub, defineJob } from './utils/types';

const dirname = import.meta.dirname;

export const build_linux = defineJob('Build (linux)', {
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    npm.install('.'),
    cache.persist(CACHE_PATHS, CACHE_KEYS()[0]),
    git.check(),
    npm.check(),
    {
      run: {
        command: 'yarn task --task compile --start-from=auto --no-link --debug',
        name: 'Compile',
        working_directory: `code`,
      },
    },
    {
      run: {
        command: 'yarn local-registry --publish',
        name: 'Publish to Verdaccio',
        working_directory: `code`,
      },
    },
    ...workflow.report_on_failure(),
    artifact.persist(`code/bench/esbuild-metafiles`, 'bench'),
    workspace.persist([
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
});

export const prettyDocs = defineJob('Prettify docs', {
  executor: {
    name: 'sb_node_22_classic',
    class: 'medium+',
  },
  steps: [
    git.checkout(),
    npm.installScripts(),
    {
      run: {
        name: 'Prettier',
        working_directory: `scripts`,
        command: 'yarn docs:prettier:check',
      },
    },
  ],
});

export const build_windows = defineJob('Build (windows)', {
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
    {
      run: {
        name: 'Publish to Verdaccio',
        working_directory: `code`,
        command: 'yarn local-registry --publish',
      },
    },
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
      'C:\\Users\\circleci\\project'
    ),
  ],
});

export const codeHub = defineHub('code', [build_linux]);

export const storybookChromatic = defineJob(
  'Local storybook & chromatic',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...workflow.restore_linux(),
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
  },
  [codeHub]
);

export const check = defineJob(
  'TypeScript validation',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
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
      ...workflow.report_on_failure(),
      ...workflow.cancel_on_failure(),
    ],
  },
  [codeHub]
);

export const lint = defineJob(
  'EsLint & Prettier validation',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
      {
        run: {
          name: 'Lint code',
          working_directory: `code`,
          command: 'yarn lint',
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
  },
  [codeHub]
);

export const knip = defineJob(
  'Knip validation',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
      {
        run: {
          name: 'Run Knip',
          working_directory: `code`,
          command: 'yarn knip --no-exit-code',
        },
      },
    ],
  },
  [codeHub]
);

export const testsUnit_linux = defineJob(
  'Tests (linux)',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
      {
        run: {
          name: 'Run tests',
          working_directory: `code`,
          command: [
            'TEST_FILES=$(circleci tests glob "**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" | sed "/^e2e-tests\\//d" | sed "/^node_modules\\//d")',
            'echo "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=./test-results/junit.xml" --verbose',
          ].join('\n'),
        },
      },
      testResults.persist(`code/test-results`),

      git.check(),
      ...workflow.report_on_failure(),
      ...workflow.cancel_on_failure(),
    ],
  },
  [codeHub]
);

export const testsStories_linux = defineJob(
  'Tests stories (linux)',
  {
    executor: {
      name: 'sb_playwright',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
      {
        run: {
          name: 'Run stories tests',
          working_directory: `code`,
          command: [
            'TEST_FILES=$(circleci tests glob "**/*.{stories}.{ts,tsx,js,jsx,cjs}" | sed "/^e2e-tests\\//d" | sed "/^node_modules\\//d")',
            'echo "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=./test-results/junit.xml" --verbose',
          ].join('\n'),
        },
      },
      testResults.persist(`code/test-results`),

      git.check(),
      ...workflow.report_on_failure(),
      ...workflow.cancel_on_failure(),
    ],
  },
  [codeHub]
);

export const testUnit_windows = defineJob(
  'Tests unit (windows)',
  {
    executor: {
      name: 'win/default',
      size: 'medium',
      shell: 'bash.exe',
    },
    steps: [
      ...workflow.restore_windows('C:\\Users\\circleci\\project'),
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
          working_directory: `code`,
        },
      },
      testResults.persist(`code/test-results`),
    ],
  },
  [build_windows]
);

export const benchmarkPackages = defineJob(
  'Benchmark packages',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...workflow.restore_linux(),
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
  },
  [codeHub]
);
