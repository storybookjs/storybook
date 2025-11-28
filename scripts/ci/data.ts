import os from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';

import { ROOT_DIR, WORKING_DIR, artifact, cache, git, npm, toId, workspace } from './utils';

const PLATFORM = os.platform();
const CACHE_KEYS = [
  `${PLATFORM}-node_modules`,
  '{{ checksum ".nvmrc" }}',
  '{{ checksum ".yarnrc.yml" }}',
  '{{ checksum "yarn.lock" }}',
].map((_, index, list) => {
  return list.slice(0, list.length - index).join('/');
});
const CACHE_PATHS = [
  '.yarn/code-install-state.gz',
  '.yarn/scripts-install-state.gz',
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
      {
        run: {
          command: 'git fetch --unshallow',
          when: 'on_fail',
        },
      },
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
    working_directory: `${ROOT_DIR}${WORKING_DIR}`,
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
    working_directory: `${ROOT_DIR}${WORKING_DIR}`,
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
    working_directory: `${ROOT_DIR}${WORKING_DIR}`,
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
    working_directory: `${ROOT_DIR}${WORKING_DIR}`,
  },
};

type SomethingImplementation = {
  executor: {
    class: string;
    name: string;
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
          cache.attach(CACHE_KEYS),
          {
            run: {
              name: 'Verdaccio',
              working_directory: `${WORKING_DIR}/code`,
              background: true,
              command: 'yarn local-registry --open',
            },
          },
          {
            run: {
              name: 'Start Event Collector',
              working_directory: `${WORKING_DIR}/scripts`,
              background: true,
              command: 'yarn jiti ./event-log-collector.ts',
            },
          },
          {
            run: {
              name: 'Wait on servers',
              working_directory: `${WORKING_DIR}/code`,
              command: [
                'yarn wait-on tcp:127.0.0.1:6001', // verdaccio
                'yarn wait-on tcp:127.0.0.1:6002', // reverse proxy
                'yarn wait-on tcp:127.0.0.1:6007', // event collector
              ].join('\n'),
            },
          },
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
          artifact.persist(`${ROOT_DIR}/storybook-sandboxes/${id}/debug-storybook.log`, 'logs'),
          workspace.persist([`${ROOT_DIR}/storybook-sandboxes/${id}`]),
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
          cache.attach(CACHE_KEYS),
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
          {
            run: {
              name: 'Wait on storybook',
              working_directory: `${WORKING_DIR}/code`,
              command: 'yarn wait-on tcp:127.0.0.1:8001',
            },
          },
          {
            run: {
              name: 'Running E2E Tests',
              command: [
                `TEST_FILES=$(circleci tests glob "${WORKING_DIR}/code/e2e-tests/*.{test,spec}.{ts,js,mjs}")`,
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
          cache.attach(CACHE_KEYS),
          {
            run: {
              name: 'Run storybook',
              working_directory: 'code',
              background: true,
              command: `yarn task dev --template ${name} --no-link -s dev`,
            },
          },
          {
            run: {
              name: 'Wait on storybook',
              working_directory: 'code',
              command: 'yarn wait-on tcp:127.0.0.1:6006',
            },
          },
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

const build = defineJob('build', {
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    npm.install(WORKING_DIR),
    cache.persist(CACHE_PATHS, CACHE_KEYS[0]),
    git.check(),
    npm.check(),
    {
      run: {
        command: 'yarn task --task compile --start-from=auto --no-link --debug',
        name: 'Compile',
        working_directory: `${WORKING_DIR}/code`,
      },
    },
    {
      run: {
        command: 'yarn local-registry --publish',
        name: 'Publish to Verdaccio',
        working_directory: `${WORKING_DIR}/code`,
      },
    },
    'report-workflow-on-failure',
    artifact.persist(`${WORKING_DIR}/code/bench/esbuild-metafiles`, 'bench'),
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
    ]),
  ],
});

const check = defineJob('check', {
  executor: {
    class: 'xlarge',
    name: 'sb_node_22_classic',
  },
  steps: [
    git.checkout(),
    workspace.attach(),
    cache.attach(CACHE_KEYS),
    {
      run: {
        name: 'TypeCheck code',
        working_directory: `${WORKING_DIR}/code`,
        command: 'yarn task --task check --no-link',
      },
    },
    {
      run: {
        name: 'TypeCheck scripts',
        working_directory: `${WORKING_DIR}/scripts`,
        command: 'yarn check',
      },
    },
    git.check(),
    'report-workflow-on-failure',
    'cancel-workflow-on-failure',
  ],
});

const unitTests = defineJob('unit-tests', {
  executor: {
    name: 'sb_node_22_classic',
    class: 'xlarge',
  },
  steps: [
    git.checkout(),
    workspace.attach(),
    cache.attach(CACHE_KEYS),
    {
      run: {
        name: 'Run tests',
        working_directory: `${WORKING_DIR}/code`,
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
});

const sandboxes = [
  //
  'react-vite/default-ts',
  // 'react-vite/default-js',
].map(defineSandboxFlow);

const jobs = {
  [build.id]: build.implementation,
  [check.id]: check.implementation,
  [unitTests.id]: unitTests.implementation,
  'pretty-docs': {
    executor: {
      name: 'sb_node_22_classic',
      class: 'medium',
    },
    steps: [
      git.checkout(),
      npm.install(WORKING_DIR),
      {
        run: {
          name: 'Prettier',
          working_directory: `${WORKING_DIR}/scripts`,
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
  docs: {
    jobs: [
      'pretty-docs',
      build.id,
      {
        [check.id]: {
          requires: [build.id],
        },
      },
      {
        [unitTests.id]: {
          requires: [build.id],
        },
      },
      {
        sandboxes: {
          requires: [build.id],
        },
      },
      ...sandboxes.flatMap((sandbox) => sandbox.workflow),
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
