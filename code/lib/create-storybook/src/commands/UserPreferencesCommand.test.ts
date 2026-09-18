import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    trackPromptCancel: ReturnType<typeof vi.fn>;
  };
}

describe('UserPreferencesCommand', () => {
  let command: UserPreferencesCommand;
  // `process.stdout.isTTY` is ambient process state and exposes no getter to spy on in this
  // environment, so tests mutate it via Object.defineProperty through a small helper and
  // always restore the original value after each test (mirrors withTelemetry.test.ts) to
  // avoid leaking interactivity between tests.
  const originalStdoutIsTTY = process.stdout.isTTY;

  const setStdoutIsTTY = (value: boolean | undefined) => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value,
      configurable: true,
    });
  };

  const defaultExecuteOptions = {
    framework: null as null,
    builder: 'vite' as SupportedBuilder,
    renderer: 'react' as SupportedRenderer,
    projectType: ProjectType.REACT,
    isTestFeatureAvailable: true,
    isAiSetupAvailable: false,
  };

  afterEach(() => {
    setStdoutIsTTY(originalStdoutIsTTY);
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
        trackAiSetupNudge: vi.fn(),
        trackPromptCancel: vi.fn().mockResolvedValue(undefined),
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
      trackPromptCancel: vi.fn().mockResolvedValue(undefined),
    };

    // Inject mocked services
    (command as unknown as CommandWithPrivates).telemetryService = mockTelemetryService;

    // Mock logger and prompt
    vi.mocked(logger.intro).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(isCI).mockReturnValue(false);

    // Reset sandbox env to avoid leaking between tests (or from the actual test environment)
    delete process.env.IN_STORYBOOK_SANDBOX;

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
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute(defaultExecuteOptions);

      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'New to Storybook?',
        }),
        expect.objectContaining({ onCancel: expect.any(Function) })
      );
      expect(result.newUser).toBe(true);
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackNewUserCheck).toHaveBeenCalledWith(true);
    });

    it('should track prompt cancellation for the new user prompt and exit cleanly', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true);

      await command.execute(defaultExecuteOptions);

      const onCancel = vi.mocked(prompt.select).mock.calls[0]?.[1]?.onCancel;
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await onCancel?.();

      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackPromptCancel).toHaveBeenCalledWith('new-user-ask-onboarding');
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it('should prompt for install type when not a new user', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install

      const result = await command.execute(defaultExecuteOptions);

      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(false);
    });

    it('should remove test feature if isTestFeatureAvailable is false', async () => {
      setStdoutIsTTY(true);

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
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(prompt.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Would you like to install AI features (MCP addon and prompt suggestions)?'
          ),
        }),
        expect.objectContaining({ onCancel: expect.any(Function) })
      );
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not include ONBOARDING feature when user accepts AI setup', async () => {
      setStdoutIsTTY(true);

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
      setStdoutIsTTY(true);
      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // AI setup: yes

      const oldInSandbox = process.env.IN_STORYBOOK_SANDBOX;
      process.env.IN_STORYBOOK_SANDBOX = 'true';

      try {
        const result = await command.execute({
          ...defaultExecuteOptions,
          isAiSetupAvailable: true,
        });

        expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
        expect(result.selectedFeatures.has(Feature.ONBOARDING)).toBe(true);
      } finally {
        if (oldInSandbox !== undefined) {
          process.env.IN_STORYBOOK_SANDBOX = oldInSandbox;
        } else {
          delete process.env.IN_STORYBOOK_SANDBOX;
        }
      }
    });

    it('should not include AI feature when user declines AI setup', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false); // AI setup: no

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
    });

    it('should default AI to true when prompts are skipped (non-interactive)', async () => {
      setStdoutIsTTY(undefined);

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should default AI to true when --yes flag is used', async () => {
      setStdoutIsTTY(true);

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
        trackPromptCancel: vi.fn().mockResolvedValue(undefined),
      };

      const result = await yesCommand.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: true,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(true);
    });

    it('should not prompt for AI setup when isAiSetupAvailable is false', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute({
        ...defaultExecuteOptions,
        isAiSetupAvailable: false,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.AI)).toBe(false);
    });

    it('should include test feature in minimal installs when user accepts AI setup', async () => {
      setStdoutIsTTY(true);

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
      setStdoutIsTTY(true);

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
      setStdoutIsTTY(true);

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
      setStdoutIsTTY(true);

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

  describe('React Native-only projects', () => {
    it('should skip the install-type prompt and use the minimal config for existing users', async () => {
      setStdoutIsTTY(true);

      // Not a new user - normally this would trigger the install-type prompt
      vi.mocked(prompt.select).mockResolvedValueOnce(false);

      const result = await command.execute({
        ...defaultExecuteOptions,
        projectType: ProjectType.REACT_NATIVE,
      });

      // Only the new-user prompt should have run - the install-type prompt must be skipped
      expect(prompt.select).toHaveBeenCalledTimes(1);
      expect(prompt.select).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'What configuration should we install?' }),
        expect.anything()
      );

      // Minimal ("light") config: none of the recommended features are installed
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.A11Y)).toBe(false);
      expect(result.selectedFeatures.has(Feature.TEST)).toBe(false);

      // The automatic choice is still recorded for telemetry
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackInstallType).toHaveBeenCalledWith('light');
    });

    it('should use the minimal config for new users without prompting', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute({
        ...defaultExecuteOptions,
        projectType: ProjectType.REACT_NATIVE,
      });

      expect(result.newUser).toBe(true);
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
      expect(result.selectedFeatures.has(Feature.A11Y)).toBe(false);
    });

    it('should use the minimal config in non-interactive mode', async () => {
      const result = await command.execute({
        ...defaultExecuteOptions,
        projectType: ProjectType.REACT_NATIVE,
      });

      expect(prompt.select).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
    });

    it('should use the minimal config when --yes is set', async () => {
      setStdoutIsTTY(true);

      const commandOptions: CommandOptions = {
        packageManager: PackageManagerName.NPM,
        disableTelemetry: true,
        yes: true,
      };
      const yesCommand = new UserPreferencesCommand(commandOptions);

      (yesCommand as unknown as CommandWithPrivates).telemetryService = {
        trackNewUserCheck: vi.fn(),
        trackInstallType: vi.fn(),
        trackAiSetupNudge: vi.fn(),
        trackPromptCancel: vi.fn().mockResolvedValue(undefined),
      };

      const result = await yesCommand.execute({
        ...defaultExecuteOptions,
        projectType: ProjectType.REACT_NATIVE,
      });

      expect(prompt.select).not.toHaveBeenCalled();
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(false);
    });

    it('should still prompt for install type for React Native Web projects', async () => {
      setStdoutIsTTY(true);

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not a new user
        .mockResolvedValueOnce('recommended'); // install type

      const result = await command.execute({
        ...defaultExecuteOptions,
        projectType: ProjectType.REACT_NATIVE_WEB,
      });

      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'What configuration should we install?' }),
        expect.anything()
      );
      expect(result.selectedFeatures.has(Feature.DOCS)).toBe(true);
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
