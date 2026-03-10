import { beforeEach, describe, expect, test, vi } from 'vitest';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { blocker } from './block-experimental-addon-test';

vi.mock('semver');

vi.mock('picocolors', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    default: {
      bold: (s: string) => s,
      magenta: (s: string) => s,
    },
  };
});

describe('experimentalAddonTestVitest blocker', () => {
  const mockPackageManager = {
    getInstalledVersion: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(semver.lt).mockReturnValue(false);
    mockPackageManager.getInstalledVersion.mockResolvedValue('3.0.0');
  });

  test('should return false if experimental addon is not installed', async () => {
    mockPackageManager.getInstalledVersion.mockImplementation(async (pkg: string) => {
      if (pkg === '@storybook/experimental-addon-test') {
        return null;
      }
      return '3.0.0';
    });

    const result = await blocker.check({
      packageJson: {
        dependencies: {},
        devDependencies: {},
      },
      packageManager: mockPackageManager as any,
    } as any);

    expect(result).toBe(false);
  });

  test('should return false if vitest is not installed', async () => {
    mockPackageManager.getInstalledVersion.mockImplementation(async (pkg: string) => {
      if (pkg === '@storybook/experimental-addon-test') {
        return '1.0.0';
      }
      if (pkg === 'vitest') {
        return null;
      }
      return '3.0.0';
    });

    const result = await blocker.check({
      packageJson: {
        dependencies: {
          '@storybook/experimental-addon-test': '^1.0.0',
        },
        devDependencies: {},
      },
      packageManager: mockPackageManager as any,
    } as any);

    expect(result).toBe(false);
    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('vitest');
  });

  test('should return true if vitest version is less than 3.0.0', async () => {
    mockPackageManager.getInstalledVersion.mockImplementation(async (pkg: string) => {
      if (pkg === '@storybook/experimental-addon-test') {
        return '1.0.0';
      }
      if (pkg === 'vitest') {
        return '2.9.0';
      }
      return '3.0.0';
    });
    vi.mocked(semver.lt).mockReturnValue(true);

    const result = await blocker.check({
      packageJson: {
        dependencies: {
          '@storybook/experimental-addon-test': '^1.0.0',
        },
        devDependencies: {},
      },
      packageManager: mockPackageManager as any,
    } as any);

    expect(result).toBe(true);
    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('vitest');
    expect(semver.lt).toHaveBeenCalledWith('2.9.0', '3.0.0');
  });

  test('should return false if vitest version is 3.0.0 or greater', async () => {
    mockPackageManager.getInstalledVersion.mockImplementation(async (pkg: string) => {
      if (pkg === '@storybook/experimental-addon-test') {
        return '1.0.0';
      }
      if (pkg === 'vitest') {
        return '3.0.0';
      }
      return '3.0.0';
    });
    vi.mocked(semver.lt).mockReturnValue(false);

    const result = await blocker.check({
      packageJson: {
        dependencies: {
          '@storybook/experimental-addon-test': '^1.0.0',
        },
        devDependencies: {},
      },
      packageManager: mockPackageManager as any,
    } as any);

    expect(result).toBe(false);
    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('vitest');
    expect(semver.lt).toHaveBeenCalledWith('3.0.0', '3.0.0');
  });

  test('should check both dependencies and devDependencies for experimental addon', async () => {
    mockPackageManager.getInstalledVersion.mockImplementation(async (pkg: string) => {
      if (pkg === '@storybook/experimental-addon-test') {
        return '1.0.0';
      }
      if (pkg === 'vitest') {
        return '3.0.0';
      }
      return '3.0.0';
    });

    await blocker.check({
      packageJson: {
        dependencies: {},
        devDependencies: {
          '@storybook/experimental-addon-test': '^1.0.0',
        },
      },
      packageManager: mockPackageManager as any,
    } as any);

    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('vitest');
  });

  test('log should return correct message', () => {
    const result = blocker.log(true);
    expect(result.message).toMatchInlineSnapshot(dedent`
      "@storybook/experimental-addon-test is being stabilized in Storybook 9.

      The addon will be renamed to @storybook/addon-vitest and as part of this stabilization, we have dropped support for Vitest 2.

      You have two options to proceed:
      1. Remove @storybook/experimental-addon-test if you don't need it
      2. Upgrade to Vitest 3 to continue using the addon"
    `);
  });
});
