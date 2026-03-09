import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddonVitestService } from 'storybook/internal/cli';
import { type JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import addonA11yPostinstall from '../../../../addons/a11y/src/postinstall';
import addonVitestPostinstall from '../../../../addons/vitest/src/postinstall';
import type { TelemetryService } from '../services';
import { AddonConfigurationCommand, executeAddonConfiguration } from './AddonConfigurationCommand';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../../../../addons/a11y/src/postinstall', { spy: true });
vi.mock('../../../../addons/vitest/src/postinstall', { spy: true });
vi.mock('../../../cli-storybook/src/postinstallAddon', () => ({
  postinstallAddon: vi.fn().mockResolvedValue(undefined),
}));

describe('AddonConfigurationCommand', () => {
  let command: AddonConfigurationCommand;
  let mockPackageManager: JsPackageManager;
  let mockAddonVitestService: AddonVitestService;
  let mockTelemetryService: TelemetryService;
  let mockTaskLog: ReturnType<typeof prompt.taskLog>;

  beforeEach(() => {
    mockPackageManager = {
      type: 'npm',
    } as Partial<JsPackageManager> as JsPackageManager;

    mockAddonVitestService = {
      installPlaywright: vi.fn().mockResolvedValue({ errors: [], result: 'installed' }),
    } as Partial<AddonVitestService> as AddonVitestService;

    mockTelemetryService = {
      trackPlaywrightPromptDecision: vi.fn().mockResolvedValue(undefined),
    } as Partial<TelemetryService> as TelemetryService;

    mockTaskLog = {
      message: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof prompt.taskLog>;

    vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(ErrorCollector.addError).mockImplementation(() => {});
    vi.mocked(addonA11yPostinstall).mockResolvedValue(undefined);
    vi.mocked(addonVitestPostinstall).mockResolvedValue(undefined);

    command = new AddonConfigurationCommand(
      mockPackageManager,
      { packageManager: PackageManagerName.NPM, yes: false, disableTelemetry: false },
      mockAddonVitestService,
      mockTelemetryService
    );

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return success when no configDir is provided', async () => {
      const result = await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: undefined,
      });

      expect(result).toEqual({ status: 'success' });
      expect(prompt.taskLog).not.toHaveBeenCalled();
    });

    it('should return success when addons array is empty', async () => {
      const result = await command.execute({
        addons: [],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'success' });
      expect(prompt.taskLog).not.toHaveBeenCalled();
    });

    it('should configure vitest addon successfully', async () => {
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'success' });
      expect(addonVitestPostinstall).toHaveBeenCalledWith({
        packageManager: 'npm',
        configDir: '.storybook',
        yes: false,
        skipInstall: true,
        skipDependencyManagement: true,
        logger,
        prompt,
      });
      expect(mockAddonVitestService.installPlaywright).toHaveBeenCalledWith({
        yes: false,
        useRemotePkg: false,
      });
      expect(mockTelemetryService.trackPlaywrightPromptDecision).toHaveBeenCalledWith('installed');
      expect(mockTaskLog.success).toHaveBeenCalledWith('Addons configured successfully');
    });

    it('should configure a11y addon successfully', async () => {
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-a11y'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'success' });
      expect(addonA11yPostinstall).toHaveBeenCalledWith({
        packageManager: 'npm',
        configDir: '.storybook',
        yes: false,
        skipInstall: true,
        skipDependencyManagement: true,
        logger,
        prompt,
      });
      expect(mockTaskLog.success).toHaveBeenCalledWith('Addons configured successfully');
    });

    it('should configure generic addon via postinstallAddon', async () => {
      const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-docs'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'success' });
      expect(postinstallAddon).toHaveBeenCalledWith('@storybook/addon-docs', {
        packageManager: 'npm',
        configDir: '.storybook',
        yes: false,
        skipInstall: true,
        skipDependencyManagement: true,
        logger,
        prompt,
      });
      expect(mockTaskLog.success).toHaveBeenCalledWith('Addons configured successfully');
    });

    it('should configure multiple addons', async () => {
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'success' });
      expect(addonVitestPostinstall).toHaveBeenCalled();
      expect(addonA11yPostinstall).toHaveBeenCalled();
      expect(mockTaskLog.message).toHaveBeenCalledWith('Configuring @storybook/addon-vitest...');
      expect(mockTaskLog.message).toHaveBeenCalledWith('Configuring @storybook/addon-a11y...');
    });

    it('should handle addon configuration failure gracefully', async () => {
      const error = new Error('Configuration failed');
      vi.mocked(addonVitestPostinstall).mockRejectedValue(error);
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'failed' });
      expect(logger.debug).toHaveBeenCalledWith(error);
      expect(ErrorCollector.addError).toHaveBeenCalledWith(error);
      expect(mockTaskLog.error).toHaveBeenCalledWith('Failed to configure addons');
    });

    it('should handle partial addon failures', async () => {
      const error = new Error('Vitest configuration failed');
      vi.mocked(addonVitestPostinstall).mockRejectedValue(error);
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      const result = await command.execute({
        addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'failed' });
      expect(addonA11yPostinstall).toHaveBeenCalled();
      expect(mockTaskLog.error).toHaveBeenCalledWith('Failed to configure addons');
    });

    it('should handle unexpected errors during execution', async () => {
      const unexpectedError = new Error('Unexpected error');
      vi.mocked(prompt.taskLog).mockImplementation(() => {
        throw unexpectedError;
      });

      const result = await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(result).toEqual({ status: 'failed' });
      expect(logger.error).toHaveBeenCalledWith('Unexpected error during addon configuration:');
      expect(logger.error).toHaveBeenCalledWith(unexpectedError);
    });

    it('should not install Playwright when vitest addon is not configured', async () => {
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      await command.execute({
        addons: ['@storybook/addon-a11y'],
        configDir: '.storybook',
      });

      expect(mockAddonVitestService.installPlaywright).not.toHaveBeenCalled();
      expect(mockTelemetryService.trackPlaywrightPromptDecision).not.toHaveBeenCalled();
    });

    it('should track skipped Playwright installation', async () => {
      vi.mocked(mockAddonVitestService.installPlaywright).mockResolvedValue({
        errors: [],
        result: 'skipped',
      });
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(mockTelemetryService.trackPlaywrightPromptDecision).toHaveBeenCalledWith('skipped');
    });

    it('should track aborted Playwright installation', async () => {
      vi.mocked(mockAddonVitestService.installPlaywright).mockResolvedValue({
        errors: [],
        result: 'aborted',
      });
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(mockTelemetryService.trackPlaywrightPromptDecision).toHaveBeenCalledWith('aborted');
    });

    it('should track failed Playwright installation', async () => {
      vi.mocked(mockAddonVitestService.installPlaywright).mockResolvedValue({
        errors: ['Installation error'],
        result: 'failed',
      });
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      await command.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(mockTelemetryService.trackPlaywrightPromptDecision).toHaveBeenCalledWith('failed');
    });

    it('should pass yes option to addon postinstall functions', async () => {
      const commandWithYes = new AddonConfigurationCommand(
        mockPackageManager,
        { packageManager: PackageManagerName.NPM, yes: true, disableTelemetry: false },
        mockAddonVitestService,
        mockTelemetryService
      );
      vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);

      await commandWithYes.execute({
        addons: ['@storybook/addon-vitest'],
        configDir: '.storybook',
      });

      expect(addonVitestPostinstall).toHaveBeenCalledWith(expect.objectContaining({ yes: true }));
      expect(mockAddonVitestService.installPlaywright).toHaveBeenCalledWith({
        yes: true,
        useRemotePkg: false,
      });
    });
  });
});

describe('executeAddonConfiguration', () => {
  let mockPackageManager: JsPackageManager;
  let mockTaskLog: ReturnType<typeof prompt.taskLog>;

  beforeEach(() => {
    mockPackageManager = {
      type: 'npm',
    } as Partial<JsPackageManager> as JsPackageManager;

    mockTaskLog = {
      message: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof prompt.taskLog>;

    vi.mocked(prompt.taskLog).mockReturnValue(mockTaskLog);
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(addonA11yPostinstall).mockResolvedValue(undefined);
    vi.mocked(addonVitestPostinstall).mockResolvedValue(undefined);

    vi.clearAllMocks();
  });

  it('should create command and execute with provided parameters', async () => {
    const result = await executeAddonConfiguration({
      packageManager: mockPackageManager,
      options: { packageManager: PackageManagerName.NPM, yes: false, disableTelemetry: true },
      addons: [],
      configDir: '.storybook',
    });

    expect(result).toEqual({ status: 'success' });
  });

  it('should execute addon configuration through helper function', async () => {
    const result = await executeAddonConfiguration({
      packageManager: mockPackageManager,
      options: { packageManager: PackageManagerName.NPM, yes: true, disableTelemetry: false },
      addons: ['@storybook/addon-a11y'],
      configDir: '.storybook',
    });

    expect(result).toEqual({ status: 'success' });
    expect(addonA11yPostinstall).toHaveBeenCalled();
  });
});
