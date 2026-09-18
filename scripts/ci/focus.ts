import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  allTemplates,
  type SkippableTask,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { installWithCache } from './common-jobs.ts';
import { getGenerateSandboxSteps, getSandboxSetupSteps } from './sandboxes.ts';
import { LINUX_ROOT_DIR, SANDBOX_DIR, WORKING_DIR } from './utils/constants.ts';
import { artifact, git, npm, server, testResults, toId, verdaccio } from './utils/helpers.ts';
import { defineJob } from './utils/types.ts';

const DEFAULT_FOCUS_SANDBOX = 'react-vite/default-ts' satisfies TemplateKey;
const REQUIRED_FOCUS_TASKS = [
  'e2e-tests',
  'e2e-tests-dev',
  'chromatic',
] as const satisfies readonly SkippableTask[];

type FocusSandboxRule = {
  prefix: string;
  sandbox: TemplateKey;
};

const frameworkFocusSandboxRules = [
  {
    prefix: 'code/frameworks/angular-vite/',
    sandbox: 'angular-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/angular/',
    sandbox: 'angular-cli/default-ts',
  },
  {
    prefix: 'code/frameworks/nextjs-vite/',
    sandbox: 'nextjs-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/nextjs/',
    sandbox: 'nextjs/default-ts',
  },
  {
    prefix: 'code/frameworks/react-webpack5/',
    sandbox: 'react-webpack/18-ts',
  },
  {
    prefix: 'code/frameworks/vue3-vite/',
    sandbox: 'vue3-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/svelte-vite/',
    sandbox: 'svelte-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/preact-vite/',
    sandbox: 'preact-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/html-vite/',
    sandbox: 'html-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/web-components-vite/',
    sandbox: 'lit-vite/default-ts',
  },
  {
    prefix: 'code/frameworks/react-native-web-vite/',
    sandbox: 'react-native-web-vite/expo-ts',
  },
  {
    prefix: 'code/frameworks/react-vite/',
    sandbox: DEFAULT_FOCUS_SANDBOX,
  },
] as const satisfies readonly FocusSandboxRule[];

const rendererFocusSandboxRules = [
  { prefix: 'code/renderers/vue3/', sandbox: 'vue3-vite/default-ts' },
  { prefix: 'code/renderers/svelte/', sandbox: 'svelte-vite/default-ts' },
  { prefix: 'code/renderers/preact/', sandbox: 'preact-vite/default-ts' },
  { prefix: 'code/renderers/html/', sandbox: 'html-vite/default-ts' },
  { prefix: 'code/renderers/web-components/', sandbox: 'lit-vite/default-ts' },
  { prefix: 'code/renderers/react/', sandbox: DEFAULT_FOCUS_SANDBOX },
] as const satisfies readonly FocusSandboxRule[];

const builderFocusSandboxRules = [
  { prefix: 'code/builders/builder-webpack5/', sandbox: 'react-webpack/18-ts' },
  { prefix: 'code/builders/builder-vite/', sandbox: DEFAULT_FOCUS_SANDBOX },
] as const satisfies readonly FocusSandboxRule[];

function supportsFocusTasks(template: TemplateKey): boolean {
  const skippedTasks = allTemplates[template].skipTasks ?? [];

  return REQUIRED_FOCUS_TASKS.every((task) => !skippedTasks.includes(task));
}

export function selectFocusSandbox(changedFiles: readonly string[]): TemplateKey {
  for (const rules of [
    frameworkFocusSandboxRules,
    rendererFocusSandboxRules,
    builderFocusSandboxRules,
  ]) {
    const sandbox = rules.find(
      ({ prefix, sandbox }) =>
        supportsFocusTasks(sandbox) && changedFiles.some((file) => file.startsWith(prefix))
    )?.sandbox;

    if (sandbox) {
      return sandbox;
    }
  }

  return DEFAULT_FOCUS_SANDBOX;
}

export function getChangedFiles(baseRef: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

const FOCUS_TEST_STATUS = '/tmp/storybook-focus-tests.status';

export function defineFocusJob(template: TemplateKey) {
  if (!supportsFocusTasks(template)) {
    throw new Error(`${template} does not support every task required by focused CI`);
  }

  const sandboxId = toId(template);

  return defineJob('CI focus', () => ({
    executor: {
      name: 'sb_playwright',
      class: 'xlarge',
    },
    steps: [
      git.checkout({ shallow: false }),
      ...getSandboxSetupSteps(template),
      ...installWithCache(),
      npm.check(),
      {
        run: {
          name: 'Compile',
          working_directory: 'code',
          command: 'yarn task --task compile --start-from=auto --no-link --debug',
        },
      },
      {
        run: {
          name: 'Run tests',
          background: true,
          command: [
            `rm -f ${FOCUS_TEST_STATUS}`,
            'mkdir -p test-results',
            'status=0',
            'yarn test --reporter=junit --reporter=default --outputFile=./test-results/focus-tests.xml || status=$?',
            `echo "$status" > ${FOCUS_TEST_STATUS}`,
          ].join('\n'),
        },
      },
      verdaccio.publish(),
      verdaccio.start(),
      {
        run: {
          name: 'Start event collector',
          working_directory: 'scripts',
          background: true,
          command: 'yarn jiti ./event-log-collector.ts',
        },
      },
      server.wait([...verdaccio.ports, '6007']),
      {
        run: {
          name: 'Setup Corepack',
          command: ['sudo corepack enable', 'which yarn', 'yarn --version'].join('\n'),
        },
      },
      ...getGenerateSandboxSteps(template),
      {
        run: {
          name: 'Create sandbox',
          command: `yarn task sandbox --template ${template} --no-link -s sandbox --debug`,
          environment: {
            STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: 1,
            STORYBOOK_TELEMETRY_DEBUG: 1,
            STORYBOOK_TELEMETRY_URL: 'http://127.0.0.1:6007/event-log',
          },
        },
      },
      {
        run: {
          name: 'Build sandbox',
          command: `yarn task build --template ${template} --no-link -s build`,
        },
      },
      {
        run: {
          name: 'Start sandbox in dev mode',
          working_directory: 'code',
          background: true,
          command: `yarn task dev --template ${template} --no-link -s dev`,
        },
      },
      {
        run: {
          name: 'Serve sandbox build',
          background: true,
          command: `yarn task serve --template ${template} --no-link -s serve`,
        },
      },
      server.wait(['6006', '8001']),
      {
        run: {
          name: 'Run dev E2E tests',
          environment: {
            PLAYWRIGHT_WORKERS: '6',
          },
          command: `yarn task e2e-tests-dev --template ${template} --no-link -s e2e-tests-dev --junit`,
        },
      },
      {
        run: {
          name: 'Run build E2E tests',
          environment: {
            PLAYWRIGHT_WORKERS: '6',
          },
          command: `yarn task e2e-tests --template ${template} --no-link -s e2e-tests --junit`,
        },
      },
      {
        run: {
          name: 'Copy sandbox for Chromatic',
          command: `cp ${join(LINUX_ROOT_DIR, SANDBOX_DIR)} ${join(LINUX_ROOT_DIR, WORKING_DIR, 'sandbox')} -r --remove-destination`,
        },
      },
      {
        run: {
          name: 'Wait for tests',
          command: [
            'waited=0',
            `until [ -f ${FOCUS_TEST_STATUS} ]; do`,
            '  if [ "$waited" -ge 1800 ]; then',
            '    echo "Timed out waiting for tests" >&2',
            '    exit 1',
            '  fi',
            '  sleep 2',
            '  waited=$((waited + 2))',
            'done',
            `status=$(cat ${FOCUS_TEST_STATUS})`,
            'if [ "$status" != "0" ]; then',
            '  echo "Tests failed with status $status" >&2',
            '  exit "$status"',
            'fi',
          ].join('\n'),
        },
      },
      {
        run: {
          name: 'Run Chromatic',
          command: `yarn task chromatic --template ${template} --no-link -s chromatic`,
          environment: {
            STORYBOOK_SANDBOX_ROOT: './sandbox',
          },
        },
      },
      artifact.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results'), 'test-results'),
      artifact.persist(
        join(LINUX_ROOT_DIR, WORKING_DIR, 'code', 'playwright-results'),
        'playwright-results'
      ),
      testResults.persist(join(LINUX_ROOT_DIR, WORKING_DIR, 'test-results')),
      artifact.persist(join(LINUX_ROOT_DIR, SANDBOX_DIR, sandboxId, 'debug-storybook.log'), 'logs'),
    ],
  }));
}
