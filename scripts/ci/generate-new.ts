import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
import yml from 'yaml';

program
  .description('Generate CircleCI config')
  .requiredOption('-w, --workflow <string>', 'Workflow to generate config for')
  .parse(process.argv);

const { workflow: workflowName } = program.opts();

const dirname = import.meta.dirname;

console.log('Generating CircleCI config for workflow:', workflowName);
console.log('--------------------------------');

const templates = await import(join(dirname, '../../code/lib/cli-storybook/src/sandbox-templates'));

const jobs = {} as const;

const data = {
  version: 2.1,
  commands: {
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
          description:
            'Which template to report in discord. Applicable for parallel sandbox jobs\n',
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
  },
  executors: {},
  jobs,
  orbs: {
    'browser-tools': 'circleci/browser-tools@1.4.1',
    codecov: 'codecov/codecov@3.2.4',
    discord: 'antonioned/discord@0.1.0',
    'git-shallow-clone': 'guitarrapc/git-shallow-clone@2.5.0',
    node: 'circleci/node@5.2.0',
    nx: 'nrwl/nx@1.6.2',
  },
  parameters: {
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
    // this has no impact, but must be present until we have implemented change-detection
    workflow: {
      default: 'normal',
      description: 'Which workflow to run',
      enum: ['normal', 'merged', 'daily', 'skipped', 'docs'],
      type: 'enum',
    },
  },
  workflows: {
    sandboxes: {
      jobs: [],
    },
  },
};
