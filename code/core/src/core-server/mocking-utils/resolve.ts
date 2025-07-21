import { createRequire } from 'node:module';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { isAbsolute, join, resolve } from 'pathe';

import { isModuleDirectory } from './extract';

const require = createRequire(import.meta.url);

export function resolveMock(mockPath: string, root: string, previewConfigPath: string) {
  const isExternal = (function () {
    try {
      return (
        !isAbsolute(mockPath) && isModuleDirectory(require.resolve(mockPath, { paths: [root] }))
      );
    } catch (e) {
      return false;
    }
  })();

  const external = isExternal ? mockPath : null;

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
