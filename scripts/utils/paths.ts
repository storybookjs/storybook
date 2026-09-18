import { access } from 'node:fs/promises';

import { join } from 'path';

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export async function findFirstPath(paths: string[], { cwd }: { cwd: string }) {
  for (const filePath of paths) {
    if (await pathExists(join(cwd, filePath))) {
      return filePath;
    }
  }
  return null;
}
