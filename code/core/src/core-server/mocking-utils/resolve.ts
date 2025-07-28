import { createRequire } from 'node:module';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { isAbsolute, join, resolve } from 'pathe';

import { isModuleDirectory } from './extract';

const require = createRequire(import.meta.url);

export function resolveMock(mockPath: string, root: string, previewConfigPath: string) {
  const external = isExternal(mockPath, root) ? mockPath : null;

  const absolutePath = external
    ? require.resolve(mockPath, { paths: [root] })
    : require.resolve(join(previewConfigPath, '..', mockPath), { paths: [root] });

  const normalizedAbsolutePath = resolve(absolutePath);

  const redirectPath = findMockRedirect(root, normalizedAbsolutePath, external);

  return {
    absolutePath: normalizedAbsolutePath,
    redirectPath, // will be null if no __mocks__ file is found
  };
}

/**
 * External mean not absolute, and not relative
 *
 * We use `require.resolve` here, becasue import.meta.resolve needs a experimental node flag
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
