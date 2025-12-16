import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';

import { commands } from './commands';
import { executors } from './executors';
// import { allTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates';
import {
  defineSandboxFlow,
  defineSandboxTestRunner,
  defineWindowsSandboxBuild,
  defineWindowsSandboxDev,
} from './sandboxes';
import { definePortableStoryTest } from './test-storybooks';
import {
  CACHE_KEYS,
  CACHE_PATHS,
  type JobImplementation,
  WORKING_DIR,
  artifact,
  cache,
  defineJob,
  git,
  node,
  npm,
  restore,
  server,
  verdaccio,
  workspace,
} from './utils';

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
      ...restore.windows(),
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

const testStorybooksPortables = ['react', 'vue3'].map(definePortableStoryTest);
const testStorybooksPortableVitest3 = defineJob(
  'test-storybooks-portable-vitest3',
  {
    executor: {
      name: 'sb_playwright',
      class: 'medium',
    },
    steps: [
      ...restore.linux(),
      {
        run: {
          name: 'Install dependencies',
          working_directory: 'test-storybooks/portable-stories-kitchen-sink/react-vitest-3',
          command: 'yarn install --no-immutable',
          environment: {
            YARN_ENABLE_IMMUTABLE_INSTALLS: false,
          },
        },
      },
      {
        run: {
          name: 'Run Playwright E2E tests',
          working_directory: 'test-storybooks/portable-stories-kitchen-sink/react-vitest-3',
          command: 'yarn playwright-e2e',
        },
      },
    ],
  },
  ['test-storybooks']
);
const testStorybooksPNP = defineJob(
  'test-storybooks-pnp',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium',
    },
    steps: [
      ...restore.linux(),
      {
        run: {
          name: 'Install dependencies',
          working_directory: 'test-storybooks/yarn-pnp',
          command: 'yarn install --no-immutable',
          environment: {
            YARN_ENABLE_IMMUTABLE_INSTALLS: false,
          },
        },
      },
      {
        run: {
          name: 'Run Storybook smoke test',
          working_directory: 'test-storybooks/yarn-pnp',
          command: 'yarn storybook --smoke-test',
        },
      },
    ],
  },
  ['test-storybooks']
);

const sandboxes = [
  //
  'react-vite/default-ts',
  // 'react-vite/default-js',
].map(defineSandboxFlow);

const windows_sandbox_build = defineWindowsSandboxBuild(sandboxes[0]);

const windows_sandbox_dev = defineWindowsSandboxDev(sandboxes[0]);

const testRunner = defineSandboxTestRunner(sandboxes[0]);

const initEmptyWindows = defineJob(
  'init-empty-windows',
  {
    executor: {
      name: 'win/default',
      size: 'medium',
      shell: 'bash.exe',
    },
    steps: [
      ...restore.windows(),
      verdaccio.start(),
      server.wait([...verdaccio.ports]),
      {
        run: {
          name: 'Storybook init from empty directory (Windows NPM)',
          working_directory: 'C:\\Users\\circleci',
          command: [
            `mkdir empty-react-vite-ts`,
            `cd empty-react-vite-ts`,
            `npm set registry http://localhost:6001`,
            `npx storybook init --yes --package-manager npm`,
          ].join('\n'),
          environment: {
            IN_STORYBOOK_SANDBOX: true,
            STORYBOOK_DISABLE_TELEMETRY: true,
            STORYBOOK_INIT_EMPTY_TYPE: 'react-vite-ts',
          },
        },
      },
      {
        run: {
          name: 'Run storybook smoke test',
          working_directory: 'C:\\Users\\circleci\\empty-react-vite-ts',
          command: 'npm run storybook -- --smoke-test',
        },
      },
    ],
  },
  ['init-empty']
);

const defineEmptyInitFlow = (template: string) =>
  defineJob(
    `init-empty-${template}`,
    {
      executor: {
        name: 'sb_node_22_classic',
        class: 'medium',
      },
      steps: [
        ...restore.linux(),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        {
          run: {
            name: 'Storybook init from empty directory (Linux NPM)',
            working_directory: '/tmp',
            command: [
              `mkdir empty-${template}`,
              `cd empty-${template}`,
              `npm set registry http://localhost:6001`,
              `npx storybook init --yes --package-manager npm`,
            ].join('\n'),
            environment: {
              IN_STORYBOOK_SANDBOX: true,
              STORYBOOK_DISABLE_TELEMETRY: true,
              STORYBOOK_INIT_EMPTY_TYPE: template,
            },
          },
        },
        {
          run: {
            name: 'Run storybook smoke test',
            working_directory: `/tmp/empty-${template}`,
            command: 'npm run storybook -- --smoke-test',
          },
        },
      ],
    },

    ['init-empty']
  );
const initEmptyLinux = ['react-vite-ts', 'nextjs-ts', 'vue-vite-ts', 'lit-vite-ts'].map(
  defineEmptyInitFlow
);

const initFeatures = defineJob(
  'init-features',
  {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium',
    },
    steps: [
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
      verdaccio.start(),
      server.wait([...verdaccio.ports]),
      {
        run: {
          name: 'Storybook init from empty directory (Linux NPM)',
          working_directory: '/tmp',
          command: [
            `mkdir empty-react-vite-ts`,
            `cd empty-react-vite-ts`,
            `npm set registry http://localhost:6001`,
            `npx create-storybook --yes --package-manager npm --features docs test a11y --loglevel=debug`,
          ].join('\n'),
          environment: {
            IN_STORYBOOK_SANDBOX: true,
            STORYBOOK_DISABLE_TELEMETRY: true,
            STORYBOOK_INIT_EMPTY_TYPE: 'react-vite-ts',
          },
        },
      },
      {
        run: {
          name: 'Run storybook smoke test',
          working_directory: `/tmp/empty-react-vite-ts`,
          command: 'npx vitest',
        },
      },
    ],
  },
  ['init-empty']
);

const jobs = {
  [linux_build.id]: linux_build.implementation,
  [windows_build.id]: windows_build.implementation,
  [check.id]: check.implementation,
  [knip.id]: knip.implementation,
  [uiTests.id]: uiTests.implementation,
  [linux_unitTests.id]: linux_unitTests.implementation,
  [windows_unitTests.id]: windows_unitTests.implementation,
  [packageBenchmarks.id]: packageBenchmarks.implementation,
  [windows_sandbox_build.id]: windows_sandbox_build.implementation,
  'pretty-docs': {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium+',
    },
    steps: [
      git.checkout(),
      npm.install('.'),
      {
        run: {
          name: 'Prettier',
          working_directory: `scripts`,
          command: 'yarn docs:prettier:check',
        },
      },
    ],
  },
  sandboxes: {
    type: 'no-op',
  },
  ...sandboxes.reduce(
    (acc, sandbox) => {
      for (const job of sandbox.jobs) {
        acc[job.id] = job.implementation;
      }

      return acc;
    },
    {} as Record<string, JobImplementation>
  ),
  [windows_sandbox_dev.id]: windows_sandbox_dev.implementation,
  [windows_sandbox_build.id]: windows_sandbox_build.implementation,

  ['test-storybooks']: {
    type: 'no-op',
  },
  [testStorybooksPNP.id]: testStorybooksPNP.implementation,
  ...testStorybooksPortables.reduce(
    (acc, test) => {
      acc[test.id] = test.implementation;
      return acc;
    },
    {} as Record<string, JobImplementation>
  ),
  [testStorybooksPortableVitest3.id]: testStorybooksPortableVitest3.implementation,
  ['init-empty']: {
    type: 'no-op',
  },
  [initEmptyWindows.id]: initEmptyWindows.implementation,
  ...initEmptyLinux.reduce(
    (acc, init) => {
      acc[init.id] = init.implementation;
      return acc;
    },
    {} as Record<string, JobImplementation>
  ),
  [initFeatures.id]: initFeatures.implementation,
  [testRunner.id]: testRunner.implementation,
};

const orbs = {
  'browser-tools': 'circleci/browser-tools@2.3.2',
  codecov: 'codecov/codecov@5.4.3',
  discord: 'antonioned/discord@0.1.0',
  'git-shallow-clone': 'guitarrapc/git-shallow-clone@2.8.0',
  node: 'circleci/node@7.2.1',
  nx: 'nrwl/nx@1.7.0',
  win: 'circleci/windows@5.1.1',
};

const parameters = {
  ghBaseBranch: {
    default: 'next',
    description: 'The name of the base branch (the target of the PR)',
    type: 'string',
  },
  ghPrNumber: {
    default: '',
    description: 'The PR number',
    type: 'string',
  },
  workflow: {
    default: 'skipped',
    description: 'Which workflow to run',
    enum: ['normal', 'merged', 'daily', 'skipped', 'docs'],
    type: 'enum',
  },
};

const workflows = {
  generated: {
    jobs: [
      'pretty-docs',
      linux_build.id,
      windows_build.id,
      {
        [check.id]: {
          requires: check.requires,
        },
      },
      {
        [knip.id]: {
          requires: knip.requires,
        },
      },
      {
        [packageBenchmarks.id]: {
          requires: packageBenchmarks.requires,
        },
      },
      {
        [linux_unitTests.id]: {
          requires: linux_unitTests.requires,
        },
      },
      {
        [windows_unitTests.id]: {
          requires: windows_unitTests.requires,
        },
      },
      {
        [uiTests.id]: {
          requires: uiTests.requires,
        },
      },
      {
        sandboxes: {
          requires: [linux_build.id],
        },
      },
      ...sandboxes.flatMap((sandbox) => sandbox.workflow),
      {
        [windows_sandbox_dev.id]: {
          requires: windows_sandbox_dev.requires,
        },
      },
      {
        [windows_sandbox_build.id]: {
          requires: windows_sandbox_build.requires,
        },
      },
      {
        ['test-storybooks']: {
          requires: [linux_build.id],
        },
      },
      {
        [testStorybooksPNP.id]: {
          requires: testStorybooksPNP.requires,
        },
      },
      ...testStorybooksPortables.map((test) => ({
        [test.id]: {
          requires: test.requires,
        },
      })),
      {
        [testStorybooksPortableVitest3.id]: {
          requires: testStorybooksPortableVitest3.requires,
        },
      },
      {
        ['init-empty']: {
          requires: [linux_build.id],
        },
      },
      {
        [initEmptyWindows.id]: {
          requires: initEmptyWindows.requires,
        },
      },
      ...initEmptyLinux.map((init) => ({
        [init.id]: {
          requires: init.requires,
        },
      })),
      {
        [initFeatures.id]: {
          requires: initFeatures.requires,
        },
      },
      {
        [testRunner.id]: {
          requires: testRunner.requires,
        },
      },
    ],
  },
};

export const data = {
  version: 2.1,
  orbs,
  commands,
  executors,
  parameters,

  jobs: Object.fromEntries(Object.entries(jobs).sort(([a], [b]) => a.localeCompare(b))),
  workflows: {
    generated: {
      jobs: workflows.generated.jobs.sort((a, b) => {
        if (typeof a == 'string' && typeof b == 'string') {
          return a.localeCompare(b);
        }
        if (typeof a == 'string') {
          return -1;
        }
        if (typeof b == 'string') {
          return 1;
        }
        return Object.keys(a)[0].localeCompare(Object.keys(b)[0]);
      }),
    },
  },
};
