import { join } from 'node:path';

import { pathExists } from '@ndelangen/fs-extra-unified';

export async function findFirstPath(paths: string[], { cwd }: { cwd: string }) {
  for (const filePath of paths) {
    if (await pathExists(join(cwd, filePath))) {
      return filePath;
    }
  }
  return null;
}
