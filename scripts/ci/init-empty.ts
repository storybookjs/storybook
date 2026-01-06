import { build_linux } from './code';
import { WINDOWS_ROOT_DIR } from './utils/constants';
import { server, verdaccio, workflow } from './utils/helpers';
import {
  type JobsOrHub,
  type Workflow,
  defineHub,
  defineJob,
  isWorkflowOrAbove,
} from './utils/types';

export const defineEmptyInitFlow = (template: string) =>
  defineJob(
    `init-empty-${template}`,
    {
      executor: {
        name: 'sb_node_22_classic',
        class: 'medium',
      },
      steps: [
        ...workflow.restoreLinux(),
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

    [initEmptyHub]
  );

export function defineEmptyInitFeatures() {
  return defineJob(
    'init-features',
    {
      executor: {
        name: 'sb_node_22_classic',
        class: 'medium',
      },
      steps: [
        ...workflow.restoreLinux(),
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
    [initEmptyHub]
  );
}

export function defineEmptyInitWindows() {
  return defineJob(
    'init-empty-windows',
    {
      executor: {
        name: 'win/default',
        size: 'medium',
        shell: 'bash.exe',
      },
      steps: [
        ...workflow.restoreWindows(),
        verdaccio.start(),
        server.wait([...verdaccio.ports]),
        {
          run: {
            name: 'Storybook init from empty directory (Windows NPM)',
            working_directory: WINDOWS_ROOT_DIR,
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
            working_directory: `${WINDOWS_ROOT_DIR}\\empty-react-vite-ts`,
            command: 'npm run storybook -- --smoke-test',
          },
        },
      ],
    },
    [initEmptyHub]
  );
}

export const initEmptyHub = defineHub('init-empty', [build_linux]);

export function getInitEmpty(workflow: Workflow) {
  const initEmpty: JobsOrHub[] = ['react-vite-ts'].map(defineEmptyInitFlow);

  if (isWorkflowOrAbove(workflow, 'merged')) {
    initEmpty.push(...['nextjs-ts', 'vue-vite-ts', 'lit-vite-ts'].map(defineEmptyInitFlow));
    initEmpty.push(defineEmptyInitWindows());
  }

  if (isWorkflowOrAbove(workflow, 'normal')) {
    initEmpty.push(defineEmptyInitFeatures());
  }

  return initEmpty;
}
