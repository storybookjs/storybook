import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManagerFactory, PackageManagerName } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import * as docsUtils from '../../doctor/getIncompatibleStorybookPackages.ts';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies.ts';

vi.mock('../../doctor/getIncompatibleStorybookPackages');
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

const check = async ({
  packageManager,
  main: mainConfig = {},
  storybookVersion = '9.0.0',
}: {
  packageManager: Partial<JsPackageManager>;
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return upgradeStorybookRelatedDependencies.check({
    packageManager: packageManager as any,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });
};

describe('upgrade-storybook-related-dependencies fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect storyshots registered in main.js', async () => {
    const analyzedPackages = [
      {
        packageName: '@chromatic-com/storybook',
        packageVersion: '1.2.9',
        availableUpgrade: '2.0.0',
        hasIncompatibleDependencies: false,
      },
      {
        packageName: '@storybook/jest',
        packageVersion: '0.2.3',
        availableUpgrade: '1.0.0',
        hasIncompatibleDependencies: false,
      },
      {
        packageName: '@storybook/addon-a11y',
        packageVersion: '7.0.0',
        availableUpgrade: '8.0.0',
        hasIncompatibleDependencies: true,
      },
      {
        packageName: 'storybook',
        packageVersion: '8.0.0',
        availableUpgrade: '8.0.0',
        hasIncompatibleDependencies: true,
      },
    ];
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue(analyzedPackages);

    // Mock the package.json content
    const mockPackageJson = {
      dependencies: {
        '@storybook/jest': '0.2.3',
        '@storybook/addon-a11y': '7.0.0',
      },
      devDependencies: {
        '@chromatic-com/storybook': '1.2.9',
        storybook: '8.0.0',
      },
    };

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

    const mockPackageManager = {
      getAllDependencies: () =>
        analyzedPackages.reduce(
          (acc, { packageName, packageVersion }) => {
            acc[packageName] = packageVersion;
            return acc;
          },
          {} as Record<string, string>
        ),
      latestVersion: async (pkgName: string) =>
        analyzedPackages.find((pkg) => pkg.packageName === pkgName)?.availableUpgrade || '',
      getInstalledVersion: async (pkgName: string) =>
        analyzedPackages.find((pkg) => pkg.packageName === pkgName)?.packageVersion || null,
      packageJsonPaths: ['package.json'],
    };

    await expect(
      check({
        packageManager: mockPackageManager,
      })
    ).resolves.toMatchInlineSnapshot(`
      {
        "upgradable": [
          {
            "afterVersion": "1.0.0",
            "beforeVersion": "0.2.3",
            "packageName": "@storybook/jest",
          },
          {
            "afterVersion": "8.0.0",
            "beforeVersion": "7.0.0",
            "packageName": "@storybook/addon-a11y",
          },
        ],
      }
    `);
  });

  it('does not upgrade the removed react-dom shim package', async () => {
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([
      {
        packageName: '@storybook/react-dom-shim',
        packageVersion: '10.5.10',
        availableUpdate: '11.0.0-alpha.1',
        hasIncompatibleDependencies: true,
      },
      {
        packageName: '@storybook/jest',
        packageVersion: '0.2.3',
        availableUpdate: '1.0.0',
        hasIncompatibleDependencies: false,
      },
    ]);

    const latestVersion = vi.fn().mockResolvedValue('1.0.0');
    const getInstalledVersion = vi.fn().mockResolvedValue('0.2.3');
    const packageManager = {
      getAllDependencies: () => ({
        '@storybook/react-dom-shim': '10.5.10',
        '@storybook/jest': '0.2.3',
        'storybook-shim': 'npm:@storybook/react-dom-shim@10.5.10',
      }),
      latestVersion,
      getInstalledVersion,
      packageJsonPaths: ['package.json'],
    };

    await expect(check({ packageManager, storybookVersion: '10.5.10' })).resolves.toEqual({
      upgradable: [
        {
          packageName: '@storybook/jest',
          beforeVersion: '0.2.3',
          afterVersion: '1.0.0',
        },
      ],
    });
    expect(latestVersion).toHaveBeenCalledExactlyOnceWith('@storybook/jest');
    expect(getInstalledVersion).toHaveBeenCalledExactlyOnceWith('@storybook/jest');
  });

  it('does not rewrite removed shim entries from a supplied result', async () => {
    const packageJson = {
      dependencies: {
        '@storybook/react-dom-shim': '10.5.10',
        '@chromatic-com/storybook': '1.2.9',
      },
      devDependencies: {
        'storybook-shim': 'npm:@storybook/react-dom-shim@10.5.10',
      },
      peerDependencies: {
        '@storybook/react-dom-shim': '^10.0.0',
      },
    };
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packageJson));

    const packageManager = JsPackageManagerFactory.getPackageManager({
      force: PackageManagerName.NPM,
    });
    packageManager.packageJsonPaths = ['package.json'];
    const writePackageJson = vi.spyOn(packageManager, 'writePackageJson').mockImplementation(() => {
      return undefined;
    });

    await upgradeStorybookRelatedDependencies.run({
      result: {
        upgradable: [
          {
            packageName: '@storybook/react-dom-shim',
            beforeVersion: '10.5.10',
            afterVersion: '11.0.0-alpha.1',
          },
          {
            packageName: 'storybook-shim',
            beforeVersion: '10.5.10',
            afterVersion: '11.0.0-alpha.1',
          },
          {
            packageName: '@chromatic-com/storybook',
            beforeVersion: '1.2.9',
            afterVersion: '2.0.0',
          },
        ],
      },
      packageManager,
      mainConfigPath: '',
      mainConfig: { stories: [] },
      configDir: '',
      storybookVersion: '11.0.0-alpha.1',
      storiesPaths: [],
    });

    expect(writePackageJson).toHaveBeenCalledExactlyOnceWith(
      {
        ...packageJson,
        dependencies: {
          ...packageJson.dependencies,
          '@chromatic-com/storybook': '^2.0.0',
        },
      },
      '.'
    );
  });
});
