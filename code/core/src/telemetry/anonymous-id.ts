import { relative } from 'node:path';

import { executeCommandSync, getProjectRoot } from 'storybook/internal/common';

// eslint-disable-next-line depend/ban-dependencies
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
    const projectRootPath = relative(getProjectRoot(), process.cwd());

    const result = executeCommandSync({
      command: 'git',
      args: ['config', '--get', 'remote.origin.url'],
      timeout: 1000,
    });

    anonymousProjectId = oneWayHash(unhashedProjectId(result, projectRootPath));
  } catch (_) {
    //
  }

  return anonymousProjectId;
};

export const getProjectSince = () => {
  try {
    const dateBuffer = executeCommandSync({
      command: 'git',
      args: ['log', '--reverse', '--format=%cd', '--date=iso'],
      timeout: 1000,
    });

    const firstLine = String(dateBuffer).trim().split('\n')[0];

    const date = new Date(firstLine);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  } catch (_) {
    //
  }

  return undefined;
};
