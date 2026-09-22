import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it.each([
    ['2.0.7', '3.0.3', null],
    ['2.0.7', '3.0.0-beta.1', null],
    ['2.0.7', '2.0.8', '2.0.8'],
    ['3.0.0', '3.0.3', '3.0.3'],
  ])(
    'handles msw-storybook-addon %s to %s',
    async (beforeVersion, afterVersion, expectedVersion) => {
      vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([]);

      const packageManager = {
        getAllDependencies: () => ({ 'msw-storybook-addon': beforeVersion }),
        getInstalledVersion: async () => beforeVersion,
        latestVersion: async () => afterVersion,
      };

      await expect(check({ packageManager })).resolves.toEqual(
        expectedVersion === null
          ? null
          : {
              upgradable: [
                {
                  packageName: 'msw-storybook-addon',
                  beforeVersion,
                  afterVersion: expectedVersion,
                },
              ],
            }
      );
    }
  );

  it('keeps unrelated community-package major upgrades', async () => {
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([]);

    const packageManager = {
      getAllDependencies: () => ({ '@example/storybook-addon': '1.0.0' }),
      getInstalledVersion: async () => '1.0.0',
      latestVersion: async () => '2.0.0',
    };

    await expect(check({ packageManager })).resolves.toEqual({
      upgradable: [
        {
          packageName: '@example/storybook-addon',
          beforeVersion: '1.0.0',
          afterVersion: '2.0.0',
        },
      ],
    });
  });

  it('keeps unrelated upgrades while excluding msw-storybook-addon crossings', async () => {
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([]);

    const packageManager = {
      getAllDependencies: () => ({
        'msw-storybook-addon': '2.0.7',
        '@example/storybook-addon': '1.0.0',
      }),
      getInstalledVersion: async (packageName: string) =>
        packageName === 'msw-storybook-addon' ? '2.0.7' : '1.0.0',
      latestVersion: async (packageName: string) =>
        packageName === 'msw-storybook-addon' ? '3.0.3' : '2.0.0',
    };

    await expect(check({ packageManager })).resolves.toEqual({
      upgradable: [
        {
          packageName: '@example/storybook-addon',
          beforeVersion: '1.0.0',
          afterVersion: '2.0.0',
        },
      ],
    });
  });
});
