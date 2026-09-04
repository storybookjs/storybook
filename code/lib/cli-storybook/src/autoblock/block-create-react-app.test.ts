import { beforeEach, describe, expect, test, vi } from 'vitest';

import { blocker } from './block-create-react-app.ts';
import type { AutoblockOptions } from './types.ts';

describe('createReactApp blocker', () => {
  const mockPackageManager = {
    getInstalledVersion: vi.fn(),
  };

  const createOptions = (): AutoblockOptions =>
    ({
      packageManager: mockPackageManager,
      mainConfig: {},
      mainConfigPath: '',
      configDir: '',
    }) as AutoblockOptions;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return true when @storybook/preset-create-react-app is installed', async () => {
    mockPackageManager.getInstalledVersion.mockResolvedValue('9.0.0');

    const result = await blocker.check(createOptions());

    expect(result).toBe(true);
    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith(
      '@storybook/preset-create-react-app'
    );
  });

  test('should return false when the preset is not installed', async () => {
    mockPackageManager.getInstalledVersion.mockResolvedValue(null);

    const result = await blocker.check(createOptions());

    expect(result).toBe(false);
  });

  test('should log the migration guidance with the MIGRATION.md anchor', () => {
    const log = blocker.log(true);

    expect(log.title).toBe('Create React App: support removed');
    expect(log.message).toContain('Migrate your project to Vite');
    expect(log.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-support-removed'
    );
  });
});
