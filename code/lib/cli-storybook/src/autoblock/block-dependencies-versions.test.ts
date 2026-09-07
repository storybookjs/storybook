import type { JsPackageManager } from 'storybook/internal/common';
import { getVitePlusVersions } from 'storybook/internal/common';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { lt } from 'semver';

import { blocker } from './block-dependencies-versions.ts';

vi.mock('semver');

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getVitePlusVersions: vi.fn(),
  };
});

const getInstalledVersion = vi.fn<JsPackageManager['getInstalledVersion']>();
const getModulePackageJSON = vi.fn<JsPackageManager['getModulePackageJSON']>();

const packageManager: Pick<JsPackageManager, 'getInstalledVersion' | 'getModulePackageJSON'> = {
  getInstalledVersion,
  getModulePackageJSON,
};

const runCheck = () =>
  blocker.check({
    packageManager: packageManager as JsPackageManager,
    mainConfig: { stories: [] },
    mainConfigPath: '.storybook/main.ts',
    configDir: '.storybook',
  });

describe('dependenciesVersions blocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lt).mockReturnValue(false);
    vi.mocked(getVitePlusVersions).mockResolvedValue(null);
    getInstalledVersion.mockResolvedValue(null);
    getModulePackageJSON.mockResolvedValue(null);
  });

  test('has a stable id', () => {
    expect(blocker.id).toBe('dependenciesVersions');
  });

  test('blocks when a shared dependency is below its floor without checking the addon', async () => {
    vi.mocked(lt).mockReturnValue(true);
    getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'next' ? { version: '14.0.0' } : null
    );

    const result = await runCheck();

    expect(result).toEqual({
      installedVersion: '14.0.0',
      packageName: 'next',
      minimumVersion: '14.1.0',
    });
    expect(getInstalledVersion).not.toHaveBeenCalled();
  });

  test('does not block when nothing is installed and the addon is absent', async () => {
    const result = await runCheck();

    expect(result).toBe(false);
  });

  test('blocks on Vitest 3 when @storybook/addon-vitest is installed', async () => {
    vi.mocked(lt).mockReturnValue(true);
    getInstalledVersion.mockResolvedValue('11.0.0');
    getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '3.2.4' } : null
    );

    const result = await runCheck();

    expect(result).toEqual({
      installedVersion: '3.2.4',
      packageName: 'vitest',
      minimumVersion: '4.0.0',
    });
    expect(lt).toHaveBeenCalledWith('3.2.4', '4.0.0');
  });

  test('does not block on Vitest 3 without the addon', async () => {
    vi.mocked(lt).mockReturnValue(true);
    getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '3.2.4' } : null
    );

    const result = await runCheck();

    expect(result).toBe(false);
    expect(getInstalledVersion).toHaveBeenCalledWith('@storybook/addon-vitest');
    expect(getModulePackageJSON).not.toHaveBeenCalledWith('vitest');
  });

  test('passes at the Vitest 4.0.0 boundary with the addon installed', async () => {
    getInstalledVersion.mockResolvedValue('11.0.0');
    getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '4.0.0' } : null
    );

    const result = await runCheck();

    expect(result).toBe(false);
    expect(lt).toHaveBeenCalledWith('4.0.0', '4.0.0');
  });

  test('does not block when vitest is not installed while the addon is present', async () => {
    getInstalledVersion.mockResolvedValue('11.0.0');

    const result = await runCheck();

    expect(result).toBe(false);
    expect(getModulePackageJSON).toHaveBeenCalledWith('vitest');
    expect(lt).not.toHaveBeenCalled();
  });

  test('uses the vite-plus vendored Vitest version when available', async () => {
    vi.mocked(lt).mockImplementation((_installed, minimum) => minimum === '4.0.0');
    vi.mocked(getVitePlusVersions).mockResolvedValue({ vite: '7.1.2', vitest: '3.2.4' });
    getInstalledVersion.mockResolvedValue('11.0.0');

    const result = await runCheck();

    expect(result).toEqual({
      installedVersion: '3.2.4',
      packageName: 'vitest',
      minimumVersion: '4.0.0',
    });
    expect(getModulePackageJSON).not.toHaveBeenCalledWith('vitest');
  });

  test('does not block when the addon lookup throws', async () => {
    getInstalledVersion.mockRejectedValue(new Error('version detection failed'));

    const result = await runCheck();

    expect(result).toBe(false);
  });

  test('logs the Vitest 4 requirement for addon-vitest projects', () => {
    const { title, message, link } = blocker.log({
      installedVersion: '3.2.4',
      packageName: 'vitest',
      minimumVersion: '4.0.0',
    });

    expect(title).toBe('Vitest 4 required by @storybook/addon-vitest');
    expect(message).toMatchInlineSnapshot(`
      "The addon requires Vitest 4.0.0 or higher. You are currently using Vitest 3.2.4.

      Please upgrade Vitest to 4.0.0 or higher before upgrading Storybook:
      1. Update vitest (and any @vitest/* packages) in your project to version 4
      2. Run your test suite to verify the migration"
    `);
    expect(link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-requires-vitest-40-or-higher'
    );
  });

  test('logs shared dependencies through the default case', () => {
    const { title } = blocker.log({
      installedVersion: '4.0.0',
      packageName: 'react-scripts',
      minimumVersion: '5.0.0',
    });

    expect(title).toBe('react-scripts version < 5.0.0 support removed');
  });
});
