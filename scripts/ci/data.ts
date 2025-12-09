import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';

import {
  ROOT_DIR,
  SANDBOX_DIR,
  WORKING_DIR,
  artifact,
  cache,
  git,
  node,
  npm,
  server,
  toId,
  verdaccio,
  workspace,
} from './utils';

const CACHE_KEYS = (platform = 'linux') =>
  [
    `v4-${platform}-node_modules`,
    '{{ checksum ".nvmrc" }}',
    '{{ checksum ".yarnrc.yml" }}',
    '{{ checksum "yarn.lock" }}',
  ].map((_, index, list) => {
    return list.slice(0, list.length - index).join('/');
  });
const CACHE_PATHS = [
  '.yarn/cache',
  '.yarn/unplugged',
  '.yarn/build-state.yml',
  '.yarn/root-install-state.gz',
  'node_modules',
  'code/node_modules',
  'scripts/node_modules',
];

const dirname = import.meta.dirname;

const commands = {
  'cancel-workflow-on-failure': {
    description: 'Cancels the entire workflow in case the previous step has failed',
    steps: [
      {
        run: {
          command:
            'echo "Canceling workflow as previous step resulted in failure."\necho "To execute all checks locally, please run yarn ci-tests"\ncurl -X POST --header "Content-Type: application/json" "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/cancel?circle-token=${WORKFLOW_CANCELER}"\n',
          name: 'Cancel current workflow',
          when: 'on_fail',
        },
      },
    ],
  },
  'report-workflow-on-failure': {
    description: 'Reports failures to discord',
    parameters: {
      template: {
        default: 'none',
        description: 'Which template to report in discord. Applicable for parallel sandbox jobs\n',
        type: 'string',
      },
    },
    steps: [
      git.unshallow(),
      {
        'discord/status': {
          fail_only: true,
          failure_message:
            '$(yarn get-report-message << pipeline.parameters.workflow >> << parameters.template >>)',
          only_for_branches: 'main,next,next-release,latest-release',
        },
      },
    ],
  },
  'start-event-collector': {
    description: 'Starts the event collector',
    steps: [
      {
        run: {
          background: true,
          command: 'yarn jiti ./event-log-collector.ts',
          name: 'Start Event Collector',
          working_directory: 'scripts',
        },
      },
    ],
  },
};
const executors = {
  sb_node_18_browsers: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:18.20.3-browsers',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_node_22_browsers: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:22.15.0-browsers',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_node_22_classic: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:22.15.0',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_playwright: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'mcr.microsoft.com/playwright:v1.52.0-noble',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${ROOT_DIR}/${WORKING_DIR}`,
  },
} as const;

type SomethingImplementation = {
  executor:
    | {
        name: keyof typeof executors;
        class: 'small' | 'medium' | 'medium+' | 'large' | 'xlarge';
      }
    | {
        name: 'win/default';
        size: 'small' | 'medium' | 'medium+' | 'large' | 'xlarge';
      };
  steps: unknown[];
  parameters?: Record<string, unknown>;
  parallelism?: number;
};

function defineJob<K extends string, I extends SomethingImplementation>(
  name: K,
  implementation: I,
  requires = [] as string[]
) {
  return {
    id: toId(name),
    name,
    implementation: {
      description: name,
      ...implementation,
    },
    requires,
  };
}

function defineSandboxFlow<K extends string>(name: K) {
  const id = toId(name);
  const names = {
    create: `${name} (create)`,
    build: `${name} (build)`,
    dev: `${name} (dev)`,
  };
  const ids = {
    create: `${toId(names.create)}`,
    build: `${toId(names.build)}`,
    dev: `${toId(names.dev)}`,
  };
  const jobs = [
    defineJob(
      names.create,
      {
        executor: {
          name: 'sb_node_22_browsers',
          class: 'large',
        },
        steps: [
          git.checkout(),
          workspace.attach(),
          cache.attach(CACHE_KEYS()),
          verdaccio.start(),
          {
            run: {
              name: 'Start Event Collector',
              working_directory: `scripts`,
              background: true,
              command: 'yarn jiti ./event-log-collector.ts',
            },
          },
          server.wait([...verdaccio.ports, '6007']),
          {
            run: {
              name: 'Setup Corepack',
              command: [
                //
                'sudo corepack enable',
                'which yarn',
                'yarn --version',
              ].join('\n'),
            },
          },
          {
            run: {
              name: 'Create Sandboxes',
              command: `yarn task sandbox --template ${name} --no-link -s sandbox --debug`,
              environment: {
                STORYBOOK_TELEMETRY_DEBUG: 1,
                STORYBOOK_TELEMETRY_URL: 'http://127.0.0.1:6007/event-log',
              },
            },
          },
          artifact.persist(`${ROOT_DIR}/${SANDBOX_DIR}/${id}/debug-storybook.log`, 'logs'),
          workspace.persist([`${SANDBOX_DIR}/${id}`]),
        ],
      },
      ['sandboxes']
    ),
    defineJob(
      names.build,
      {
        executor: {
          name: 'sb_playwright',
          class: 'xlarge',
        },
        steps: [
          git.checkout(),
          workspace.attach(),
          cache.attach(CACHE_KEYS()),
          {
            run: {
              name: 'Build storybook',
              command: `yarn task build --template ${name} --no-link -s build`,
            },
          },
          {
            run: {
              name: 'Serve storybook',
              background: true,
              command: `yarn task serve --template ${name} --no-link -s serve`,
            },
          },
          server.wait(['8001']),
          {
            run: {
              name: 'Running E2E Tests',
              command: [
                `TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")`,
                `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests --template ${name} --no-link -s never" --verbose --index=0 --total=1`,
              ].join('\n'),
            },
          },
        ],
      },
      [ids.create]
    ),
    defineJob(
      names.dev,
      {
        executor: {
          class: 'xlarge',
          name: 'sb_playwright',
        },
        steps: [
          git.checkout(),
          workspace.attach(),
          cache.attach(CACHE_KEYS()),
          {
            run: {
              name: 'Run storybook',
              working_directory: 'code',
              background: true,
              command: `yarn task dev --template ${name} --no-link -s dev`,
            },
          },
          server.wait(['6006']),
          {
            run: {
              name: 'Running E2E Tests',
              command: [
                'TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")',
                `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests-dev --template ${name} --no-link -s never" --verbose --index=0 --total=1`,
              ].join('\n'),
            },
          },
        ],
      },
      [ids.create]
    ),
  ];
  return {
    jobs,
    workflow: jobs.map((job) => {
      return {
        [job.id]: {
          requires: job.requires,
        },
      };
    }),
  };
}

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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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
      git.check(),
      'report-workflow-on-failure',
      'cancel-workflow-on-failure',
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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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
      git.checkout({ forceHttps: true }),
      node.installOnWindows(),
      workspace.attach('C:\\Users\\circleci\\project'),
      // cache.attach(CACHE_KEYS('windows')),
      /**
       * I really wish this wasn't needed, but it is. I tried a lot of things to get it to not be
       * needed, but ultimately, something kept failing. At this point I gave up:
       * https://app.circleci.com/pipelines/github/storybookjs/storybook/110923/workflows/50076187-a5a7-4955-bff4-30bf9aec465c/jobs/976355
       *
       * So if you see a way to debug/solve those failing tests, please do so.
       */
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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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

const sandboxes = [
  //
  'react-vite/default-ts',
  // 'react-vite/default-js',
].map(defineSandboxFlow);

const windows_sandbox_build = defineJob(
  `${sandboxes[0].jobs[1].id}-windows`,
  {
    executor: {
      name: 'win/default',
      size: 'xlarge',
      shell: 'bash.exe',
    },
    steps: [
      git.checkout({ forceHttps: true }),
      node.installOnWindows(),
      workspace.attach('C:\\Users\\circleci'),
      {
        run: {
          name: 'Install dependencies',
          command: 'yarn install',
        },
      },
      verdaccio.start(),
      server.wait([...verdaccio.ports]),
      // {
      //   run: {
      //     name: 'Run Install',
      //     working_directory: `C:\\Users\\circleci\\sandboxes\\react-vite\\default-ts`,
      //     command: 'yarn install',
      //   },
      // },
      // {
      //   run: {
      //     name: 'Install playwright',
      //     working_directory: `C:\\Users\\circleci\\sandboxes\\react-vite\\default-ts`,
      //     command: 'yarn playwright install chromium --with-deps',
      //   },
      // },
      // {
      //   run: {
      //     name: 'Build storybook',
      //     working_directory: `C:\\Users\\circleci\\sandboxes\\react-vite\\default-ts`,
      //     command: 'yarn build-storybook',
      //   },
      // },
    ],
  },
  [sandboxes[0].jobs[0].id]
);

const windows_sandbox_dev = defineJob(
  `${sandboxes[0].jobs[2].id}-windows`,
  {
    executor: {
      name: 'win/default',
      size: 'xlarge',
      shell: 'bash.exe',
    },
    steps: [
      git.checkout({ forceHttps: true }),
      node.installOnWindows(),
      workspace.attach('C:\\Users\\circleci\\project'),
      {
        run: {
          name: 'Install dependencies',
          command: 'yarn install',
        },
      },
    ],
  },
  [sandboxes[0].jobs[0].id]
);

const jobs = {
  [linux_build.id]: linux_build.implementation,
  [windows_build.id]: windows_build.implementation,
  [check.id]: check.implementation,
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
    {} as Record<string, SomethingImplementation>
  ),
  [windows_sandbox_dev.id]: windows_sandbox_dev.implementation,
  [windows_sandbox_build.id]: windows_sandbox_build.implementation,
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
    ],
    when: {
      equal: ['docs', '<< pipeline.parameters.workflow >>'],
    },
  },
};

export const data = {
  version: 2.1,
  orbs,
  commands,
  executors,
  parameters,

  jobs,
  workflows,
};
