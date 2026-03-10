import { join, relative, resolve, sep } from 'node:path';

import * as find from 'empathic/find';
import * as walk from 'empathic/walk';
import { globSync } from 'tinyglobby';

import { LOCK_FILES } from '../js-package-manager/constants';

let projectRoot: string | undefined;

export const getProjectRoot = () => {
  if (projectRoot) {
    return projectRoot;
  }

  // Allow manual override in cases where auto-detect doesn't work
  if (process.env.STORYBOOK_PROJECT_ROOT) {
    return process.env.STORYBOOK_PROJECT_ROOT;
  }

  try {
    const found = find.up('.git') || find.up('.svn') || find.up('.hg');
    if (found) {
      projectRoot = join(found, '..');
      return projectRoot;
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for repository root: ${e}\n`);
  }

  try {
    const found = find.any(LOCK_FILES);
    if (found) {
      projectRoot = join(found, '..');
      return projectRoot;
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for lock file: ${e}\n`);
  }

  try {
    const [basePath, rest] = __dirname.split(`${sep}node_modules${sep}`, 2);
    if (
      rest &&
      !basePath.includes(`${sep}npm-cache${sep}`) &&
      !relative(basePath, process.cwd()).startsWith('..')
    ) {
      projectRoot = basePath;
      return projectRoot;
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for splitDirname: ${e}\n`);
  }

  projectRoot = process.cwd();
  return projectRoot;
};

export const invalidateProjectRootCache = () => {
  projectRoot = undefined;
};

/** Finds files in the directory tree up to the project root */
export const findFilesUp = (matchers: string[], baseDir = process.cwd()) => {
  const matchingFiles: string[] = [];
  for (const directory of walk.up(baseDir, { last: getProjectRoot() })) {
    matchingFiles.push(...globSync(matchers, { cwd: directory, absolute: true }));
  }

  return matchingFiles;
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
