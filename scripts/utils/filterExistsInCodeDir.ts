import { join, resolve } from 'node:path';

import { pathExists } from 'fs-extra';

import { CODE_DIRECTORY } from './constants';

// packageDirs of the form `lib/preview-api`
// paths to check of the form 'template/stories'
export const filterExistsInCodeDir = async (packageDirs: string[], pathToCheck: string) =>
  (
    await Promise.all(
      packageDirs.map(async (p) =>
        (await pathExists(resolve(CODE_DIRECTORY, join(p, pathToCheck)))) ? p : null
      )
    )
  ).filter(Boolean);
