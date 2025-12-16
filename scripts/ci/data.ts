import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';

import { allTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates';
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
    `v5-${platform}-node_modules`,
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

type JobImplementation = {
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

function defineJob<K extends string, I extends JobImplementation>(
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
  const data = allTemplates[name as keyof typeof allTemplates];
  const { skipTasks } = data;

  const path = name.replace('/', '-');

  const names = {
    create: `${name} (create)`,
    build: `${name} (build)`,
    dev: `${name} (dev)`,
    chromatic: `${name} (chromatic)`,
    vitest: `${name} (vitest)`,
    ['test-runner']: `${name} (test-runner)`,
  };
  const ids = {
    create: `${toId(names.create)}`,
    build: `${toId(names.build)}`,
    dev: `${toId(names.dev)}`,
    chromatic: `${toId(names.chromatic)}`,
    vitest: `${toId(names.vitest)}`,
    ['test-runner']: `${toId(names['test-runner'])}`,
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
    defineSandboxJob_build({
      directory: id,
      name: names.build,
      template: name,
      needs: [ids.create],
      options: {
        e2e: !skipTasks?.includes('e2e-tests'),
        chromatic: !skipTasks?.includes('chromatic'),
      },
    }),
    defineSandboxJob_dev({
      name: names.dev,
      template: name,
      needs: [ids.create],
      options: { e2e: !skipTasks?.includes('e2e-tests-dev') },
    }),
    !skipTasks?.includes('chromatic')
      ? defineJob(
          names.chromatic,
          {
            executor: {
              name: 'sb_node_22_classic',
              class: 'medium',
            },
            steps: [
              'checkout',
              workspace.attach(),
              cache.attach(CACHE_KEYS()),
              {
                // we copy to the working directory to get git history, which chromatic needs for baselines
                run: {
                  name: 'Copy sandbox to working directory',
                  command: `cp ${join(ROOT_DIR, SANDBOX_DIR)} ${join(ROOT_DIR, WORKING_DIR, 'sandbox')} -r --remove-destination`,
                },
              },
              {
                run: {
                  name: 'Running Chromatic',
                  command: `yarn task chromatic --template ${name} --no-link -s chromatic`,
                  environment: {
                    STORYBOOK_SANDBOX_ROOT: `./sandbox`,
                  },
                },
              },
            ],
          },
          [ids.build]
        )
      : undefined,
    !skipTasks?.includes('vitest-integration')
      ? defineJob(
          names.vitest,
          {
            executor: {
              name: 'sb_node_22_classic',
              class: 'medium',
            },
            steps: [
              git.checkout(),
              workspace.attach(),
              cache.attach(CACHE_KEYS()),
              {
                run: {
                  name: 'Running Vitest',
                  command: `yarn task vitest-integration --template ${name} --no-link -s vitest-integration`,
                },
              },
            ],
          },
          [ids.build]
        )
      : undefined,

    /**
     * Question: What is this for? Do we want to know if the test-runner works? Or do we want to
     * know if the sandbox works?
     *
     * If it's the first, we actually only need to run the test-runner job once, on any sandbox. If
     * it's the second, we need to run the test-runner job for each sandbox, but then we don't need
     * to run it when we're already running the chromatic job.
     */
    !skipTasks?.includes('test-runner') && skipTasks.includes('chromatic')
      ? defineJob(
          names['test-runner'],
          {
            executor: {
              name: 'sb_playwright',
              class: 'medium',
            },
            steps: [
              'checkout',
              workspace.attach(),
              cache.attach(CACHE_KEYS()),
              {
                run: {
                  name: 'Running test-runner',
                  command: `yarn task test-runner --template ${name} --no-link -s test-runner`,
                },
              },
            ],
          },
          [ids.build]
        )
      : undefined,
  ].filter(Boolean);
  return {
    name,
    path,
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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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

const testStorybooksPortables = ['react', 'vue3'].map(definePortableStoryTest);
const testStorybooksPortableVitest3 = defineJob(
  'test-storybooks-portable-vitest3',
  {
    executor: {
      name: 'sb_playwright',
      class: 'medium',
    },
    steps: [
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
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

const testRunner = defineJob(
  `${sandboxes[0].jobs[1].id}-test-runner`,
  {
    executor: {
      name: 'sb_playwright',
      class: 'medium',
    },
    steps: [
      git.checkout(),
      workspace.attach(),
      cache.attach(CACHE_KEYS()),
      {
        run: {
          name: 'Running test-runner',
          command: `yarn task test-runner --template ${sandboxes[0].name} --no-link -s test-runner`,
        },
      },
    ],
  },
  [sandboxes[0].jobs[1].id]
);

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
      {
        run: {
          name: 'Run Install',
          working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandboxes[0].path}`,
          command: 'yarn install',
        },
      },
      {
        run: {
          name: 'Install playwright',
          command: 'yarn playwright install chromium --with-deps',
        },
      },
      {
        run: {
          name: 'Build storybook',
          command: `yarn task build --template ${sandboxes[0].name} --no-link -s build`,
        },
      },
      {
        run: {
          name: 'Serve storybook',
          background: true,
          command: `yarn task serve --template ${sandboxes[0].name} --no-link -s serve`,
        },
      },
      server.wait(['8001']),
      {
        run: {
          name: 'Running E2E Tests',
          working_directory: 'code',
          command: `yarn task e2e-tests --template ${sandboxes[0].name} --no-link -s e2e-tests`,
        },
      },
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
      workspace.attach('C:\\Users\\circleci'),
      {
        run: {
          name: 'Install dependencies',
          command: 'yarn install',
        },
      },
      verdaccio.start(),
      server.wait([...verdaccio.ports]),
      {
        run: {
          name: 'Run Install',
          working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandboxes[0].path}`,
          command: 'yarn install',
        },
      },
      {
        run: {
          name: 'Install playwright',
          command: 'yarn playwright install chromium --with-deps',
        },
      },
      {
        run: {
          name: 'Run storybook',
          background: true,
          working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandboxes[0].path}`,
          command: 'yarn storybook --port 8001',
        },
      },
      server.wait(['8001']),
      {
        run: {
          name: 'Running E2E Tests',
          working_directory: 'code',
          command: `yarn task e2e-tests-dev --template ${sandboxes[0].name} --no-link -s e2e-tests-dev`,
        },
      },
    ],
  },
  [sandboxes[0].jobs[0].id]
);

const initEmptyWindows = defineJob(
  'init-empty-windows',
  {
    executor: {
      name: 'win/default',
      size: 'medium',
      shell: 'bash.exe',
    },
    steps: [
      git.checkout({ forceHttps: true }),
      node.installOnWindows(),
      workspace.attach('C:\\Users\\circleci'),
      {
        run: {
          name: 'Run Install',
          command: 'yarn install',
        },
      },
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

const initEmptyLinux = ['react-vite-ts', 'nextjs-ts', 'vue-vite-ts', 'lit-vite-ts'].map(
  (template) =>
    defineJob(
      `init-empty-${template}`,
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
    )
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

function definePortableStoryTest(directory: string) {
  const working_directory = `test-storybooks/portable-stories-kitchen-sink/${directory}`;

  const { scripts } = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', working_directory, 'package.json'), 'utf8')
  );

  return defineJob(
    `test-storybooks-portable-${directory}`,
    {
      executor: {
        name: 'sb_playwright',
        class: 'medium',
      },
      steps: [
        git.checkout(),
        workspace.attach(),
        cache.attach(CACHE_KEYS()),
        {
          run: {
            name: 'Install dependencies',
            working_directory,
            command: 'yarn install --no-immutable',
            environment: {
              YARN_ENABLE_IMMUTABLE_INSTALLS: false,
            },
          },
        },
        {
          run: {
            name: 'Run Jest tests',
            working_directory,
            command: 'yarn jest',
          },
        },
        {
          run: {
            name: 'Run Vitest tests',
            working_directory,
            command: 'yarn vitest',
          },
        },
        {
          run: {
            name: 'Run Playwright CT tests',
            working_directory,
            command: 'yarn playwright-ct',
          },
        },
        ...(scripts['playwright-e2e']
          ? [
              {
                run: {
                  name: 'Run Playwright E2E tests',
                  working_directory,
                  command: 'yarn playwright-e2e',
                },
              },
            ]
          : []),
        {
          run: {
            name: 'Run Cypress CT tests',
            working_directory,
            command: 'yarn cypress',
          },
        },
      ],
    },
    ['test-storybooks']
  );
}

function defineSandboxJob_build({
  directory,
  name,
  template,
  needs,
  options,
}: {
  directory: string;
  name: string;
  needs: string[];
  template: string;
  options: {
    e2e: boolean;
    chromatic: boolean;
  };
}) {
  const executor: JobImplementation['executor'] = options.e2e
    ? {
        name: 'sb_playwright',
        class: 'xlarge',
      }
    : {
        name: 'sb_node_22_classic',
        class: 'large',
      };

  return defineJob(
    name,
    {
      executor,
      steps: [
        git.checkout({ shallow: false }),
        workspace.attach(),
        cache.attach(CACHE_KEYS()),
        {
          run: {
            name: 'Build storybook',
            command: `yarn task build --template ${template} --no-link -s build`,
          },
        },
        ...(options.chromatic
          ? [workspace.persist([`${SANDBOX_DIR}/${directory}/storybook-static`])]
          : []),
        ...(options.e2e
          ? [
              {
                run: {
                  name: 'Serve storybook',
                  background: true,
                  command: `yarn task serve --template ${template} --no-link -s serve`,
                },
              },
              server.wait(['8001']),
              {
                run: {
                  name: 'Running E2E Tests',
                  command: [
                    `TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")`,
                    `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests --template ${template} --no-link -s e2e-tests" --verbose --index=0 --total=1`,
                  ].join('\n'),
                },
              },
            ]
          : []),
      ],
    },
    needs
  );
}
function defineSandboxJob_dev({
  name,
  template,
  needs,
  options,
}: {
  name: string;
  needs: string[];
  template: string;
  options: {
    e2e: boolean;
  };
}) {
  const executor: JobImplementation['executor'] = options.e2e
    ? {
        name: 'sb_playwright',
        class: 'xlarge',
      }
    : {
        name: 'sb_node_22_classic',
        class: 'large',
      };

  return defineJob(
    name,
    {
      executor,
      steps: [
        git.checkout(),
        workspace.attach(),
        cache.attach(CACHE_KEYS()),
        ...(options.e2e
          ? [
              {
                run: {
                  name: 'Run storybook',
                  working_directory: 'code',
                  background: true,
                  command: `yarn task dev --template ${template} --no-link -s dev`,
                },
              },
              server.wait(['6006']),
              {
                run: {
                  name: 'Running E2E Tests',
                  command: [
                    'TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")',
                    `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests-dev --template ${template} --no-link -s e2e-tests-dev" --verbose --index=0 --total=1`,
                  ].join('\n'),
                },
              },
            ]
          : [
              {
                run: {
                  name: 'Run storybook smoke test',
                  working_directory: 'code',
                  background: true,
                  command: `yarn task smoke-test --template ${template} --no-link -s dev`,
                },
              },
            ]),
      ],
    },
    needs
  );
}
