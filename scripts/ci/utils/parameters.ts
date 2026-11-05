import { workflows } from './types.ts';

/** These are parameters that the CircleCI API is called with. */
export const parameters = {
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
  ghTrustedAuthor: {
    default: 'false',
    description:
      'Whether the pipeline is allowed to persist to shared caches (team member PRs and push events only)',
    type: 'string',
  },
  nxDte: {
    default: false,
    description:
      'Run the workflow as one NX task graph distributed over CircleCI agents (scripts/ci/nx/circleci-dte.ts)',
    type: 'boolean',
  },
  nxDteAgents: {
    default: 40,
    description: 'How many CircleCI agents run the tasks when nxDte is set',
    type: 'integer',
  },
  nxDteAgentClass: {
    default: 'large',
    description: 'The resource class of those agents',
    enum: ['large', 'xlarge'],
    type: 'enum',
  },
  workflow: {
    default: 'skipped',
    description: `Which workflows to run, comma-separated, out of ${workflows.join(', ')} (e.g. \`normal,windows\`)`,
    type: 'string',
  },
};
