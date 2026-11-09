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
  nxDteAffected: {
    default: true,
    description:
      'When nxDte is set on a pull request, run only the tasks the change reaches (nx affected) instead of all of them',
    type: 'boolean',
  },
  nxDteMaxAgents: {
    default: 44,
    description:
      'At most how many Linux CircleCI agents a run starts when nxDte is set; the setup job works out how many its work needs',
    type: 'integer',
  },
  workflow: {
    default: 'skipped',
    description: `Which workflows to run, comma-separated, out of ${workflows.join(', ')} (e.g. \`normal,windows\`)`,
    type: 'string',
  },
};
