import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { TelemetryService } from '../services/TelemetryService';
import { VersionService } from '../services/VersionService';
import { AddonConfigurationCommand } from './AddonConfigurationCommand';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../../../cli-storybook/src/postinstallAddon', { spy: true });
vi.mock('../services/TelemetryService', { spy: true });
vi.mock('../services/VersionService', { spy: true });

describe('AddonConfigurationCommand', () => {
  let command: AddonConfigurationCommand;
  const mockPackageManager = {
    type: 'npm',
    getVersionedPackages: vi.fn(),
    executeCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
  } as Partial<JsPackageManager> as JsPackageManager;
  let mockTask: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
    group: ReturnType<typeof vi.fn>;
  };
  let mockPostinstallAddon: ReturnType<typeof vi.fn>;
  let mockAddonVitestService: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');
    mockPostinstallAddon = vi.mocked(postinstallAddon);
    mockPostinstallAddon.mockResolvedValue(undefined);

    // Mock the AddonVitestService
    const { AddonVitestService } = await import('storybook/internal/cli');
    mockAddonVitestService = vi.mocked(AddonVitestService);
    const mockInstance = {
      installPlaywright: vi.fn().mockResolvedValue({ errors: [] }),
    };
    mockAddonVitestService.mockImplementation(() => mockInstance as any);

    vi.mocked(VersionService).mockImplementation(() => ({}));

    vi.mocked(TelemetryService).mockImplementation((disableTelemetry: boolean = false) => {
      return {
        disableTelemetry,
        versionService: new VersionService(),
      };
    });

    const mockAddonVitestServiceInstance = {
      installPlaywright: vi.fn().mockResolvedValue({ errors: [] }),
    };
    const mockTelemetryServiceInstance = {
      trackPlaywrightPromptDecision: vi.fn(),
    };

    command = new AddonConfigurationCommand(
      mockPackageManager,
      {
        yes: true,
        disableTelemetry: true,
      } as any,
      mockAddonVitestServiceInstance as any,
      mockTelemetryServiceInstance as any
    );

    mockTask = {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
      group: vi.fn(),
    };

    vi.mocked(prompt.taskLog).mockReturnValue(mockTask as any);
    vi.mocked(logger.log).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should skip configuration when no addons are provided', async () => {
      const addons: string[] = [];

      const result = await command.execute({
        dependencyInstallationResult: { status: 'success' },
        addons,
        configDir: '.storybook',
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).not.toHaveBeenCalled();
      expect(mockPackageManager.getVersionedPackages).not.toHaveBeenCalled();
    });

    it('should configure test addons when test feature is enabled', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];

      const result = await command.execute({
        dependencyInstallationResult: { status: 'success' },
        addons,
        configDir: '.storybook',
      });

      expect(result.status).toBe('success');
      expect(prompt.taskLog).toHaveBeenCalledWith({
        id: 'configure-addons',
        title: 'Configuring addons...',
      });
    });

    it('should handle configuration errors gracefully', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];
      const error = new Error('Configuration failed');

      mockPostinstallAddon.mockRejectedValue(error);

      const result = await command.execute({
        dependencyInstallationResult: { status: 'success' },
        addons,
        configDir: '.storybook',
      });

      expect(result.status).toBe('failed');
      expect(mockTask.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure addons')
      );
    });

    it('should complete successfully with valid configuration', async () => {
      const addons = ['@storybook/addon-a11y', '@storybook/addon-vitest'];

      const result = await command.execute({
        dependencyInstallationResult: { status: 'success' },
        addons,
        configDir: '.storybook',
      });

      expect(result.status).toBe('success');
      expect(mockPostinstallAddon).toHaveBeenCalledTimes(2);
      expect(mockPostinstallAddon).toHaveBeenCalledWith('@storybook/addon-a11y', {
        packageManager: 'npm',
        configDir: '.storybook',
        yes: true,
        skipInstall: true,
        skipDependencyManagement: true,
        logger: expect.any(Object),
        prompt: expect.any(Object),
      });
      expect(mockPostinstallAddon).toHaveBeenCalledWith('@storybook/addon-vitest', {
        packageManager: 'npm',
        configDir: '.storybook',
        yes: true,
        skipInstall: true,
        skipDependencyManagement: true,
        logger: expect.any(Object),
        prompt: expect.any(Object),
      });
    });
  });
});
