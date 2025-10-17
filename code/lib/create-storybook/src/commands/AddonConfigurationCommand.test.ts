import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import { DependencyCollector } from '../dependency-collector';
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
  let dependencyCollector: DependencyCollector;
  let mockGeneratorResult: any;

  beforeEach(async () => {
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');
    mockPostinstallAddon = vi.mocked(postinstallAddon);
    mockPostinstallAddon.mockResolvedValue(undefined);

    dependencyCollector = new DependencyCollector();
    command = new AddonConfigurationCommand(dependencyCollector);

    mockPackageManager = {
      type: 'npm',
      getVersionedPackages: vi.fn(),
    } as any;

    mockTask = {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    };

    mockGeneratorResult = {
      configDir: '.storybook',
    };

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

      const result = await command.execute({
        packageManager: mockPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).not.toHaveBeenCalled();
      expect(mockPackageManager.getVersionedPackages).not.toHaveBeenCalled();
    });

    it('should configure test addons when test feature is enabled', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = { yes: true } as any;

      const result = await command.execute({
        packageManager: mockPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).toHaveBeenCalledWith({
        id: 'configure-addons',
        title: 'Configuring test addons...',
      });
    });

    it('should get versioned addon packages', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;

      await command.execute({
        packageManager: mockPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalledWith([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
    });

    it('should handle configuration errors gracefully', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;
      const error = new Error('Configuration failed');

      mockPostinstallAddon.mockRejectedValue(error);

      const result = await command.execute({
        packageManager: mockPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(result.status).toBe('failed');
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

      const result = await command.execute({
        packageManager: mockPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(result.status).toBe('success');
      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalled();
    });

    it('should work with different package managers', async () => {
      const yarnPackageManager = {
        type: 'yarn',
        getVersionedPackages: vi
          .fn()
          .mockResolvedValue(['@storybook/addon-a11y@8.0.0', '@storybook/addon-vitest@8.0.0']),
      } as any;

      const selectedFeatures = new Set(['test'] as const);
      const options = { yes: false } as any;

      const result = await command.execute({
        packageManager: yarnPackageManager,
        selectedFeatures,
        generatorResult: mockGeneratorResult,
        options,
      });

      expect(result.status).toBe('success');
      expect(yarnPackageManager.getVersionedPackages).toHaveBeenCalled();
    });
  });
});
