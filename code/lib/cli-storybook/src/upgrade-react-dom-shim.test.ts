import { afterEach, expect, it, vi } from 'vitest';

import { JsPackageManagerFactory, PackageManagerName, versions } from 'storybook/internal/common';

import { generateUpgradeSpecs } from './util.ts';

afterEach(() => vi.restoreAllMocks());

it.each([
  { name: 'release', isCanary: false, storybookVersionSpecifier: undefined },
  { name: 'prerelease', isCanary: true, storybookVersionSpecifier: undefined },
  {
    name: 'PR build',
    isCanary: true,
    storybookVersionSpecifier: 'https://pkg.pr.new/storybook@727f36e',
  },
])('does not schedule the removed shim for a $name upgrade', async (target) => {
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: PackageManagerName.NPM,
  });
  const latestVersion = vi.spyOn(packageManager, 'latestVersion').mockResolvedValue(null);
  const dependencies = Object.freeze({
    storybook: '10.5.10',
    '@storybook/react-dom-shim': '10.5.10',
    react: '19.1.1',
  });

  const result = await generateUpgradeSpecs(dependencies, {
    packageManager,
    isCanary: target.isCanary,
    isCLIOutdated: false,
    isCLIPrerelease: target.isCanary,
    isCLIExactPrerelease: target.isCanary,
    isCLIExactLatest: !target.isCanary,
    storybookVersionSpecifier: target.storybookVersionSpecifier,
  });

  expect(result).toEqual([`storybook@${target.storybookVersionSpecifier ?? versions.storybook}`]);
  expect(latestVersion).not.toHaveBeenCalled();
  expect(dependencies['@storybook/react-dom-shim']).toBe('10.5.10');
});
