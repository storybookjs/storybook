import type { JsPackageManager } from 'storybook/internal/common';
import { getVitePlusVersions } from 'storybook/internal/common';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { lt } from 'semver';

import { blocker } from './block-addon-vitest-vitest4.ts';
import type { AutoblockOptions } from './types.ts';

vi.mock('semver');

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getVitePlusVersions: vi.fn(),
  };
});

const packageManager = {
  getInstalledVersion: vi.fn<JsPackageManager['getInstalledVersion']>(),
  getModulePackageJSON: vi.fn<JsPackageManager['getModulePackageJSON']>(),
};

const runCheck = () => blocker.check({ packageManager } as AutoblockOptions);

describe('addonVitestVitest4 blocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lt).mockReturnValue(false);
    vi.mocked(getVitePlusVersions).mockResolvedValue(null);
    packageManager.getInstalledVersion.mockResolvedValue(null);
    packageManager.getModulePackageJSON.mockResolvedValue(null);
  });

  test('has a stable id', () => {
    expect(blocker.id).toBe('addonVitestVitest4');
  });

  test('returns false when @storybook/addon-vitest is not installed', async () => {
    vi.mocked(lt).mockReturnValue(true);
    packageManager.getInstalledVersion.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? '3.2.4' : null
    );

    const result = await runCheck();

    expect(result).toBe(false);
    expect(packageManager.getInstalledVersion).toHaveBeenCalledWith('@storybook/addon-vitest');
  });

  test('blocks when the effective Vitest version is below 4.0.0', async () => {
    vi.mocked(lt).mockReturnValue(true);
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');
    packageManager.getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '3.2.4' } : null
    );

    const result = await runCheck();

    expect(result).toEqual({ vitestVersion: '3.2.4' });
    expect(lt).toHaveBeenCalledWith('3.2.4', '4.0.0');
  });

  test('blocks at the Vitest 3.0.0 boundary', async () => {
    vi.mocked(lt).mockReturnValue(true);
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');
    packageManager.getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '3.0.0' } : null
    );

    const result = await runCheck();

    expect(result).toEqual({ vitestVersion: '3.0.0' });
  });

  test('returns false at the Vitest 4.0.0 boundary', async () => {
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');
    packageManager.getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '4.0.0' } : null
    );

    const result = await runCheck();

    expect(result).toBe(false);
    expect(lt).toHaveBeenCalledWith('4.0.0', '4.0.0');
  });

  test('returns false for Vitest 5', async () => {
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');
    packageManager.getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '5.0.0' } : null
    );

    const result = await runCheck();

    expect(result).toBe(false);
  });

  test('returns false when vitest is not installed (unmet peer dependency)', async () => {
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');

    const result = await runCheck();

    expect(result).toBe(false);
    expect(packageManager.getModulePackageJSON).toHaveBeenCalledWith('vitest');
    expect(lt).not.toHaveBeenCalled();
  });

  test('uses the vite-plus vendored version when available', async () => {
    vi.mocked(lt).mockReturnValue(true);
    vi.mocked(getVitePlusVersions).mockResolvedValue({ vite: '7.1.2', vitest: '3.2.4' });
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');

    const result = await runCheck();

    expect(result).toEqual({ vitestVersion: '3.2.4' });
    expect(packageManager.getModulePackageJSON).not.toHaveBeenCalled();
  });

  test('falls back to the installed package when vite-plus lacks a /versions export', async () => {
    vi.mocked(lt).mockReturnValue(true);
    packageManager.getInstalledVersion.mockResolvedValue('11.0.0');
    packageManager.getModulePackageJSON.mockImplementation(async (packageName) =>
      packageName === 'vitest' ? { version: '3.2.4' } : null
    );

    const result = await runCheck();

    expect(result).toEqual({ vitestVersion: '3.2.4' });
  });

  test('does not block when version detection throws', async () => {
    packageManager.getInstalledVersion.mockRejectedValue(new Error('version detection failed'));

    const result = await runCheck();

    expect(result).toBe(false);
  });

  test('renders the title, message, and migration link', () => {
    const { title, message, link } = blocker.log({ vitestVersion: '3.2.4' });

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
});
