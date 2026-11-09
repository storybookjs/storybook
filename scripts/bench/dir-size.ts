import { readdir, stat } from 'node:fs/promises';

import { join } from 'pathe';

/**
 * Sums the sizes of the files under `dirPath`, counting a file that is hard linked under several
 * names once. npm runs esbuild's postinstall, which hard-links the platform binary to
 * `esbuild/bin/esbuild` unless Yarn is the installer.
 */
export async function getDirSize(dirPath: string) {
  const entries = await readdir(dirPath, { recursive: true, withFileTypes: true });
  const stats = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => stat(join(entry.parentPath, entry.name)))
  );
  const files = new Map(stats.map(({ dev, ino, size }) => [`${dev}:${ino}`, size]));
  return [...files.values()].reduce((total, size) => total + size, 0);
}
