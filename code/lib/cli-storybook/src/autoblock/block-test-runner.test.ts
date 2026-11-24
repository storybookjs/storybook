import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { blocker } from './block-test-runner.ts';
import type { AutoblockOptions } from './types.ts';

describe('testRunner blocker', () => {
  const mockPackageManager = {
    isDependencyInstalled: vi.fn(),
    getInstalledVersion: vi.fn(),
  };

  const createOptions = (): AutoblockOptions => ({
    packageManager: mockPackageManager as unknown as JsPackageManager,
    mainConfig: { stories: [] },
    mainConfigPath: '',
    configDir: '',
    storiesPaths: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPackageManager.isDependencyInstalled.mockReturnValue(false);
    mockPackageManager.getInstalledVersion.mockResolvedValue(null);
  });

  describe('when package.json lists @storybook/test-runner', () => {
    beforeEach(() => {
      mockPackageManager.isDependencyInstalled.mockReturnValue(true);
    });

    test('should return true, even if no installation is found', async () => {
      const result = await blocker.check(createOptions());

      expect(result).toBe(true);
      expect(mockPackageManager.isDependencyInstalled).toHaveBeenCalledWith(
        '@storybook/test-runner'
      );
    });
  });

  describe('when @storybook/test-runner is installed without being listed', () => {
    beforeEach(() => {
      mockPackageManager.getInstalledVersion.mockResolvedValue('0.24.0');
    });

    test('should return true', async () => {
      const result = await blocker.check(createOptions());

      expect(result).toBe(true);
      expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('@storybook/test-runner');
    });
  });

  test('should return false when the test runner is neither listed nor installed', async () => {
    const result = await blocker.check(createOptions());

    expect(result).toBe(false);
  });

  test('should log both ways forward with the MIGRATION.md anchor', () => {
    const log = blocker.log(true);

    expect(log.title).toBe('Test runner: support removed');
    expect(log.message).toContain('Replace it with the Vitest addon');
    expect(log.message).toContain('Keep using Storybook 10');
    expect(log.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#test-runner-support-removed'
    );
  });
});
