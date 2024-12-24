import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import * as docsUtils from '../../doctor/getIncompatibleStorybookPackages';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';

vi.mock('../../doctor/getIncompatibleStorybookPackages');

const check = async ({
  packageManager,
  main: mainConfig = {},
  storybookVersion = '8.0.0',
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
    await expect(
      check({
        packageManager: {
          getAllDependencies: async () =>
            analyzedPackages.reduce(
              (acc, { packageName, packageVersion }) => {
                acc[packageName] = packageVersion;
                return acc;
              },
              {} as Record<string, string>
            ),
          latestVersion: async (pkgName) =>
            analyzedPackages.find((pkg) => pkg.packageName === pkgName)?.availableUpgrade || '',
          getInstalledVersion: async (pkgName) =>
            analyzedPackages.find((pkg) => pkg.packageName === pkgName)?.packageVersion || null,
        },
      })
    ).resolves.toMatchInlineSnapshot(`
      {
        "upgradable": [
          {
            "afterVersion": "2.0.0",
            "beforeVersion": "1.2.9",
            "packageName": "@chromatic-com/storybook",
          },
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
