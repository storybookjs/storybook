import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  allTemplates,
  type FocusPathKind,
  type SkippableTask,
  type Template,
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

const FOCUS_PATH_PRIORITY = [
  'framework',
  'renderer',
  'builder',
] as const satisfies readonly FocusPathKind[];

function supportsFocusTasks(template: TemplateKey): boolean {
  const skippedTasks = allTemplates[template].skipTasks ?? [];

  return REQUIRED_FOCUS_TASKS.every((task) => !skippedTasks.includes(task));
}

export function selectFocusSandbox(changedFiles: readonly string[]): TemplateKey {
  for (const kind of FOCUS_PATH_PRIORITY) {
    const sandbox = (Object.entries(allTemplates) as [TemplateKey, Template][]).find(
      ([template, { focusPathPrefixes }]) => {
        const prefix = focusPathPrefixes?.[kind];

        return (
          prefix !== undefined &&
          supportsFocusTasks(template) &&
          changedFiles.some((file) => file.startsWith(prefix))
        );
      }
    )?.[0];

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
            'yarn test --testTimeout=30000 --reporter=junit --reporter=default --outputFile=./test-results/focus-tests.xml || status=$?',
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
          command: ['corepack enable', 'which yarn', 'yarn --version'].join('\n'),
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
          command: [
            `cp ${join(LINUX_ROOT_DIR, SANDBOX_DIR)} ${join(LINUX_ROOT_DIR, WORKING_DIR, 'sandbox')} -r --remove-destination`,
            `rm -rf ${join(LINUX_ROOT_DIR, WORKING_DIR, 'sandbox', sandboxId, '.git')}`,
          ].join('\n'),
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
