import { join, relative, resolve, sep } from 'node:path';

import { findUpSync } from 'find-up';

import { LOCK_FILES } from '../js-package-manager/constants';

let projectRoot: string | undefined;

export const getProjectRoot = () => {
  if (projectRoot) {
    process.stdout.write(`\nfound cached projectRoot: ${projectRoot}\n`);
    return projectRoot;
  }

  let result;
  // Allow manual override in cases where auto-detect doesn't work
  if (process.env.STORYBOOK_PROJECT_ROOT) {
    process.stdout.write(`\nusing STORYBOOK_PROJECT_ROOT: ${process.env.STORYBOOK_PROJECT_ROOT}\n`);
    return process.env.STORYBOOK_PROJECT_ROOT;
  }

  try {
    process.stdout.write(`\nsearching for repository root\n`);
    const found =
      findUpSync('.git', { type: 'directory' }) ||
      findUpSync('.svn', { type: 'directory' }) ||
      findUpSync('.hg', { type: 'directory' });
    if (found) {
      process.stdout.write(`\nfound repository root: ${found}\n`);
      result = join(found, '..');
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for repository root: ${e}\n`);
  }

  try {
    const splitDirname = __dirname.split('node_modules');
    process.stdout.write(`\nsplitDirname: ${splitDirname}\n`);
    const isSplitDirnameReachable = !relative(splitDirname[0], process.cwd()).startsWith('..');
    process.stdout.write(`\nisSplitDirnameReachable: ${isSplitDirnameReachable}\n`);
    result =
      result ||
      (isSplitDirnameReachable
        ? splitDirname.length >= 2
          ? splitDirname[0]
          : undefined
        : undefined);
  } catch (e) {
    process.stdout.write(`\nerror searching for splitDirname: ${e}\n`);
  }

  try {
    process.stdout.write(`\nsearching for lock file\n`);
    const found = findUpSync(LOCK_FILES, {
      type: 'file',
    });
    if (found) {
      process.stdout.write(`\nfound lock file: ${found}\n`);
      result = result || join(found, '..');
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for lock file: ${e}\n`);
  }

  process.stdout.write(`\nresult: ${result}\n`);
  projectRoot = result || process.cwd();

  return projectRoot;
};

export const invalidateProjectRootCache = () => {
  projectRoot = undefined;
};

export const nodePathsToArray = (nodePath: string) =>
  nodePath
    .split(process.platform === 'win32' ? ';' : ':')
    .filter(Boolean)
    .map((p) => resolve('./', p));

const relativePattern = /^\.{1,2}([/\\]|$)/;

/** Ensures that a path starts with `./` or `../`, or is entirely `.` or `..` */
export function normalizeStoryPath(filename: string) {
  if (relativePattern.test(filename)) {
    return filename;
  }

  return `.${sep}${filename}`;
}
