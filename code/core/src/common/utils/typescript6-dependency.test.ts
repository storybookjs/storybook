import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { TYPESCRIPT6_PACKAGE, typescript6PackageToInstall } from './typescript6-dependency.ts';

const packageManager = (
  dependencies: Record<string, string>,
  installed: string | null
): Pick<JsPackageManager, 'getAllDependencies' | 'getInstalledVersion'> => ({
  getAllDependencies: () => dependencies,
  getInstalledVersion: vi.fn().mockResolvedValue(installed),
});

describe('typescript6PackageToInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('installs when TypeScript 7 is installed', async () => {
    await expect(
      typescript6PackageToInstall(packageManager({ typescript: '^7.0.0' }, '7.0.2'))
    ).resolves.toBe(TYPESCRIPT6_PACKAGE);
  });

  it('installs from the declared range when TypeScript 7 is not installed yet', async () => {
    await expect(
      typescript6PackageToInstall(packageManager({ typescript: '^7.0.0' }, null))
    ).resolves.toBe(TYPESCRIPT6_PACKAGE);
  });

  it('prefers the installed version over an older range', async () => {
    await expect(
      typescript6PackageToInstall(packageManager({ typescript: '^6.0.0' }, '7.1.0'))
    ).resolves.toBe(TYPESCRIPT6_PACKAGE);
  });

  it('skips TypeScript 6', async () => {
    await expect(
      typescript6PackageToInstall(packageManager({ typescript: '^6.0.3' }, '6.0.3'))
    ).resolves.toBeNull();
  });

  it('skips when @typescript/typescript6 is already a dependency', async () => {
    await expect(
      typescript6PackageToInstall(
        packageManager({ typescript: '^7.0.0', '@typescript/typescript6': '^6.0.2' }, '7.0.2')
      )
    ).resolves.toBeNull();
  });

  it('skips projects without TypeScript', async () => {
    await expect(typescript6PackageToInstall(packageManager({}, null))).resolves.toBeNull();
  });
});
