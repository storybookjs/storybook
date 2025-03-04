// eslint-disable-next-line depend/ban-dependencies
import { pathExists } from 'fs-extra';
import { join } from 'path';
import { sep } from 'path';

export async function findFirstPath(paths: string[], { cwd }: { cwd: string }) {
  for (const filePath of paths) {
    if (await pathExists(join(cwd, filePath))) {
      return filePath;
    }
  }
  return null;
}

export const replaceSrcWithDist = (path: string): string => {
  const parts = path.split(sep);
  const index = parts.lastIndexOf('src');
  if (index !== -1) {
    parts[index] = 'dist';
  }
  return parts.join(sep);
};
