import { findMockRedirect } from '@vitest/mocker/redirect';
import { isAbsolute, join } from 'path';

import { isModuleDirectory } from './extract';

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
    : require.resolve(join(previewConfigPath, '..', mockPath), {
        paths: [root],
      });

  const redirectPath = findMockRedirect(root, absolutePath, external);

  return {
    absolutePath,
    redirectPath, // will be null if no __mocks__ file is found
  };
}
