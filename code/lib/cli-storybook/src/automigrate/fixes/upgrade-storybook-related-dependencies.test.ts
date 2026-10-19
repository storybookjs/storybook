import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import * as docsUtils from '../../doctor/getIncompatibleStorybookPackages.ts';
import { checkFix } from '../helpers/fix-test-utils.ts';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies.ts';

vi.mock('../../doctor/getIncompatibleStorybookPackages');

const check = async ({
  packageManager,
  main: mainConfig = {},
  storybookVersion = '9.0.0',
}: {
  packageManager: Partial<JsPackageManager>;
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return checkFix(upgradeStorybookRelatedDependencies, {
    packageManager: packageManager as any,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
    storiesPaths: [],
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

  it('keeps the major of a lockstep-scoped package whose siblings stay behind', async () => {
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([
      {
        packageName: '@nx/storybook',
        packageVersion: '22.7.5',
        availableUpdate: '23.2.1',
        hasIncompatibleDependencies: true,
      },
    ]);
    const latestVersion = vi.fn(async (_packageName: string, constraint?: string) =>
      constraint === '^22.7.5' ? '22.9.0' : '23.2.1'
    );

    const result = await check({
      packageManager: {
        getAllDependencies: () => ({ '@nx/storybook': '22.7.5', '@nx/web': '22.7.5' }),
        latestVersion,
        getInstalledVersion: async () => '22.7.5',
      },
    });

    expect(result).toEqual({
      upgradable: [
        { packageName: '@nx/storybook', beforeVersion: '22.7.5', afterVersion: '22.9.0' },
      ],
    });
  });

  it('upgrades a package across majors when its scope is not lockstep', async () => {
    vi.mocked(docsUtils.getIncompatibleStorybookPackages).mockResolvedValue([
      {
        packageName: '@chromatic-com/storybook',
        packageVersion: '3.2.7',
        availableUpdate: '4.1.0',
        hasIncompatibleDependencies: true,
      },
    ]);
    const latestVersion = vi.fn(async (_packageName: string, constraint?: string) =>
      constraint === '^3.2.7' ? '3.2.9' : '4.1.0'
    );

    const result = await check({
      packageManager: {
        getAllDependencies: () => ({
          '@chromatic-com/storybook': '3.2.7',
          '@chromatic-com/playwright': '0.10.0',
        }),
        latestVersion,
        getInstalledVersion: async () => '3.2.7',
      },
    });

    expect(result).toEqual({
      upgradable: [
        { packageName: '@chromatic-com/storybook', beforeVersion: '3.2.7', afterVersion: '4.1.0' },
      ],
    });
  });
});
