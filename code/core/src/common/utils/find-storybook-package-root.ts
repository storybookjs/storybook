import { readFileSync, realpathSync } from 'node:fs';

import { dirname, join, normalize } from 'pathe';

/**
 * Find the root directory of the package named `name` that `fromDir` belongs to, as a realpathed
 * normalized path.
 *
 * Walks up from `fromDir` to the first `package.json` whose `name` matches; manifests with other
 * names, such as ESM/CJS type markers in dist subfolders, are skipped. Returns `undefined` when no
 * such manifest exists.
 */
export function findPackageRoot(fromDir: string, name: string): string | undefined {
  let dir = normalize(fromDir);
  while (true) {
    if (readManifestName(dir) === name) {
      try {
        return normalize(realpathSync(dir));
      } catch {
        return undefined;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/** Find the root directory of the `storybook` package that `fromDir` belongs to. */
export function findStorybookPackageRoot(fromDir: string): string | undefined {
  return findPackageRoot(fromDir, 'storybook');
}

function readManifestName(dir: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as {
      name?: unknown;
    };
    return typeof manifest.name === 'string' ? manifest.name : undefined;
  } catch {
    return undefined;
  }
}
