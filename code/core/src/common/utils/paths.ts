import { join, relative, resolve, sep } from 'node:path';

import * as find from 'empathic/find';

import { LOCK_FILES } from '../js-package-manager/constants';

let projectRoot: string | undefined;

export const getProjectRoot = () => {
  if (projectRoot) {
    return projectRoot;
  }

  let result;
  // Allow manual override in cases where auto-detect doesn't work
  if (process.env.STORYBOOK_PROJECT_ROOT) {
    return process.env.STORYBOOK_PROJECT_ROOT;
  }

  try {
    const found = find.up('.git');
    if (found) {
      result = join(found, '..');
    }
  } catch (e) {
    //
  }

  try {
    const found = find.up('.svn');
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }

  try {
    const found = find.up('.hg');
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }

  try {
    const splitDirname = __dirname.split('node_modules');
    const isSplitDirnameReachable = !relative(splitDirname[0], process.cwd()).startsWith('..');
    result =
      result ||
      (isSplitDirnameReachable
        ? splitDirname.length >= 2
          ? splitDirname[0]
          : undefined
        : undefined);
  } catch (e) {
    //
  }

  try {
    const found = find.any(LOCK_FILES); // TODO: is the 'file' check required?
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }

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
