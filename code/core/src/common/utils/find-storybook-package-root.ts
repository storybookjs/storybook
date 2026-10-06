import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { dirname, join, normalize } from 'pathe';

const ownDir = normalize(dirname(fileURLToPath(import.meta.url)));

/**
 * Find the root directory of the `storybook` package this module runs from, as a realpathed
 * normalized path.
 *
 * Walks up from this module's own directory to the first `package.json` whose `name` is
 * `storybook`; manifests with other names, such as ESM/CJS type markers in dist subfolders, are
 * skipped. Returns `undefined` when no such manifest exists.
 */
export function findStorybookPackageRoot(): string | undefined {
  let dir = ownDir;
  while (true) {
    if (readManifestName(dir) === 'storybook') {
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
