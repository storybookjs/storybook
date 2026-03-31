import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonVitestService, ProjectType, globalSettings } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { PackageManagerName, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { SupportedBuilder } from 'storybook/internal/types';
import { Feature } from 'storybook/internal/types';

import type { CommandOptions } from '../generators/types';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService';
import { TelemetryService } from '../services/TelemetryService';
import { UserPreferencesCommand } from './UserPreferencesCommand';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../services/FeatureCompatibilityService', { spy: true });
vi.mock('../services/TelemetryService', { spy: true });

interface CommandWithPrivates {
  telemetryService: {
    trackNewUserCheck: ReturnType<typeof vi.fn>;
    trackInstallType: ReturnType<typeof vi.fn>;
  };
  featureService: {
    validateTestFeatureCompatibility: ReturnType<typeof vi.fn>;
  };
}

describe('UserPreferencesCommand', () => {
  let command: UserPreferencesCommand;
  const mockPackageManager = {} as Partial<JsPackageManager> as JsPackageManager;
  const originalIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  afterAll(() => {
    if (originalIsTTYDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTYDescriptor);
    } else {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    // Provide required CommandOptions to avoid undefined access
    const commandOptions: CommandOptions = {
      packageManager: PackageManagerName.NPM,
      disableTelemetry: true,
    };

    command = new UserPreferencesCommand(commandOptions, mockPackageManager);

    // Mock AddonVitestService
    const mockAddonVitestService = vi.fn().mockImplementation(() => ({
      validateCompatibility: vi.fn().mockResolvedValue({ compatible: true }),
    }));
    vi.mocked(AddonVitestService).mockImplementation(mockAddonVitestService);

    // Mock FeatureCompatibilityService
    vi.mocked(FeatureCompatibilityService).mockImplementation(function () {
      return {
        validateTestFeatureCompatibility: vi.fn().mockResolvedValue({ compatible: true }),
      };
    });

    // Mock TelemetryService
    vi.mocked(TelemetryService).mockImplementation(function () {
      return {
        trackNewUserCheck: vi.fn(),
        trackInstallType: vi.fn(),
      };
    });

    // Mock globalSettings
    const mockSettings = {
      value: { init: {} },
      save: vi.fn().mockResolvedValue(undefined),
      filePath: 'test-config.json',
    };
    vi.mocked(globalSettings).mockResolvedValue(
      mockSettings as unknown as Awaited<ReturnType<typeof globalSettings>>
    );

    // Create mock services
    const mockTelemetryService = {
      trackNewUserCheck: vi.fn(),
      trackInstallType: vi.fn(),
    };

    const mockFeatureService = {
      validateTestFeatureCompatibility: vi.fn().mockResolvedValue({ compatible: true }),
    };

    // Inject mocked services
    (command as unknown as CommandWithPrivates).telemetryService = mockTelemetryService;
    (command as unknown as CommandWithPrivates).featureService = mockFeatureService;

    // Mock logger and prompt
    vi.mocked(logger.intro).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(isCI).mockReturnValue(false);

    // Reset isTTY to avoid leaking between tests
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      configurable: true,
    });

    vi.clearAllMocks();

    // Re-apply mocks after clearAllMocks (which clears call history but not implementations,
    // however mockResolvedValueOnce queues may leak between tests, so reset prompt mocks)
    vi.mocked(prompt.select).mockReset();
    vi.mocked(prompt.confirm).mockReset();
  });

  describe('execute', () => {
    it('should return recommended config for new users in non-interactive mode', async () => {
      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.newUser).toBe(true);
      expect(result.selectedFeatures).toContain('docs');
      expect(result.selectedFeatures).toContain('test');
      expect(result.selectedFeatures).toContain('onboarding');
    });

    it('should include AI feature by default in non-interactive mode', async () => {
      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should prompt for new user in interactive mode', async () => {
      // Mock TTY
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'New to Storybook?',
        })
      );
      expect(result.newUser).toBe(true);
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackNewUserCheck).toHaveBeenCalledWith(true);
    });

    it('should prompt for install type when not a new user', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // no AI setup

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(prompt.select).toHaveBeenCalledTimes(2);
      expect(result.newUser).toBe(false);
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackInstallType).toHaveBeenCalledWith('light');
    });

    it('should not include test feature in minimal install', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // no AI setup

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(false);
    });

    it('should validate test feature compatibility in interactive mode', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup
      const featureService = (command as unknown as CommandWithPrivates).featureService;
      vi.mocked(featureService.validateTestFeatureCompatibility).mockResolvedValue({
        compatible: true,
      });

      await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(featureService.validateTestFeatureCompatibility).toHaveBeenCalledWith(
        null,
        'vite',
        process.cwd()
      );
    });

    it('should remove test feature if user chooses to continue without it', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      const featureService = (command as unknown as CommandWithPrivates).featureService;
      vi.mocked(featureService.validateTestFeatureCompatibility).mockResolvedValue({
        compatible: false,
        reasons: ['React version is too old'],
      });
      vi.mocked(prompt.confirm)
        .mockResolvedValueOnce(true) // continue without test
        .mockResolvedValueOnce(true); // AI setup

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(true);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(true);
    });
  });

  describe('AI setup prompt', () => {
    it('should include AI feature when user accepts AI setup in interactive mode', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(prompt.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Would you like to improve your Storybook setup with AI?'
          ),
        })
      );
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not include AI feature when user declines AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // AI setup: no

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
    });

    it('should default AI to true when prompts are skipped (non-interactive)', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      });

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should default AI to true when --yes flag is used', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      const commandOptions: CommandOptions = {
        packageManager: PackageManagerName.NPM,
        disableTelemetry: true,
        yes: true,
      };
      const yesCommand = new UserPreferencesCommand(commandOptions, mockPackageManager);

      // Inject mocked services
      (yesCommand as unknown as CommandWithPrivates).telemetryService = {
        trackNewUserCheck: vi.fn(),
        trackInstallType: vi.fn(),
      };
      (yesCommand as unknown as CommandWithPrivates).featureService = {
        validateTestFeatureCompatibility: vi.fn().mockResolvedValue({ compatible: true }),
      };

      const result = await yesCommand.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not include AI feature in minimal installs', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        framework: null,
        builder: 'vite' as SupportedBuilder,
        projectType: ProjectType.REACT,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
      // Other recommended features should NOT be present with light install
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
    });
  });
});
