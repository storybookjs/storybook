/**
 * This is the list of orbs that are used in the CI config.
 *
 * These should be regularly updated to the latest version.
 *
 * @see https://circleci.com/developer/orbs
 */
export const orbs = {
  // https://circleci.com/developer/orbs/orb/circleci/browser-tools
  'browser-tools': 'circleci/browser-tools@2.3.2',

  // https://circleci.com/developer/orbs/orb/codecov/codecov
  codecov: 'codecov/codecov@5.4.3',

  // https://circleci.com/developer/orbs/orb/antonioned/discord
  discord: 'antonioned/discord@0.1.0',

  // https://circleci.com/developer/orbs/orb/guitarrapc/git-shallow-clone
  'git-shallow-clone': 'guitarrapc/git-shallow-clone@2.8.0',

  // https://circleci.com/developer/orbs/orb/circleci/node
  node: 'circleci/node@7.2.1',

  // https://circleci.com/developer/orbs/orb/nrwl/nx
  nx: 'nrwl/nx@1.7.0',

  // https://circleci.com/developer/orbs/orb/circleci/windows
  win: 'circleci/windows@5.1.1',
};
