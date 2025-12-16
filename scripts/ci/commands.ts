import { git } from './utils';

export const commands = {
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
