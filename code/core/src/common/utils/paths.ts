import { join, relative, resolve, sep } from 'node:path';

import * as find from 'empathic/find';
import * as walk from 'empathic/walk';
import { globSync } from 'tinyglobby';

import { getInstanceContext } from '../../shared/instance-context.ts';
import { LOCK_FILES } from '../js-package-manager/constants.ts';

const PROJECT_ROOT = Symbol.for('storybook.instance.project-root');

/** The running instance's working directory, or `process.cwd()` outside an instance. */
export const getCurrentWorkingDir = (): string => getInstanceContext()?.workingDir ?? process.cwd();

/** Finds the project root above `cwd` without caching, for code that has no instance. */
export const findProjectRoot = (cwd: string = process.cwd()): string => {
  // Allow manual override in cases where auto-detect doesn't work
  if (process.env.STORYBOOK_PROJECT_ROOT) {
    return process.env.STORYBOOK_PROJECT_ROOT;
  }

  try {
    const found = find.up('.git', { cwd }) || find.up('.svn', { cwd }) || find.up('.hg', { cwd });
    if (found) {
      return join(found, '..');
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for repository root: ${e}\n`);
  }

  try {
    const found = find.any(LOCK_FILES, { cwd });
    if (found) {
      return join(found, '..');
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for lock file: ${e}\n`);
  }

  try {
    const [basePath, rest] = __dirname.split(`${sep}node_modules${sep}`, 2);
    if (
      rest &&
      !basePath.includes(`${sep}npm-cache${sep}`) &&
      !relative(basePath, cwd).startsWith('..')
    ) {
      return basePath;
    }
  } catch (e) {
    process.stdout.write(`\nerror searching for splitDirname: ${e}\n`);
  }

  return cwd;
};

/** The running instance's project root, cached on the instance; found from `process.cwd()` outside one. */
export const getProjectRoot = (): string => {
  const context = getInstanceContext();
  if (!context) {
    return findProjectRoot();
  }
  if (!context.state.has(PROJECT_ROOT)) {
    context.state.set(PROJECT_ROOT, findProjectRoot(context.workingDir));
  }
  return context.state.get(PROJECT_ROOT) as string;
};

/** Forgets the running instance's cached project root. */
export const invalidateProjectRootCache = (): void => {
  getInstanceContext()?.state.delete(PROJECT_ROOT);
};

/** Finds files in the directory tree up to the project root */
export const findFilesUp = (
  matchers: string[],
  baseDir: string = getCurrentWorkingDir()
): string[] => {
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
