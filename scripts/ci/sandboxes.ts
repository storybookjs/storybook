import { join } from 'path';

import { allTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates';
import { defineHub, defineJob } from './utils';
import type { JobImplementation } from './utils';
import {
  CACHE_KEYS,
  ROOT_DIR,
  SANDBOX_DIR,
  WORKING_DIR,
  artifact,
  cache,
  restore,
  server,
  toId,
  verdaccio,
  workspace,
} from './utils';

function defineSandboxJob_build({
  directory,
  name,
  template,
  needs,
}: {
  directory: string;
  name: string;
  needs: string[];
  template: string;
}) {
  const executor: JobImplementation['executor'] = {
    name: 'sb_node_22_classic',
    class: 'large',
  };

  return defineJob(
    name,
    {
      executor,
      steps: [
        ...restore.linux(),
        {
          run: {
            name: 'Build storybook',
            command: `yarn task build --template ${template} --no-link -s build`,
          },
        },
        workspace.persist([`${SANDBOX_DIR}/${directory}/storybook-static`]),
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
        ...restore.linux(),
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

export function defineSandboxFlow<K extends string>(name: K) {
  const id = toId(name);
  const data = allTemplates[name as keyof typeof allTemplates];
  const { skipTasks } = data;

  const path = name.replace('/', '-');

  const names = {
    create: `${name} (create)`,
    build: `${name} (build)`,
    dev: `${name} (dev)`,
    e2e: `${name} (e2e)`,
    chromatic: `${name} (chromatic)`,
    vitest: `${name} (vitest)`,
    ['test-runner']: `${name} (test-runner)`,
  };
  const ids = {
    create: `${toId(names.create)}`,
    build: `${toId(names.build)}`,
    dev: `${toId(names.dev)}`,
    e2e: `${toId(names.e2e)}`,
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
          ...restore.linux(),
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
              'checkout', // we need the full git history for chromatic
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
              name: 'sb_playwright',
              class: 'medium',
            },
            steps: [
              ...restore.linux(),
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

    !skipTasks?.includes('e2e-tests')
      ? defineJob(
          names.e2e,
          {
            executor: {
              name: 'sb_playwright',
              class: 'xlarge',
            },
            steps: [
              ...restore.linux(),
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
                    `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests --template ${name} --no-link -s e2e-tests" --verbose --index=0 --total=1`,
                  ].join('\n'),
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
    // workflow: jobs.map((job) => {
    //   return {
    //     [job.id]: {
    //       requires: job.requires,
    //     },
    //   };
    // }),
  };
}
export function defineSandboxTestRunner(sandbox: ReturnType<typeof defineSandboxFlow>) {
  return defineJob(
    `${sandbox.jobs[1].id}-test-runner`,
    {
      executor: {
        name: 'sb_playwright',
        class: 'medium',
      },
      steps: [
        ...restore.linux(),
        {
          run: {
            name: 'Running test-runner',
            command: `yarn task test-runner --template ${sandbox.name} --no-link -s test-runner`,
          },
        },
      ],
    },
    [sandbox.jobs[1].id]
  );
}
export function defineWindowsSandboxDev(sandbox: ReturnType<typeof defineSandboxFlow>) {
  return defineJob(
    `${sandbox.jobs[2].id}-windows`,
    {
      executor: {
        name: 'win/default',
        size: 'xlarge',
        shell: 'bash.exe',
      },
      steps: [
        ...restore.windows(),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        {
          run: {
            name: 'Run Install',
            working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandbox.path}`,
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
            working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandbox.path}`,
            command: 'yarn storybook --port 8001',
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            working_directory: 'code',
            command: `yarn task e2e-tests-dev --template ${sandbox.name} --no-link -s e2e-tests-dev`,
          },
        },
      ],
    },
    [sandbox.jobs[0].id]
  );
}
export function defineWindowsSandboxBuild(sandbox: ReturnType<typeof defineSandboxFlow>) {
  return defineJob(
    `${sandbox.jobs[1].id}-windows`,
    {
      executor: {
        name: 'win/default',
        size: 'xlarge',
        shell: 'bash.exe',
      },
      steps: [
        ...restore.windows(),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        {
          run: {
            name: 'Run Install',
            working_directory: `C:\\Users\\circleci\\storybook-sandboxes\\${sandbox.path}`,
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
            command: `yarn task build --template ${sandbox.name} --no-link -s build`,
          },
        },
        {
          run: {
            name: 'Serve storybook',
            background: true,
            command: `yarn task serve --template ${sandbox.name} --no-link -s serve`,
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            working_directory: 'code',
            command: `yarn task e2e-tests --template ${sandbox.name} --no-link -s e2e-tests`,
          },
        },
      ],
    },
    [sandbox.jobs[0].id]
  );
}

export const sandboxesHub = defineHub('sandboxes', ['build-linux']);
