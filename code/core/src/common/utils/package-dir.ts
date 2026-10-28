import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { fileURLToPath } from 'node:url';

import { dirname, join } from 'pathe';

let corePackageDir: string | undefined;

/**
 * Resolve this package's root from the running module, so it holds under any package name and
 * from both source and bundled chunks.
 */
export function getCorePackageDir(): string {
  if (corePackageDir) {
    return corePackageDir;
  }
  // `findPackageJSON` (Node >= 22.14) bypasses `node:fs`, which many unit tests mock.
  const packageJson = nodeModule.findPackageJSON?.(import.meta.url);
  if (packageJson) {
    return (corePackageDir = dirname(packageJson));
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find the package root of ${import.meta.url}`);
    }
    dir = parent;
  }
  return (corePackageDir = dir);
}
