import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import * as docsUtils from '../../doctor/getIncompatibleStorybookPackages';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';

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
        packageName: '@storybook/preset-create-react-app',
        packageVersion: '3.2.0',
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
        '@storybook/preset-create-react-app': '3.2.0',
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
            "beforeVersion": "3.2.0",
            "packageName": "@storybook/preset-create-react-app",
          },
        ],
      }
    `);
  });
});
