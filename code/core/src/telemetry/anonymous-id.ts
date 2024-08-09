import path from 'node:path';

import { getProjectRoot } from '@storybook/core/common';

import { execSync } from 'child_process';

import { oneWayHash } from './one-way-hash';

export function normalizeGitUrl(rawUrl: string) {
  // I don't *think* its possible to set a hash on a origin URL, but just in case
  const urlWithoutHash = rawUrl.trim().replace(/#.*$/, '');

  // Strip anything ahead of an @
  const urlWithoutUser = urlWithoutHash.replace(/^.*@/, '');

  // Now strip off scheme
  const urlWithoutScheme = urlWithoutUser.replace(/^.*\/\//, '');

  return urlWithoutScheme.replace(':', '/');
}

let anonymousProjectId: string;
export const getAnonymousProjectId = () => {
  if (anonymousProjectId) {
    return anonymousProjectId;
  }

  let unhashedProjectId;
  try {
    const projectRoot = getProjectRoot();

    const projectRootPath = path.relative(projectRoot, process.cwd());

    const originBuffer = execSync(`git config --local --get remote.origin.url`, {
      timeout: 1000,
      stdio: `pipe`,
    });

    // we use a combination of remoteUrl and working directory
    // to separate multiple storybooks from the same project (e.g. monorepo)
    unhashedProjectId = `${normalizeGitUrl(String(originBuffer))}${projectRootPath}`;

    anonymousProjectId = oneWayHash(unhashedProjectId);
  } catch (_) {
    //
  }

  return anonymousProjectId;
};
