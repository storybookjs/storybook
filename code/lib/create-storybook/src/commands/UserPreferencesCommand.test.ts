import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonVitestService, ProjectType, globalSettings } from 'storybook/internal/cli';
import { PackageManagerName, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';
import { Feature } from 'storybook/internal/types';

import type { CommandOptions } from '../generators/types.ts';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService.ts';
import { TelemetryService } from '../services/TelemetryService.ts';
import { UserPreferencesCommand, executeUserPreferences } from './UserPreferencesCommand.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../services/FeatureCompatibilityService', { spy: true });
vi.mock('../services/TelemetryService', { spy: true });

interface CommandWithPrivates {
  telemetryService: {
    trackNewUserCheck: ReturnType<typeof vi.fn>;
    trackInstallType: ReturnType<typeof vi.fn>;
    trackAiSetupNudge: ReturnType<typeof vi.fn>;
  };
}

describe('UserPreferencesCommand', () => {
  let command: UserPreferencesCommand;
  const originalIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  const defaultExecuteOptions = {
    framework: null as null,
    builder: 'vite' as SupportedBuilder,
    renderer: 'react' as SupportedRenderer,
    projectType: ProjectType.REACT,
    isTestFeatureAvailable: true,
    isAiSetupAvailable: false,
  };

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

    command = new UserPreferencesCommand(commandOptions);

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
      trackAiSetupNudge: vi.fn(),
    };

    // Inject mocked services
    (command as unknown as CommandWithPrivates).telemetryService = mockTelemetryService;

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
        ...defaultExecuteOptions,
        isTestFeatureAvailable: true,
      });

      expect(result.newUser).toBe(true);
      expect(result.selectedFeatures).toContain('docs');
      expect(result.selectedFeatures).toContain('test');
      expect(result.selectedFeatures).toContain('onboarding');
    });

    it('should prompt for new user in interactive mode', async () => {
      // Mock TTY
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute(defaultExecuteOptions);

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

      const result = await command.execute(defaultExecuteOptions);

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(false);
    });

    it('should remove test feature if isTestFeatureAvailable is false', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute({
        ...defaultExecuteOptions,
        isTestFeatureAvailable: false,
      });

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(true);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(true);
    });
  });

  describe('isTestFeatureAvailable option', () => {
    it('should include test feature when isTestFeatureAvailable=true in recommended install', async () => {
      const result = await command.execute({
        ...defaultExecuteOptions,
        isTestFeatureAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(true);
    });

    it('should NOT include test feature when isTestFeatureAvailable=false in recommended install', async () => {
      const result = await command.execute({
        ...defaultExecuteOptions,
        isTestFeatureAvailable: false,
      });

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      // Other features should still be present
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(true);
      expect(result.selectedFeatures.has(Feature.A11Y)).toBe(true);
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
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(prompt.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Would you like to install AI features (MCP addon, skills and prompt suggestions)?'
          ),
        })
      );
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not include ONBOARDING feature when user accepts AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(false);
    });

    it('should include ONBOARDING when AI is selected inside a sandbox (IN_STORYBOOK_SANDBOX)', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });
      process.env.IN_STORYBOOK_SANDBOX = 'true';

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      delete process.env.IN_STORYBOOK_SANDBOX;

      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(true);
    });

    it('should not include AI feature when user declines AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // AI setup: no

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
    });

    it('should default AI to true when prompts are skipped (non-interactive)', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      });

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
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
      const yesCommand = new UserPreferencesCommand(commandOptions);

      // Inject mocked services
      (yesCommand as unknown as CommandWithPrivates).telemetryService = {
        trackNewUserCheck: vi.fn(),
        trackInstallType: vi.fn(),
        trackAiSetupNudge: vi.fn(),
      };

      const result = await yesCommand.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not prompt for AI setup when isAiSetupAvailable is false', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: false,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
    });

    it('should include test feature in minimal installs when user accepts AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
      expect(result.selectedFeatures.has(Feature.TEST)).toBe(true);
      // Other recommended features should NOT be present with light install
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
    });

    it('should not include test feature in minimal installs when user declines AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // AI setup: no

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
    });

    it('should track ai-prompt-nudge telemetry when user accepts AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackAiSetupNudge).toHaveBeenCalledWith({ skipPrompt: false });
    });

    it('should not track ai-prompt-nudge telemetry when user declines AI setup', async () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // AI setup: no

      await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackAiSetupNudge).not.toHaveBeenCalled();
    });

    it('should track ai-prompt-nudge telemetry when AI is auto-accepted in non-interactive mode', async () => {
      // Non-interactive (no TTY) with AI available — auto-accepts
      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackAiSetupNudge).toHaveBeenCalledWith({ skipPrompt: true });
    });
  });

  describe('executeUserPreferences helper', () => {
    it('should return a valid result', async () => {
      const commandOptions: CommandOptions = {
        packageManager: PackageManagerName.NPM,
        disableTelemetry: true,
      };

      const result = await executeUserPreferences({
        options: commandOptions,
        ...defaultExecuteOptions,
      });

      // Should return a valid result
      expect(result.selectedFeatures).toBeDefined();
      expect(result.newUser).toBeDefined();
    });
  });
});
