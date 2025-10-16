import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import { AddonConfigurationCommand } from './AddonConfigurationCommand';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('AddonConfigurationCommand', () => {
  let command: AddonConfigurationCommand;
  let mockPackageManager: JsPackageManager;
  let mockTask: any;
  let mockPostinstallAddon: any;

  beforeEach(() => {
    command = new AddonConfigurationCommand();
    mockPackageManager = {
      type: 'npm',
      getVersionedPackages: vi.fn(),
    } as any;

    mockTask = {
      success: vi.fn(),
      error: vi.fn(),
    };

    mockPostinstallAddon = vi.fn().mockResolvedValue(undefined);

    vi.mocked(prompt.taskLog).mockReturnValue(mockTask);
    vi.mocked(mockPackageManager.getVersionedPackages).mockResolvedValue([
      '@storybook/addon-a11y@8.0.0',
      '@storybook/addon-vitest@8.0.0',
    ]);

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should skip configuration when test feature is not enabled', async () => {
      const selectedFeatures = new Set(['docs'] as const);
      const options = {} as any;

      await command.execute(mockPackageManager, selectedFeatures, options);

      expect(prompt.taskLog).not.toHaveBeenCalled();
      expect(mockPackageManager.getVersionedPackages).not.toHaveBeenCalled();
    });

    it('should configure test addons when test feature is enabled', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = { yes: true } as any;

      // Mock the dynamic import
      vi.doMock('../../cli-storybook/src/postinstallAddon', () => ({
        postinstallAddon: mockPostinstallAddon,
      }));

      await command.execute(mockPackageManager, selectedFeatures, options);

      expect(prompt.taskLog).toHaveBeenCalledWith({
        id: 'configure-addons',
        title: 'Configuring test addons...',
      });
    });

    it('should get versioned addon packages', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;

      vi.doMock('../../cli-storybook/src/postinstallAddon', () => ({
        postinstallAddon: mockPostinstallAddon,
      }));

      await command.execute(mockPackageManager, selectedFeatures, options);

      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalledWith([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
    });

    it('should handle configuration errors gracefully', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;
      const error = new Error('Configuration failed');

      vi.doMock('../../cli-storybook/src/postinstallAddon', () => ({
        postinstallAddon: vi.fn().mockRejectedValue(error),
      }));

      // Should not throw
      await expect(
        command.execute(mockPackageManager, selectedFeatures, options)
      ).resolves.not.toThrow();

      expect(mockTask.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure test addons')
      );
    });

    it('should complete successfully with valid configuration', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = { yes: true } as any;

      // Mock successful execution
      vi.mocked(mockPackageManager.getVersionedPackages).mockResolvedValue([
        '@storybook/addon-a11y@8.0.0',
        '@storybook/addon-vitest@8.0.0',
      ]);

      await command.execute(mockPackageManager, selectedFeatures, options);

      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalled();
    });

    it('should work with different package managers', async () => {
      mockPackageManager.type = 'yarn';
      const selectedFeatures = new Set(['test'] as const);
      const options = { yes: false } as any;

      await command.execute(mockPackageManager, selectedFeatures, options);

      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalled();
    });
  });
});
