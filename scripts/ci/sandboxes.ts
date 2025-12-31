import { join } from 'path';

import * as sandboxTemplates from '../../code/lib/cli-storybook/src/sandbox-templates';
import { build_linux } from './code';
import { ROOT_DIR, SANDBOX_DIR, WORKING_DIR } from './utils/constants';
import {
  CACHE_KEYS,
  artifact,
  cache,
  server,
  testResults,
  toId,
  verdaccio,
  workflow,
  workspace,
} from './utils/helpers';
import { defineHub, defineJob, isWorkflowOrAbove } from './utils/types';
import type { JobsOrHub, Workflow } from './utils/types';

function defineSandboxJob_build({
  directory,
  name,
  template,
  requires,
}: {
  directory: string;
  name: string;
  requires: JobsOrHub[];
  template: string;
}) {
  return defineJob(
    name,
    {
      executor: {
        name: 'sb_node_22_classic',
        class: 'large',
      },
      steps: [
        ...workflow.restore_linux(),
        {
          run: {
            name: 'Build storybook',
            command: `yarn task build --template ${template} --no-link -s build`,
          },
        },
        workspace.persist([`${SANDBOX_DIR}/${directory}/storybook-static`]),
      ],
    },
    requires
  );
}
function defineSandboxJob_dev({
  name,
  directory,
  template,
  requires,
  options,
}: {
  name: string;
  directory: string;
  requires: JobsOrHub[];
  template: string;
  options: {
    e2e: boolean;
  };
}) {
  return defineJob(
    name,
    {
      executor: options.e2e
        ? {
            name: 'sb_playwright',
            class: 'xlarge',
          }
        : {
            name: 'sb_node_22_classic',
            class: 'large',
          },
      steps: [
        ...workflow.restore_linux(),
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
                    `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests-dev --template ${template} --no-link -s e2e-tests-dev --junit" --verbose --index=0 --total=1`,
                  ].join('\n'),
                },
              },
              artifact.persist(
                join(ROOT_DIR, SANDBOX_DIR, directory, 'test-results'),
                'test-results'
              ),
              testResults.persist(join(ROOT_DIR, WORKING_DIR, 'test-results')),
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
    requires
  );
}

export function defineSandboxFlow<Key extends string>(key: Key) {
  const id = toId(key);
  const data = sandboxTemplates.allTemplates[key as keyof typeof sandboxTemplates.allTemplates];
  const { skipTasks = [], name } = data;

  const path = key.replace('/', '-');

  const names = {
    create: `${name} (create)`,
    build: `${name} (build)`,
    dev: `${name} (dev)`,
    e2e: `${name} (e2e)`,
    chromatic: `${name} (chromatic)`,
    vitest: `${name} (vitest)`,
    testRunner: `${name} (test-runner)`,
  };

  const createJob = defineJob(
    names.create,
    {
      executor: {
        name: 'sb_node_22_browsers',
        class: 'large',
      },
      steps: [
        ...workflow.restore_linux(),
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
        ...('inDevelopment' in data && data.inDevelopment
          ? [
              {
                run: {
                  name: 'Generate Sandbox',
                  command: `yarn task generate --template ${key} --no-link -s generate --debug`,
                  environment: {
                    STORYBOOK_SANDBOX_GENERATE: 1,
                    STORYBOOK_TELEMETRY_DEBUG: 1,
                    STORYBOOK_TELEMETRY_URL: 'http://127.0.0.1:6007/event-log',
                  },
                },
              },
            ]
          : []),
        {
          run: {
            name: 'Create Sandbox',
            command: `yarn task sandbox --template ${key} --no-link -s sandbox --debug`,
            environment: {
              STORYBOOK_TELEMETRY_DEBUG: 1,
              STORYBOOK_TELEMETRY_URL: 'http://127.0.0.1:6007/event-log',
            },
          },
        },
        ...(id.includes('svelte-kit')
          ? [
              {
                run: {
                  name: 'Run prepare',
                  working_directory: `${ROOT_DIR}/${SANDBOX_DIR}/${id}`,
                  command: `yarn prepare`,
                },
              },
            ]
          : []),
        artifact.persist(`${ROOT_DIR}/${SANDBOX_DIR}/${id}/debug-storybook.log`, 'logs'),
        workspace.persist([`${SANDBOX_DIR}/${id}`]),
      ],
    },
    [sandboxesHub]
  );
  const buildJob = defineSandboxJob_build({
    directory: id,
    name: names.build,
    template: key,
    requires: [createJob],
  });
  const devJob = defineSandboxJob_dev({
    name: names.dev,
    directory: id,
    template: key,
    requires: [createJob],
    options: { e2e: !skipTasks?.includes('e2e-tests-dev') },
  });
  const chromaticJob = defineJob(
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
            command: `yarn task chromatic --template ${key} --no-link -s chromatic`,
            environment: {
              STORYBOOK_SANDBOX_ROOT: `./sandbox`,
            },
          },
        },
      ],
    },
    [buildJob]
  );
  const vitestJob = defineJob(
    names.vitest,
    {
      executor: {
        name: 'sb_playwright',
        class: 'medium',
      },
      steps: [
        ...workflow.restore_linux(),
        {
          run: {
            name: 'Running Vitest',
            command: `yarn task vitest-integration --template ${key} --no-link -s vitest-integration --junit`,
          },
        },
        testResults.persist(join(ROOT_DIR, WORKING_DIR, 'test-results')),
      ],
    },
    [buildJob]
  );
  const e2eJob = defineJob(
    names.e2e,
    {
      executor: {
        name: 'sb_playwright',
        class: 'xlarge',
      },
      steps: [
        ...workflow.restore_linux(),
        {
          run: {
            name: 'Serve storybook',
            background: true,
            command: `yarn task serve --template ${key} --no-link -s serve`,
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            command: [
              `TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")`,
              `echo "$TEST_FILES" | circleci tests run --command="xargs yarn task e2e-tests --template ${key} --no-link -s e2e-tests --junit" --verbose --index=0 --total=1`,
            ].join('\n'),
          },
        },
        testResults.persist(join(ROOT_DIR, WORKING_DIR, 'test-results')),
      ],
    },
    [buildJob]
  );
  const testRunnerJob = defineJob(
    names.testRunner,
    {
      executor: {
        name: 'sb_playwright',
        class: 'medium',
      },
      steps: [
        ...workflow.restore_linux(),
        {
          run: {
            name: 'Running test-runner',
            command: `yarn task test-runner --template ${key} --no-link -s test-runner --junit`,
          },
        },
        testResults.persist(join(ROOT_DIR, WORKING_DIR, 'test-results')),
      ],
    },
    [buildJob]
  );

  const jobs = [
    createJob,
    buildJob,
    devJob,
    !skipTasks?.includes('chromatic') ? chromaticJob : undefined,
    !skipTasks?.includes('vitest-integration') ? vitestJob : undefined,
    !skipTasks?.includes('e2e-tests') ? e2eJob : undefined,

    /**
     * Question: What is this for? Do we want to know if the test-runner works? Or do we want to
     * know if the sandbox works?
     *
     * If it's the first, we actually only need to run the test-runner job once, on any sandbox. If
     * it's the second, we need to run the test-runner job for each sandbox, but then we don't need
     * to run it when we're already running the chromatic job.
     */
    !skipTasks?.includes('test-runner') && skipTasks.includes('chromatic')
      ? testRunnerJob
      : undefined,
  ].filter(Boolean);
  return {
    name: key,
    path,
    jobs,
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
        ...workflow.restore_linux(),
        {
          run: {
            name: 'Running test-runner',
            command: `yarn task test-runner --template ${sandbox.name} --no-link -s test-runner --junit`,
          },
        },
        testResults.persist(join(ROOT_DIR, WORKING_DIR, 'test-results')),
      ],
    },
    [sandbox.jobs[1]]
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
        ...workflow.restore_windows(),
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
            command: `yarn task e2e-tests-dev --template ${sandbox.name} --no-link -s e2e-tests-dev --junit`,
          },
        },
        testResults.persist(`C:\\Users\\circleci\\project\\test-results`),
      ],
    },
    [sandbox.jobs[0]]
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
        ...workflow.restore_windows(),
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
    [sandbox.jobs[0]]
  );
}

export const sandboxesHub = defineHub('sandboxes', [build_linux]);

const getListOfSandboxes = (workflow: Workflow) => {
  switch (workflow) {
    case 'normal':
      return sandboxTemplates.normal;
    case 'merged':
      return sandboxTemplates.merged;
    case 'daily':
      return sandboxTemplates.daily;
    default:
      return [];
  }
};

export function getSandboxes(workflow: Workflow) {
  const sandboxes = getListOfSandboxes(workflow).map(defineSandboxFlow);

  const list: JobsOrHub[] = sandboxes.flatMap((sandbox) => sandbox.jobs);

  if (isWorkflowOrAbove(workflow, 'merged')) {
    const windows_sandbox_build = defineWindowsSandboxBuild(sandboxes[0]);
    const windows_sandbox_dev = defineWindowsSandboxDev(sandboxes[0]);
    const testRunner = defineSandboxTestRunner(sandboxes[0]);

    list.push(windows_sandbox_build, windows_sandbox_dev, testRunner);
  }

  return list;
}
