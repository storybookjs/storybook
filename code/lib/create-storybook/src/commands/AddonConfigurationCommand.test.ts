import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import { AddonConfigurationCommand } from './AddonConfigurationCommand';

vi.mock('storybook/internal/node-logger', { spy: true });

vi.mock('../../../cli-storybook/src/postinstallAddon', () => ({
  postinstallAddon: vi.fn(),
}));

describe('AddonConfigurationCommand', () => {
  let command: AddonConfigurationCommand;
  let mockPackageManager: JsPackageManager;
  let mockTask: any;
  let mockPostinstallAddon: any;

  beforeEach(async () => {
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');
    mockPostinstallAddon = vi.mocked(postinstallAddon);
    mockPostinstallAddon.mockResolvedValue(undefined);

    command = new AddonConfigurationCommand();

    mockPackageManager = {
      type: 'npm',
      getVersionedPackages: vi.fn(),
    } as any;

    mockTask = {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    };

    vi.mocked(prompt.taskLog).mockReturnValue(mockTask);
    vi.mocked(mockPackageManager.getVersionedPackages).mockResolvedValue([
      '@storybook/addon-a11y@8.0.0',
      '@storybook/addon-vitest@8.0.0',
    ]);

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should skip configuration when no addons are provided', async () => {
      const addons: string[] = [];
      const options = {} as any;

      const result = await command.execute({
        packageManager: mockPackageManager,
        addons,
        configDir: '.storybook',
        options,
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).not.toHaveBeenCalled();
      expect(mockPackageManager.getVersionedPackages).not.toHaveBeenCalled();
    });

    it('should configure test addons when test feature is enabled', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];
      const options = { yes: true } as any;

      const result = await command.execute({
        packageManager: mockPackageManager,
        addons,
        configDir: '.storybook',
        options,
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).toHaveBeenCalledWith({
        id: 'configure-addons',
        title: 'Configuring test addons...',
      });
    });

    it('should handle configuration errors gracefully', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];
      const options = {} as any;
      const error = new Error('Configuration failed');

      mockPostinstallAddon.mockRejectedValue(error);

      const result = await command.execute({
        packageManager: mockPackageManager,
        addons,
        configDir: '.storybook',
        options,
      });

      expect(result.status).toBe('failed');
      expect(mockTask.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure test addons')
      );
    });

    it('should complete successfully with valid configuration', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];
      const options = { yes: true } as any;

      // Mock successful execution
      vi.mocked(mockPackageManager.getVersionedPackages).mockResolvedValue([
        '@storybook/addon-a11y@8.0.0',
        '@storybook/addon-vitest@8.0.0',
      ]);

      const result = await command.execute({
        packageManager: mockPackageManager,
        addons,
        configDir: '.storybook',
        options,
      });

      expect(result.status).toBe('success');
      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalled();
    });
  });
});
