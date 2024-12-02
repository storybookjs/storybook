import { relative } from 'node:path';

import { getProjectRoot } from '@storybook/core/common';

import { execSync } from 'child_process';
import slash from 'slash';

import { oneWayHash } from './one-way-hash';

export function normalizeGitUrl(rawUrl: string) {
  // I don't *think* its possible to set a hash on a origin URL, but just in case
  const urlWithoutHash = rawUrl.trim().replace(/#.*$/, '');

  // Strip anything ahead of an @
  const urlWithoutUser = urlWithoutHash.replace(/^.*@/, '');

  // Now strip off scheme
  const urlWithoutScheme = urlWithoutUser.replace(/^.*\/\//, '');

  // Ensure the URL ends in `.git`
  const urlWithExtension = urlWithoutScheme.endsWith('.git')
    ? urlWithoutScheme
    : `${urlWithoutScheme}.git`;

  return urlWithExtension.replace(':', '/');
}

// we use a combination of remoteUrl and working directory
// to separate multiple storybooks from the same project (e.g. monorepo)
export function unhashedProjectId(remoteUrl: string, projectRootPath: string) {
  return `${normalizeGitUrl(remoteUrl)}${slash(projectRootPath)}`;
}

let anonymousProjectId: string;
export const getAnonymousProjectId = () => {
  if (anonymousProjectId) {
    return anonymousProjectId;
  }

  try {
    const projectRoot = getProjectRoot();

    const projectRootPath = relative(projectRoot, process.cwd());

    const originBuffer = execSync(`git config --local --get remote.origin.url`, {
      timeout: 1000,
      stdio: `pipe`,
    });

    anonymousProjectId = oneWayHash(unhashedProjectId(String(originBuffer), projectRootPath));
  } catch (_) {
    //
  }

  return anonymousProjectId;
};
