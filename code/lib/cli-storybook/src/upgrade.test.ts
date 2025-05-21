import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sbcc from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { UpgradeStorybookToLowerVersionError } from 'storybook/internal/server-errors';

import { doUpgrade, getStorybookVersion, toUpgradedDependencies } from './upgrade';

const findInstallationsMock =
  vi.fn<(arg: string[]) => Promise<sbcc.InstallationMetadata | undefined>>();
const getInstalledVersionMock = vi.fn<(arg: string) => Promise<string | undefined>>();

vi.mock('storybook/internal/telemetry');
vi.mock('storybook/internal/common', async (importOriginal) => {
  const originalModule = (await importOriginal()) as typeof sbcc;
  return {
    ...originalModule,
    JsPackageManagerFactory: {
      getPackageManager: () => ({
        findInstallations: findInstallationsMock,
        getInstalledVersion: getInstalledVersionMock,
        latestVersion: async () => '8.0.0',
        retrievePackageJson: async () => {},
        getAllDependencies: async () => ({ storybook: '8.0.0' }),
      }),
    },
    versions: Object.keys(originalModule.versions).reduce(
      (acc, key) => {
        acc[key] = '9.0.0';
        return acc;
      },
      {} as Record<string, string>
    ),
  };
});

describe.each([
  ['│ │ │ ├── @babel/code-frame@7.10.3 deduped', null],
  [
    '├─┬ @storybook/preset-create-react-app@3.1.2',
    { package: '@storybook/preset-create-react-app', version: '3.1.2' },
  ],
  ['│ ├─┬ @storybook/node-logger@5.3.19', { package: '@storybook/node-logger', version: '5.3.19' }],
  [
    'npm ERR! peer dep missing: @storybook/react@>=5.2, required by @storybook/preset-create-react-app@3.1.2',
    null,
  ],
])('getStorybookVersion', (input, output) => {
  it(`${input}`, () => {
    expect(getStorybookVersion(input)).toEqual(output);
  });
});

describe('Upgrade errors', () => {
  it('should throw an error when upgrading to a lower version number', async () => {
    findInstallationsMock.mockResolvedValue({
      dependencies: {
        storybook: [
          {
            version: '9.1.0',
          },
        ],
      },
      duplicatedDependencies: {},
      infoCommand: '',
      dedupeCommand: '',
    });

    await expect(doUpgrade({} as any)).rejects.toThrowError(UpgradeStorybookToLowerVersionError);
    expect(findInstallationsMock).toHaveBeenCalledWith(Object.keys(sbcc.versions));
  });
  it('should show a warning when upgrading to the same version number', async () => {
    findInstallationsMock.mockResolvedValue({
      dependencies: {
        storybook: [
          {
            version: '9.0.0',
          },
        ],
      },
      duplicatedDependencies: {},
      infoCommand: '',
      dedupeCommand: '',
    });
    findInstallationsMock.mockResolvedValue({
      dependencies: {
        storybook: [
          {
            version: '9.0.0',
          },
        ],
      },
      duplicatedDependencies: {},
      infoCommand: '',
      dedupeCommand: '',
    });

    // Mock as a throw, so that we don't have to mock the content of the doUpgrade fn that comes after it
    vi.spyOn(logger, 'warn').mockImplementation((error: any) => {
      throw error;
    });

    await expect(doUpgrade({ packageManager: 'npm' } as any)).rejects.toContain(
      'You are upgrading Storybook to the same version that is currently installed in the project'
    );
    expect(findInstallationsMock).toHaveBeenCalledWith(Object.keys(sbcc.versions));
  });
});

describe('toUpgradedDependencies', () => {
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    mockPackageManager = {
      latestVersion: vi.fn(),
    } as unknown as JsPackageManager;

    vi.mocked(mockPackageManager.latestVersion).mockImplementation(async (packageName: string) => {
      if (packageName === '@storybook/addon-designs@next') {
        return '9.0.0-beta.1';
      }
      if (packageName === '@storybook/addon-designs') {
        return '8.0.0';
      }
      if (packageName === '@chromatic-com/storybook@next') {
        return '4.0.0-0';
      }
      if (packageName === '@chromatic-com/storybook') {
        return '3.0.0';
      }

      return '9.0.0';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('core storybook packages', () => {
    it('should upgrade Storybook core dependencies respecting the version modifier of the dependency to upgrade', async () => {
      const deps = {
        '@storybook/react': '8.0.0',
        '@storybook/vue3': '~8.0.0',
        '@storybook/svelte': '^8.0.0',
        '@storybook/angular': '>=8.0.0',
        // in this case, it uses the first modifier of the first version defined
        '@storybook/html': '>8.0.0 || ^0.0.0-pr.0',
        // invalid cases become fixed version
        '@storybook/web-components': '*',
        '@storybook/react-vite': 'workspace:*',
        react: '18.0.0',
      };

      const result = await toUpgradedDependencies(deps, mockPackageManager);

      expect(result).toEqual([
        '@storybook/react@9.0.0',
        '@storybook/vue3@~9.0.0',
        '@storybook/svelte@^9.0.0',
        '@storybook/angular@>=9.0.0',
        '@storybook/html@>9.0.0',
        '@storybook/web-components@9.0.0',
        '@storybook/react-vite@9.0.0',
      ]);
    });

    it('should not add ^ for outdated CLI versions', async () => {
      const deps = {
        '@storybook/react': '^8.0.0',
      };

      const result = await toUpgradedDependencies(deps, mockPackageManager, {
        isCLIOutdated: true,
      });

      expect(result).toEqual(['@storybook/react@9.0.0']);
    });

    it('should not add ^ for canary versions', async () => {
      const deps = {
        '@storybook/react': '^8.0.0',
      };

      const result = await toUpgradedDependencies(deps, mockPackageManager, {
        isCanary: true,
      });

      expect(result).toEqual(['@storybook/react@9.0.0']);
    });
  });

  describe('satellite packages', () => {
    it('should include satellite dependencies for latest stable version', async () => {
      const deps = {
        '@storybook/react': '8.0.0',
        '@storybook/addon-designs': '8.0.0',
        '@storybook/test-runner': '^8.0.0',
        '@chromatic-com/storybook': '~3.0.0',
      };

      const result = await toUpgradedDependencies(deps, mockPackageManager, {
        isCLIExactLatest: true,
      });

      expect(result).toEqual([
        '@storybook/react@9.0.0',
        '@storybook/addon-designs@8.0.0',
        '@storybook/test-runner@^9.0.0',
        '@chromatic-com/storybook@~3.0.0',
      ]);
      expect(mockPackageManager.latestVersion).toHaveBeenCalledWith('@storybook/addon-designs');
    });

    it('should include satellite dependencies with @next for prerelease version', async () => {
      const deps = {
        '@storybook/react': '^8.0.0',
        '@storybook/addon-designs': '8.0.0',
      };

      const result = await toUpgradedDependencies(deps, mockPackageManager, {
        isCLIExactPrerelease: true,
        isCLIPrerelease: true,
      });

      expect(result).toContainEqual('@storybook/react@^9.0.0');
      expect(result).toContainEqual('@storybook/addon-designs@9.0.0-beta.1');
      expect(mockPackageManager.latestVersion).toHaveBeenCalledWith(
        '@storybook/addon-designs@next'
      );
    });

    it('should handle errors when fetching satellite dependencies', async () => {
      const deps = {
        '@storybook/react': '^8.0.0',
        '@storybook/addon-designs': '8.0.0',
      };

      vi.mocked(mockPackageManager.latestVersion).mockRejectedValueOnce(
        new Error('MOCKED Network error')
      );

      const result = await toUpgradedDependencies(deps, mockPackageManager, {
        isCLIExactLatest: true,
      });

      // Should still have the core dependencies
      expect(result).toContainEqual('@storybook/react@^9.0.0');

      // Satellite dependencies should be omitted due to the error
      expect(result).not.toContainEqual(expect.stringContaining('@storybook/addon-designs'));
    });
  });

  it('should handle empty dependencies', async () => {
    const result = await toUpgradedDependencies({}, mockPackageManager);
    expect(result).toEqual([]);
  });
});
