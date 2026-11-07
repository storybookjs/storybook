import * as fs from 'node:fs';
import { createRequire } from 'node:module';

import * as path from 'pathe';

// Maps a package to the dependencies copied with it, which land beside it rather than nested.
export interface PackageTree {
  [name: string]: PackageTree;
}

// Each dependency resolves from the package that depends on it, because pnpm installs a package's
// dependencies beside its real path instead of in one shared node_modules. The top level resolves
// from this package, so it may only name dependencies of @storybook/docgen-harness.
export function copyPackages(nodeModules: string, tree: PackageTree): void {
  copyFrom(createRequire(import.meta.url), nodeModules, tree);
}

function copyFrom(
  require: ReturnType<typeof createRequire>,
  nodeModules: string,
  tree: PackageTree
): void {
  for (const [name, dependencies] of Object.entries(tree)) {
    const source = path.dirname(require.resolve(`${name}/package.json`));
    fs.cpSync(source, path.join(nodeModules, name), {
      recursive: true,
      dereference: true,
      // Only pnpm's bin shims or other installs live there; the tree copies each dependency itself.
      filter: (file) => path.relative(source, file) !== 'node_modules',
    });
    copyFrom(createRequire(path.join(source, 'package.json')), nodeModules, dependencies);
  }
}
