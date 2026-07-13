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
  workflow: {
    default: 'skipped',
    description:
      'Which workflow to run: a single workflow (normal, merged, daily, docs, core), or a `+`-separated list of sandbox-split atoms (a framework such as react/vue3/angular, or a builder such as vite/webpack), e.g. "core+react"',
    type: 'string',
  },
};
