import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { dirname, isAbsolute, join, resolve } from 'pathe';
import { exports as resolveExports } from 'resolve.exports';

import { isModuleDirectory } from './extract';

const require = createRequire(import.meta.url);

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

/**
 * External mean not absolute, and not relative
 *
 * We use `require.resolve` here, because import.meta.resolve needs a experimental node flag
 * (`--experimental-import-meta-resolve`) to be enabled to respect the context option.
 *
 * @param path - The path to the mock file
 * @param from - The root of the project, this should be an absolute path
 * @returns True if the mock path is external, false otherwise
 * @link https://nodejs.org/api/cli.html#--experimental-import-meta-resolve
 */
export function isExternal(path: string, from: string) {
  try {
    return !isAbsolute(path) && isModuleDirectory(require.resolve(path, { paths: [from] }));
  } catch (e) {
    return false;
  }
}

/**
 * Normalizes a file path for comparison, resolving symlinks if possible. Falls back to the original
 * path if resolution fails.
 */
export function getRealPath(path: string, preserveSymlinks: boolean): string {
  try {
    return preserveSymlinks ? realpathSync(path) : path;
  } catch {
    return path;
  }
}

/**
 * This is a wrapper around `require.resolve` that tries to resolve the path with different file
 * extensions.
 *
 * @param path - The path to the mock file
 * @param from - The root of the project, this should be an absolute path
 * @returns The resolved path
 */
export function resolveWithExtensions(path: string, from: string) {
  const extensions = ['.js', '.ts', '.tsx', '.mjs', '.cjs', '.svelte', '.vue'];

  for (const extension of extensions) {
    try {
      return require.resolve(path + extension, { paths: [from] });
    } catch (e) {
      continue;
    }
  }

  return require.resolve(path, { paths: [from] });
}
