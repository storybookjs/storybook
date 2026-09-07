import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { PackageJson } from 'storybook/internal/types';

import * as resolve from 'empathic/resolve';

/**
 * Reads a dependency's own `package.json`, resolved relative to `directory`.
 *
 * `<dep>/package.json` cannot reliably be resolved as a subpath: subpath
 * resolution runs through the package's `exports` field, and a `"./*"` wildcard
 * (e.g. refractor's `"./*": "./lang/*.js"`) remaps `package.json` to a file
 * that does not exist.
 *
 * Strategy:
 *
 * 1. Try the subpath anyway — correct for packages with no `exports` field, or
 *    that explicitly expose `"./package.json"`.
 * 2. On failure, resolve the package's main entry (the `"."` export, which a
 *    `"./*"` wildcard never affects) and walk up to the package root.
 *
 * `empathic/resolve` wraps Node's `createRequire().resolve()`, so both passes
 * stay correct under hoisted monorepos and Yarn PnP.
 *
 * @param directory Directory to resolve `dependency` from (Node module resolution).
 * @param dependency Bare package name, e.g. `react` or `@scope/pkg`.
 * @returns The parsed `package.json`, or `undefined` if it cannot be resolved.
 *   Never throws.
 */
export const readDependencyManifest = async (
  directory: string,
  dependency: string
): Promise<PackageJson | undefined> => {
  // Fast path: subpath resolution. Correct for packages with no `exports`
  // field, or that explicitly expose `"./package.json"`.
  const subpath = resolve.from(directory, join(dependency, 'package.json'), true);
  if (subpath) {
    try {
      const manifest = JSON.parse(await readFile(subpath, { encoding: 'utf8' }));
      // A `name` confirms this is a real manifest, and not a file an `exports`
      // wildcard happened to remap `package.json` onto.
      if (manifest?.name) {
        return manifest;
      }
    } catch {
      // Not readable / not JSON — fall through to entry-based resolution.
    }
  }

  // Fallback: the package's `exports` blocks subpath access. Resolve its main
  // entry instead, then walk up to the package's own `package.json`.
  const entry = resolve.from(directory, dependency, true);
  if (!entry) {
    logger.debug(`readDependencyManifest: could not resolve "${dependency}"`);
    return undefined;
  }

  let dir = dirname(entry);
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(join(dir, 'package.json'), { encoding: 'utf8' }));
      // Only the package root carries a `name`; skip nested `package.json`
      // markers such as a `dist/package.json` holding just `{ "type": "module" }`.
      if (manifest?.name) {
        return manifest;
      }
    } catch {
      // No (or invalid) `package.json` at this level — keep walking up.
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
};
