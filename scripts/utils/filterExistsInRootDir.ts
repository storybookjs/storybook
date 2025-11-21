import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ROOT_DIRECTORY } from './constants';

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

// packageDirs of the form `lib/preview-api`
// paths to check of the form 'template/stories'
export const filterExistsInRootDir = async (packageDirs: string[], pathToCheck: string) =>
  (
    await Promise.all(
      packageDirs.map(async (p) =>
        (await pathExists(resolve(ROOT_DIRECTORY, join(p, pathToCheck)))) ? p : null
      )
    )
  ).filter(Boolean);
