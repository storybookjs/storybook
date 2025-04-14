import { join, resolve, sep } from 'node:path';

import { findUpSync } from 'find-up';

export const getProjectRoot = () => {
  let result;
  // Allow manual override in cases where auto-detect doesn't work
  if (process.env.STORYBOOK_PROJECT_ROOT) {
    return process.env.STORYBOOK_PROJECT_ROOT;
  }

  try {
    const found = findUpSync('.git', { type: 'directory' });
    if (found) {
      result = join(found, '..');
    }
  } catch (e) {
    //
  }
  try {
    const found = findUpSync('.svn', { type: 'directory' });
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }
  try {
    const found = findUpSync('.hg', { type: 'directory' });
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }

  try {
    const splitDirname = __dirname.split('node_modules');
    result = result || (splitDirname.length >= 2 ? splitDirname[0] : undefined);
  } catch (e) {
    //
  }

  try {
    const found = findUpSync('.yarn', { type: 'directory' });
    if (found) {
      result = result || join(found, '..');
    }
  } catch (e) {
    //
  }

  return result || process.cwd();
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
