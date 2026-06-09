import type { JsPackageManager } from 'storybook/internal/common';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findOutdatedPackage } from './utils.ts';

describe('findOutdatedPackage', () => {
  const packageManager = {
    getModulePackageJSON: vi.fn(),
    getDependencyVersion: vi.fn(),
  } as unknown as JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns outdated package when installed version is below minimum', async () => {
    vi.mocked(packageManager.getModulePackageJSON).mockResolvedValue({ version: '4.9.9' } as any);
    vi.mocked(packageManager.getDependencyVersion).mockReturnValue('^4.9.9');

    const result = await findOutdatedPackage(
      {
        vite: '5.0.0',
      },
      { packageManager }
    );

    expect(result).toEqual({
      packageName: 'vite',
      installedVersion: '4.9.9',
      minimumVersion: '5.0.0',
    });
  });

  it('uses npm alias target version when alias package version is lower', async () => {
    vi.mocked(packageManager.getModulePackageJSON).mockResolvedValue({ version: '0.1.12' } as any);
    vi.mocked(packageManager.getDependencyVersion).mockReturnValue('npm:vite5@^5.4.16');

    const result = await findOutdatedPackage(
      {
        vite: '5.0.0',
      },
      { packageManager }
    );

    expect(result).toBe(false);
  });

  it('uses alias target version when package is not installed', async () => {
    vi.mocked(packageManager.getModulePackageJSON).mockResolvedValue(null);
    vi.mocked(packageManager.getDependencyVersion).mockReturnValue('npm:vite5@^5.4.16');

    const result = await findOutdatedPackage(
      {
        vite: '5.0.0',
      },
      { packageManager }
    );

    expect(result).toBe(false);
  });

  it('does not report outdated when installed version equals minimum', async () => {
    vi.mocked(packageManager.getModulePackageJSON).mockResolvedValue({ version: '5.0.0' } as any);
    vi.mocked(packageManager.getDependencyVersion).mockReturnValue('^5.0.0');

    const result = await findOutdatedPackage(
      {
        vite: '5.0.0',
      },
      { packageManager }
    );

    expect(result).toBe(false);
  });

  it('still reports outdated package when npm alias target version is below minimum', async () => {
    vi.mocked(packageManager.getModulePackageJSON).mockResolvedValue({ version: '0.1.12' } as any);
    vi.mocked(packageManager.getDependencyVersion).mockReturnValue('npm:vite5@^4.9.9');

    const result = await findOutdatedPackage(
      {
        vite: '5.0.0',
      },
      { packageManager }
    );

    expect(result).toEqual({
      packageName: 'vite',
      installedVersion: '4.9.9',
      minimumVersion: '5.0.0',
    });
  });
});
