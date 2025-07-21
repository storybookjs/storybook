import { fileURLToPath } from 'node:url';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { isAbsolute, join, resolve } from 'pathe';

import { isModuleDirectory } from './extract';

export function resolveMock(mockPath: string, root: string, previewConfigPath: string) {
  const isExternal = (function () {
    try {
      return (
        !isAbsolute(mockPath) &&
        isModuleDirectory(fileURLToPath(import.meta.resolve(mockPath, root)))
      );
    } catch (e) {
      return false;
    }
  })();

  const external = isExternal ? mockPath : null;

  const absolutePath = external
    ? fileURLToPath(import.meta.resolve(mockPath, root))
    : fileURLToPath(import.meta.resolve(join(previewConfigPath, '..', mockPath), root));

  const normalizedAbsolutePath = resolve(absolutePath);

  const redirectPath = findMockRedirect(root, normalizedAbsolutePath, external);

  return {
    absolutePath: normalizedAbsolutePath,
    redirectPath, // will be null if no __mocks__ file is found
  };
}
