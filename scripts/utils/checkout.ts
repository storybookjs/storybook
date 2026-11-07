import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';

import { join } from 'pathe';

// Not from constants.ts, whose `__dirname` build-package.ts cannot load under plain Node.
const ROOT_DIRECTORY = join(import.meta.dirname, '../..');

const contentOf = (file: string) => {
  const stats = lstatSync(file, { throwIfNoEntry: false });
  if (!stats) {
    return 'deleted';
  }
  return stats.isFile() ? createHash('sha1').update(readFileSync(file)).digest('hex') : 'directory';
};

// The files under `paths` that differ from the index and that git does not ignore, with a hash of
// their content, so a file that was already changed and is changed again shows.
export function checkoutChanges(
  cwd: string = ROOT_DIRECTORY,
  paths: string[] = []
): Map<string, string> {
  const files = execFileSync(
    'git',
    ['ls-files', '--modified', '--others', '--exclude-standard', '-z', '--', ...paths],
    { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
    .split('\0')
    .filter(Boolean);
  return new Map(files.map((file) => [file, contentOf(join(cwd, file))]));
}

export function checkoutChangesSince(
  before: Map<string, string>,
  cwd?: string,
  paths?: string[]
): string[] {
  return [...checkoutChanges(cwd, paths)]
    .filter(([file, content]) => before.get(file) !== content)
    .map(([file]) => file);
}
