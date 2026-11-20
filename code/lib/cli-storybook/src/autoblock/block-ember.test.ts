import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { blocker } from './block-ember.ts';
import type { AutoblockOptions } from './types.ts';

describe('ember blocker', () => {
  const mockPackageManager = {
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
  });

  test('should return true when @storybook/ember is installed', async () => {
    mockPackageManager.getInstalledVersion.mockResolvedValue('7.6.0');

    const result = await blocker.check(createOptions());

    expect(result).toBe(true);
    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('@storybook/ember');
  });

  test('should return false when @storybook/ember is not installed', async () => {
    mockPackageManager.getInstalledVersion.mockResolvedValue(null);

    const result = await blocker.check(createOptions());

    expect(result).toBe(false);
  });

  test('should log the migration guidance with the ember-storybook compatibility link', () => {
    const log = blocker.log(true);

    expect(log.title).toBe('Ember: support removed in Storybook 11');
    expect(log.message).toContain('ember-storybook');
    expect(log.link).toBe('https://github.com/ember-integrations/ember-storybook/issues/123');
  });
});
