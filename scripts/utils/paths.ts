// eslint-disable-next-line depend/ban-dependencies
import { pathExists } from 'fs-extra';
import { join } from 'path';

export async function findFirstPath(
  paths: string[],
  { cwd }: { cwd: string }
): Promise<string | null> {
  for (const filePath of paths) {
    if (await pathExists(join(cwd, filePath))) {
      return filePath;
    }
  }
  return null;
}
