import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';

import { getInitEmpty, initEmptyHub } from './init-empty';
import { getSandboxes, sandboxesHub } from './sandboxes';
import { getTestStorybooks, testStorybooksHub } from './test-storybooks';
import { commands } from './utils/commands';
import { executors } from './utils/executors';
import {
  CACHE_KEYS,
  CACHE_PATHS,
  WORKING_DIR,
  artifact,
  cache,
  git,
  node,
  npm,
  restore,
  server,
  verdaccio,
  workspace,
} from './utils/helpers';
import { orbs } from './utils/orbs';
import { parameters } from './utils/parameters';
import {
  type JobImplementation,
  type Workflow,
  type defineHub,
  defineJob,
  isWorkflowOrAbove,
} from './utils/types';

const dirname = import.meta.dirname;

const linux_build = defineJob('build-linux', {
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
    'report-workflow-on-failure',
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

const prettyDocs = defineJob('pretty-docs', {
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

const windows_build = defineJob('build-windows', {
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
    // {
    //   run: {
    //     name: 'Convert symlinks to real directories',
    //     command: 'yarn windows:unlink',
    //     working_directory: `scripts`,
    //   },
    // },
    // cache.persist(
    //   // CACHE_PATHS.map((path) => 'C:\\Users\\circleci\\project\\' + path),
    //   CACHE_PATHS,
    //   CACHE_KEYS('windows')[0]
    // ),
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

const uiTests = defineJob(
  'ui',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      ...restore.linux(),
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
      'report-workflow-on-failure',
      {
        store_test_results: {
          path: `test-results`,
        },
      },
    ],
  },
  [linux_build.id]
);

const check = defineJob(
  'check',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...restore.linux(),
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
      'report-workflow-on-failure',
      'cancel-workflow-on-failure',
    ],
  },
  [linux_build.id]
);

const lint = defineJob(
  'lint',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...restore.linux(),
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
      'report-workflow-on-failure',
      'cancel-workflow-on-failure',
    ],
  },
  [linux_build.id]
);

const knip = defineJob(
  'knip',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...restore.linux(),
      {
        run: {
          name: 'Run Knip',
          working_directory: `code`,
          command: 'yarn knip --no-exit-code',
        },
      },
    ],
  },
  [linux_build.id]
);

const linux_unitTests = defineJob(
  'unit-tests-linux',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...restore.linux(),
      {
        run: {
          name: 'Run tests',
          working_directory: `code`,
          command:
            'TEST_FILES=$(circleci tests glob "**/*.{test,spec}.{ts,tsx,js,jsx,cjs}" | sed "/^e2e-tests\\//d" | sed "/^node_modules\\//d")\necho "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=../test-results/junit-${CIRCLE_NODE_INDEX}.xml" --verbose',
        },
      },
      {
        store_test_results: {
          path: `${WORKING_DIR}/test-results`,
        },
      },
      git.check(),
      'report-workflow-on-failure',
      'cancel-workflow-on-failure',
    ],
  },
  [linux_build.id]
);

const windows_unitTests = defineJob(
  'unit-tests-windows',
  {
    executor: {
      name: 'win/default',
      size: 'medium',
      shell: 'bash.exe',
    },
    steps: [
      ...restore.windows('C:\\Users\\circleci\\project'),
      {
        run: {
          command: 'yarn install',
          name: 'Install dependencies',
        },
      },
      {
        run: {
          command: 'yarn test',
          name: 'Run unit tests',
          working_directory: `code`,
        },
      },
    ],
  },
  [windows_build.id]
);

const packageBenchmarks = defineJob(
  'package-benchmarks',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'xlarge',
    },
    steps: [
      ...restore.linux(),
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
  [linux_build.id]
);

export default function generateConfig(workflow: Workflow) {
  const todos: (ReturnType<typeof defineJob> | ReturnType<typeof defineHub>)[] = [];
  if (isWorkflowOrAbove(workflow, 'docs')) {
    todos.push(prettyDocs);
  } else {
    const sandboxes = getSandboxes(workflow);
    const testStorybooks = getTestStorybooks(workflow);
    const initEmpty = getInitEmpty(workflow);

    if (isWorkflowOrAbove(workflow, 'merged')) {
      todos.push(windows_build, windows_unitTests);
    }

    todos.push(
      linux_build,
      lint,
      check,
      knip,
      uiTests,
      linux_unitTests,
      packageBenchmarks,

      sandboxesHub,
      ...sandboxes,

      testStorybooksHub,
      ...testStorybooks,

      initEmptyHub,
      ...initEmpty
    );
  }

  const sorted = todos.sort((a, b) => {
    if (a.requires.length && b.requires.length) {
      return a.requires.length - b.requires.length;
    }
    if (a.requires.length) {
      return 1;
    }
    if (b.requires.length) {
      return -1;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    version: 2.1,
    orbs,
    commands,
    executors,
    parameters,

    jobs: sorted.reduce(
      (acc, job) => {
        acc[job.id] = job.implementation;
        return acc;
      },
      {} as Record<string, JobImplementation | { type: 'no-op' }>
    ),
    workflows: {
      generated: {
        jobs: sorted.map((t) =>
          t.requires && t.requires.length > 0 ? { [t.id]: { requires: t.requires } } : t.id
        ),
      },
    },
  };
}
