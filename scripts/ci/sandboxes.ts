import { join } from 'path';

import * as sandboxTemplates from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { type TemplateKey } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { build_linux } from './common-jobs.ts';
import { LINUX_ROOT_DIR, SANDBOX_DIR, WINDOWS_ROOT_DIR, WORKING_DIR } from './utils/constants.ts';
import {
  artifact,
  installPackageManagers,
  npm,
  sandboxArchive,
  server,
  testResults,
  toId,
  verdaccio,
  workflow,
  workspace,
} from './utils/helpers.ts';
import type { JobOrNoOpJob, Workflow } from './utils/types.ts';
import { defineJob, defineNoOpJob, isWorkflowOrAbove } from './utils/types.ts';
import { getLockedVersion } from './utils/workspace.ts';

const DOCGEN_HARNESS_DIR = 'code/lib/docgen-harness';

/**
 * The Chromatic job runs the CLI through npx, so it needs none of the repository's node_modules.
 * The version is read from the lockfile because this generator runs before anything is installed.
 */
const CHROMATIC_VERSION = getLockedVersion('scripts', 'chromatic');

/**
 * Verifies the committed docgen baselines against the sandbox that was just built.
 */
function getDocgenBaselineSteps(templateKey: string) {
  if (!sandboxTemplates.docgenServerTemplates().includes(templateKey as TemplateKey)) {
    return [];
  }

  return [
    {
      run: {
        name: 'Verify docgen baselines',
        working_directory: DOCGEN_HARNESS_DIR,
        command: `pnpm baselines:sandbox --template ${templateKey}`,
      },
    },
  ];
}

function getSandboxSetupSteps(template: string) {
  const extraSteps = [];
  const templateData = sandboxTemplates.allTemplates[template as TemplateKey];

  if (templateData.extraCiSteps?.ensureMinNodeVersion) {
    extraSteps.push({
      'node/install': {
        // Currently using Node 22.22.3 as minimum supported version for Angular sandboxes
        'node-version': '22.22.3',
      },
    });
  }

  return extraSteps;
}

/**
 * The dev-mode e2e jobs are the workflow tail. xlarge (8 vCPUs) with 6
 * Playwright workers cuts their test phase ~38% vs large/3, but doubles the
 * per-minute cost - so only the templates whose dev chains define the
 * workflow wall (the slowest dev test phases) get the big class; the rest
 * stay on large/3, where the extra speed would not move the wall at all.
 */
const XLARGE_DEV_TEMPLATES = new Set<string>([
  'angular-cli/default-ts',
  'angular-vite/default-ts',
  'nextjs/default-ts',
  'nextjs-vite/default-ts',
  'react-vite/default-ts',
  'react-webpack/18-ts',
  'vue3-vite/default-ts',
]);

/**
 * Sandbox creation peaks at 4.3 GB on every template but these, so it fits medium+ (6 GB). The
 * Angular CLI webpack build peaks at 5.6 GB.
 */
const LARGE_CREATE_TEMPLATES = new Set<string>(['angular-cli/default-ts']);

function defineSandboxJob_dev({
  directory,
  name,
  template,
  requires,
  options,
}: {
  directory: string;
  name: string;
  requires: JobOrNoOpJob[];
  template: string;
  options: {
    e2e: boolean;
    resourceClass: 'large' | 'xlarge';
  };
}) {
  return defineJob(
    name,
    () => ({
      executor: options.e2e
        ? {
            name: 'sb_playwright',
            class: options.resourceClass,
          }
        : {
            name: 'sb_node_22_classic',
            class: 'medium',
          },
      steps: [
        ...getSandboxSetupSteps(template),
        ...workflow.restoreLinux({ sandboxId: directory }),
        ...(options.e2e
          ? [
              {
                run: {
                  name: 'Run storybook',
                  working_directory: 'code',
                  background: true,
                  command: `pnpm task dev --template ${template} --no-link -s dev`,
                },
              },
              server.wait(['6006']),
              {
                run: {
                  name: 'Running E2E Tests',
                  environment: {
                    PLAYWRIGHT_WORKERS: options.resourceClass === 'xlarge' ? '6' : '3',
                  },
                  command: [
                    'TEST_FILES=$(circleci tests glob "code/e2e-sandbox/*.{test,spec}.{ts,js,mjs}")',
                    `echo "$TEST_FILES" | circleci tests run --command="xargs pnpm task e2e-tests-dev --template ${template} --no-link -s e2e-tests-dev --junit" --verbose --index=0 --total=1`,
                  ].join('\n'),
                },
              },
              artifact.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results'), 'test-results'),
              artifact.persist(
                join(LINUX_ROOT_DIR, WORKING_DIR, 'code', 'playwright-results'),
                'playwright-results'
              ),
              testResults.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results')),
            ]
          : [
              {
                run: {
                  name: 'Run storybook smoke test',
                  working_directory: 'code',
                  background: true,
                  command: `pnpm task smoke-test --template ${template} --no-link -s dev`,
                },
              },
            ]),
      ],
    }),
    requires
  );
}

export function defineSandboxFlow<Key extends string>(key: Key) {
  const id = toId(key);
  const data = sandboxTemplates.allTemplates[key as keyof typeof sandboxTemplates.allTemplates];
  const { skipTasks = [], name } = data;

  const path = key.replace('/', '-');

  const createJob = defineJob(
    `${name} (create)`,
    () => ({
      executor: {
        name: 'sb_node_22_browsers',
        class: LARGE_CREATE_TEMPLATES.has(key) ? 'large' : 'medium+',
      },
      steps: [
        ...getSandboxSetupSteps(key),
        ...workflow.restoreLinux(),
        verdaccio.start(),
        {
          run: {
            name: 'Start Event Collector',
            working_directory: `scripts`,
            background: true,
            command: 'pnpm exec jiti ./event-log-collector.ts',
          },
        },
        server.wait([...verdaccio.ports, '6007']),
        ...('inDevelopment' in data && data.inDevelopment
          ? [
              // Node's bundled npm silently ignores NPM_CONFIG_MIN_RELEASE_AGE during scaffold;
              // `ensureNpmSupportsMinReleaseAge` fails the generate task on it.
              npm.installPinnedVersion(),
              {
                run: {
                  // Generation scaffolds with Yarn, like the published sandboxes.
                  name: 'Enable Yarn for sandbox generation',
                  command: installPackageManagers('yarn'),
                },
              },
              {
                run: {
                  name: 'Generate Sandbox',
                  command: `pnpm task generate --template ${key} --no-link -s generate --debug`,
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
            command: `pnpm task sandbox --template ${key} --no-link -s sandbox --debug`,
            environment: {
              STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: 1,
              STORYBOOK_TELEMETRY_DEBUG: 1,
              STORYBOOK_TELEMETRY_URL: 'http://127.0.0.1:6007/event-log',
            },
          },
        },
        /**
         * Due to the way we create sandboxes, a unique situation arises where a sveltekit
         * cache-config-file is missing. This generates it.
         */
        ...(id.includes('svelte-kit')
          ? [
              {
                run: {
                  name: 'Run prepare',
                  working_directory: `${LINUX_ROOT_DIR}/${SANDBOX_DIR}/${id}`,
                  command: `pnpm prepare`,
                },
              },
            ]
          : []),
        {
          run: {
            name: 'Build storybook',
            command: `pnpm task build --template ${key} --no-link -s build`,
          },
        },
        ...getDocgenBaselineSteps(key),
        artifact.persist(`${LINUX_ROOT_DIR}/${SANDBOX_DIR}/${id}/debug-storybook.log`, 'logs'),
        workspace.packSandbox(id),
        workspace.persist([sandboxArchive(id)]),
      ],
    }),
    [sandboxesNoOpJob]
  );
  const devJob = defineSandboxJob_dev({
    name: `${name} (dev)`,
    template: key,
    directory: id,
    requires: [createJob],
    options: {
      e2e: !skipTasks?.includes('e2e-tests-dev'),
      resourceClass: XLARGE_DEV_TEMPLATES.has(key) ? 'xlarge' : 'large',
    },
  });
  const chromaticJob = defineJob(
    `${name} (chromatic)`,
    () => ({
      executor: {
        name: 'sb_node_22_classic',
        class: 'small',
      },
      steps: [
        ...getSandboxSetupSteps(key),
        'checkout', // we need the full git history for chromatic
        workspace.attach(),
        workspace.unpackSandbox(id),
        {
          // we copy to the working directory to get git history, which chromatic needs for baselines
          run: {
            name: 'Copy sandbox to working directory',
            command: `cp ${join(LINUX_ROOT_DIR, SANDBOX_DIR)} ${join(LINUX_ROOT_DIR, WORKING_DIR, 'sandbox')} -r --remove-destination`,
          },
        },
        {
          run: {
            name: 'Running Chromatic',
            working_directory: join(LINUX_ROOT_DIR, WORKING_DIR, 'sandbox', path),
            // The sandbox's .npmrc points npx at the local registry, which this job doesn't run.
            environment: { npm_config_registry: 'https://registry.npmjs.org/' },
            command: [
              `npx --yes chromatic@${CHROMATIC_VERSION}`,
              '--debug',
              '--exit-zero-on-changes',
              '--storybook-build-dir=storybook-static',
              `--projectToken="$CHROMATIC_TOKEN_${key.toUpperCase().replace(/\/|-|\./g, '_')}"`,
            ].join(' '),
          },
        },
      ],
    }),
    [createJob]
  );
  const vitestJob = defineJob(
    `${name} (vitest)`,
    () => ({
      executor: {
        name: 'sb_playwright',
        class: 'medium+',
      },
      steps: [
        ...getSandboxSetupSteps(key),
        ...workflow.restoreLinux({ sandboxId: id }),
        {
          run: {
            name: 'Running Vitest',
            command: `pnpm task vitest-integration --template ${key} --no-link -s vitest-integration --junit`,
          },
        },
        // Diagnostics for browser-mode crashes ("Browser connection was closed"). `store_artifacts`
        // has an implicit `when: always`, so these upload even when the Vitest step above fails.
        artifact.persist(
          join(LINUX_ROOT_DIR, SANDBOX_DIR, path, 'vitest-artifacts'),
          'vitest-artifacts'
        ),
        testResults.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results')),
      ],
    }),
    [createJob]
  );
  const e2eJob = defineJob(
    `${name} (e2e)`,
    () => ({
      executor: {
        name: 'sb_playwright',
        class: 'medium+',
      },
      steps: [
        ...getSandboxSetupSteps(key),
        ...workflow.restoreLinux({ sandboxId: id }),
        {
          run: {
            name: 'Serve storybook',
            background: true,
            command: `pnpm task serve --template ${key} --no-link -s serve`,
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            environment: {
              PLAYWRIGHT_WORKERS: '3',
            },
            command: [
              `TEST_FILES=$(circleci tests glob "code/e2e-sandbox/*.{test,spec}.{ts,js,mjs}")`,
              `echo "$TEST_FILES" | circleci tests run --command="xargs pnpm task e2e-tests --template ${key} --no-link -s e2e-tests --junit" --verbose --index=0 --total=1`,
            ].join('\n'),
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
    [createJob]
  );

  const jobs = [
    createJob,
    devJob,
    !skipTasks?.includes('chromatic') ? chromaticJob : undefined,
    !skipTasks?.includes('vitest-integration') ? vitestJob : undefined,
    !skipTasks?.includes('e2e-tests') ? e2eJob : undefined,
  ].filter((job) => job !== undefined);
  return {
    id,
    name: key,
    path,
    jobs,
    createJob,
    devJob,
    chromaticJob,
  };
}

// The sandbox was installed on Linux, so its node_modules holds Linux binaries and store paths.
const windowsSandboxInstall = (path: string) => ({
  run: {
    name: 'Run Install',
    working_directory: `${WINDOWS_ROOT_DIR}\\${SANDBOX_DIR}\\${path}`,
    command: ['rm -rf node_modules', 'pnpm install'].join('\n'),
  },
});

export function defineWindowsSandboxDev(sandbox: ReturnType<typeof defineSandboxFlow>) {
  return defineJob(
    `${sandbox.devJob.id}-windows`,
    () => ({
      executor: {
        name: 'win/default',
        size: 'large',
        shell: 'bash.exe',
      },
      steps: [
        ...workflow.restoreWindows(),
        workspace.unpackSandbox(sandbox.id, WINDOWS_ROOT_DIR),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        windowsSandboxInstall(sandbox.path),
        {
          run: {
            name: 'Install playwright',
            command: 'pnpm exec playwright install chromium --with-deps',
          },
        },
        {
          run: {
            name: 'Run storybook',
            background: true,
            working_directory: `${WINDOWS_ROOT_DIR}\\${SANDBOX_DIR}\\${sandbox.path}`,
            command: 'pnpm storybook --port 8001',
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            working_directory: 'code',
            command: `pnpm task e2e-tests-dev --template ${sandbox.name} --no-link -s e2e-tests-dev --junit`,
          },
        },
        testResults.persist(`${WINDOWS_ROOT_DIR}\\${WORKING_DIR}\\test-results`),
      ],
    }),
    [sandbox.createJob]
  );
}

export function defineWindowsSandboxBuild(sandbox: ReturnType<typeof defineSandboxFlow>) {
  return defineJob(
    `${sandbox.id}--build-windows`,
    () => ({
      executor: {
        name: 'win/default',
        size: 'large',
        shell: 'bash.exe',
      },
      steps: [
        ...workflow.restoreWindows(),
        workspace.unpackSandbox(sandbox.id, WINDOWS_ROOT_DIR),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        windowsSandboxInstall(sandbox.path),
        {
          run: {
            name: 'Install playwright',
            command: 'pnpm exec playwright install chromium --with-deps',
          },
        },
        {
          run: {
            name: 'Build storybook',
            command: `pnpm task build --template ${sandbox.name} --no-link -s build`,
          },
        },
        {
          run: {
            name: 'Serve storybook',
            background: true,
            command: `pnpm task serve --template ${sandbox.name} --no-link -s serve`,
          },
        },
        server.wait(['8001']),
        {
          run: {
            name: 'Running E2E Tests',
            working_directory: 'code',
            command: `pnpm task e2e-tests --template ${sandbox.name} --no-link -s e2e-tests`,
          },
        },
      ],
    }),
    [sandbox.jobs[0]]
  );
}

export const sandboxesNoOpJob = defineNoOpJob('sandboxes', [build_linux]);

/** Define the Windows build and dev E2E jobs, which run against the first daily sandbox. */
export function getWindowsSandboxes(): JobOrNoOpJob[] {
  const sandbox = defineSandboxFlow(sandboxTemplates.daily[0]);

  return [defineWindowsSandboxBuild(sandbox), defineWindowsSandboxDev(sandbox)];
}

const getListOfSandboxes = (workflow: Workflow) => {
  switch (workflow) {
    case 'normal':
      return sandboxTemplates.normal;
    case 'daily':
      return sandboxTemplates.daily;
    default:
      return [];
  }
};

export function getSandboxes(workflow: Workflow) {
  const sandboxes = getListOfSandboxes(workflow).map(defineSandboxFlow);

  const list: JobOrNoOpJob[] = sandboxes.flatMap((sandbox) => sandbox.jobs);

  if (isWorkflowOrAbove(workflow, 'daily')) {
    list.push(...getWindowsSandboxes());
  }

  return list;
}
