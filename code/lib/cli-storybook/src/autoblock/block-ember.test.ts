import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { blocker } from './block-ember.ts';
import type { AutoblockOptions } from './types.ts';

describe('ember blocker', () => {
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

  describe('when package.json lists @storybook/ember', () => {
    beforeEach(() => {
      mockPackageManager.isDependencyInstalled.mockReturnValue(true);
    });

    test('should return true, even if no installation is found', async () => {
      const result = await blocker.check(createOptions());

      expect(result).toBe(true);
      expect(mockPackageManager.isDependencyInstalled).toHaveBeenCalledWith('@storybook/ember');
    });
  });

  describe('when @storybook/ember is installed without being listed', () => {
    beforeEach(() => {
      mockPackageManager.getInstalledVersion.mockResolvedValue('7.6.0');
    });

    test('should return true', async () => {
      const result = await blocker.check(createOptions());

      expect(result).toBe(true);
      expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('@storybook/ember');
    });
  });

  describe('when @storybook/ember is neither listed nor installed', () => {
    test('should return false', async () => {
      const result = await blocker.check(createOptions());

      expect(result).toBe(false);
    });
  });

  test('should log the migration guidance with the ember-storybook compatibility link', () => {
    const log = blocker.log(true);

    expect(log.title).toBe('Ember: support removed in Storybook 11');
    expect(log.message).toContain('ember-storybook');
    expect(log.link).toBe('https://github.com/ember-integrations/ember-storybook/issues/123');
  });
});
