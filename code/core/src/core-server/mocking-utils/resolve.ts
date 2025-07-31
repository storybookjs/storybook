import { readFileSync } from 'node:fs';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { dirname, isAbsolute, join, resolve } from 'pathe';
import { exports as resolveExports } from 'resolve.exports';

import { isModuleDirectory } from './extract';

/**
 * Finds the package.json for a given module specifier.
 *
 * @param specifier The module specifier (e.g., 'uuid', 'lodash-es/add').
 * @param basedir The directory to start the search from.
 * @returns The path to the package.json and the package's contents.
 */
function findPackageJson(specifier: string, basedir: string): { path: string; data: any } {
  const packageJsonPath = require.resolve(`${specifier}/package.json`, { paths: [basedir] });
  return {
    path: packageJsonPath,
    data: JSON.parse(readFileSync(packageJsonPath, 'utf-8')),
  };
}

/**
 * Resolves an external module path to its absolute path. It considers the "exports" map in the
 * package.json file.
 *
 * @param path The raw module path from the `sb.mock()` call.
 * @param root The project's root directory.
 * @returns The absolute path to the module.
 */
export function resolveExternalModule(path: string, root: string) {
  // --- External Package Resolution ---
  const parts = path.split('/');
  // For scoped packages like `@foo/bar`, the package name is the first two parts.
  const packageName = path.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  const entry = `.${path.slice(packageName.length)}`; // e.g., './add' from 'lodash-es/add'

  const { path: packageJsonPath, data: pkg } = findPackageJson(packageName, root);
  const packageDir = dirname(packageJsonPath);

  // 1. Try to resolve using the "exports" map.
  if (pkg.exports) {
    const result = resolveExports(pkg, entry, {
      browser: true,
    });

    if (result) {
      return join(packageDir, result[0]);
    }
  }

  return require.resolve(path, { paths: [root] });
}

export function getIsExternal(path: string, importer: string) {
  try {
    return !isAbsolute(path) && isModuleDirectory(require.resolve(path, { paths: [importer] }));
  } catch (e) {
    return false;
  }
}

/**
 * Resolves a mock path to its absolute path and checks for a `__mocks__` redirect. This function
 * uses `resolve.exports` to correctly handle modern ESM packages.
 *
 * @param path The raw module path from the `sb.mock()` call.
 * @param root The project's root directory.
 * @param importer The absolute path of the file containing the mock call (the preview file).
 */
export function resolveMock(path: string, root: string, importer: string) {
  const isExternal = getIsExternal(path, root);
  const externalPath = isExternal ? path : null;

  const absolutePath = isExternal
    ? resolveExternalModule(path, root)
    : require.resolve(path, { paths: [dirname(importer)] });

  const normalizedAbsolutePath = resolve(absolutePath);

  const redirectPath = findMockRedirect(root, normalizedAbsolutePath, externalPath);

  return {
    absolutePath: normalizedAbsolutePath,
    redirectPath, // will be null if no __mocks__ file is found
  };
}
