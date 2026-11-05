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
    default: 24,
    description:
      "How many large CircleCI agents run the tasks other than the sandboxes' when nxDte is set",
    type: 'integer',
  },
  nxDteSandboxAgents: {
    default: 16,
    description:
      'How many xlarge CircleCI agents create, build and test the sandboxes when nxDte is set',
    type: 'integer',
  },
  workflow: {
    default: 'skipped',
    description: `Which workflows to run, comma-separated, out of ${workflows.join(', ')} (e.g. \`normal,windows\`)`,
    type: 'string',
  },
};
