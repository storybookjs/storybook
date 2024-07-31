import { pathExists } from 'fs-extra';
import { join } from 'path';

export async function findFirstPath(paths: string[], { cwd }: { cwd: string }) {
  for (const filePath of paths) {
    if (await pathExists(join(cwd, filePath))) return filePath;
  }
  return null;
}
