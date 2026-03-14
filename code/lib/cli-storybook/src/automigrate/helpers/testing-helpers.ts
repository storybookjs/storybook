import { vi } from 'vitest';

import type {
  JsPackageManager,
  PackageJson,
  PackageJsonWithDepsAndDevDeps,
} from 'storybook/internal/common';

vi.mock('./mainConfigFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mainConfigFile')>()),
  getStorybookData: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  loadMainConfig: vi.fn(),
}));

export const makePackageManager = (packageJson: PackageJson) => {
  const { dependencies = {}, devDependencies = {}, peerDependencies = {} } = packageJson;
  return {
    primaryPackageJson: {
      packageJson: {
        dependencies: {},
        devDependencies: {},
        ...packageJson,
      } as PackageJsonWithDepsAndDevDeps,
      packageJsonPath: '/some/path',
      operationDir: '/some/path',
    },
    getAllDependencies: () => ({
      ...dependencies,
      ...devDependencies,
      ...peerDependencies,
    }),
  } as JsPackageManager;
};
