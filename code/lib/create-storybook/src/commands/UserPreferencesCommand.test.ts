import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalSettings } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { SupportedBuilder } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';
import { UserPreferencesCommand } from './UserPreferencesCommand';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    AddonVitestService: vi.fn().mockImplementation(() => ({
      validateCompatibility: vi.fn(),
    })),
    globalSettings: vi.fn(),
  };
});
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

interface CommandWithPrivates {
  telemetryService: {
    trackNewUserCheck: ReturnType<typeof vi.fn>;
    trackInstallType: ReturnType<typeof vi.fn>;
  };
  featureService: { validateTestFeatureCompatibility: ReturnType<typeof vi.fn> };
}

describe('UserPreferencesCommand', () => {
  let command: UserPreferencesCommand;
  let mockPackageManager: JsPackageManager;
  let mockDependencyCollector: DependencyCollector;

  beforeEach(() => {
    // Create mock dependency collector
    mockDependencyCollector = {
      addDevDependencies: vi.fn(),
      addDependencies: vi.fn(),
      getAllPackages: vi.fn().mockReturnValue({ dependencies: [], devDependencies: [] }),
      hasPackages: vi.fn().mockReturnValue(false),
      merge: vi.fn(),
      validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      getVersionConflicts: vi.fn().mockReturnValue([]),
    } as unknown as DependencyCollector;

    command = new UserPreferencesCommand(mockDependencyCollector, undefined, false);
    mockPackageManager = {} as Partial<JsPackageManager> as JsPackageManager;

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
      validateTestFeatureCompatibility: vi.fn(),
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

    // Default feature validation (compatible)
    const featureService = (command as unknown as CommandWithPrivates).featureService;
    vi.mocked(featureService.validateTestFeatureCompatibility).mockResolvedValue({
      compatible: true,
    });

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return recommended config for new users in non-interactive mode', async () => {
      const result = await command.execute(mockPackageManager, {
        yes: true,
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(result.newUser).toBe(true);
      expect(result.installType).toBe('recommended');
      expect(result.selectedFeatures).toContain('docs');
      expect(result.selectedFeatures).toContain('test');
      expect(result.selectedFeatures).toContain('onboarding');
    });

    it('should prompt for new user in interactive mode', async () => {
      // Mock TTY
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user

      const result = await command.execute(mockPackageManager, {
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
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
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install

      const result = await command.execute(mockPackageManager, {
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(prompt.select).toHaveBeenCalledTimes(2);
      expect(result.newUser).toBe(false);
      expect(result.installType).toBe('light');
      const telemetryService = (command as unknown as CommandWithPrivates).telemetryService;
      expect(telemetryService.trackInstallType).toHaveBeenCalledWith('light');
    });

    it('should not include test feature in minimal install', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(prompt.select)
        .mockResolvedValueOnce(false) // not new user
        .mockResolvedValueOnce('light'); // minimal install

      const result = await command.execute(mockPackageManager, {
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(result.selectedFeatures.has('test')).toBe(false);
      expect(result.selectedFeatures.has('docs')).toBe(false);
      expect(result.selectedFeatures.has('onboarding')).toBe(false);
    });

    it('should not include test feature in CI environment', async () => {
      vi.mocked(isCI).mockReturnValue(true);

      const result = await command.execute(mockPackageManager, {
        yes: true,
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(result.selectedFeatures.has('docs')).toBe(true);
      expect(result.selectedFeatures.has('test')).toBe(false);
    });

    it('should validate test feature compatibility in interactive mode', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      const featureService = (command as unknown as CommandWithPrivates).featureService;
      vi.mocked(featureService.validateTestFeatureCompatibility).mockResolvedValue({
        compatible: true,
      });

      await command.execute(mockPackageManager, {
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(featureService.validateTestFeatureCompatibility).toHaveBeenCalledWith(
        mockPackageManager,
        undefined,
        'vite',
        process.cwd()
      );
    });

    it('should remove test feature if user chooses to continue without it', async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(prompt.select).mockResolvedValueOnce(true); // new user
      const featureService = (command as unknown as CommandWithPrivates).featureService;
      vi.mocked(featureService.validateTestFeatureCompatibility).mockResolvedValue({
        compatible: false,
        reasons: ['React version is too old'],
      });
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true); // continue without test

      const result = await command.execute(mockPackageManager, {
        framework: undefined,
        builder: 'vite' as SupportedBuilder,
      });

      expect(result.selectedFeatures.has('test')).toBe(false);
      expect(result.selectedFeatures.has('docs')).toBe(true);
      expect(result.selectedFeatures.has('onboarding')).toBe(true);
    });
  });
});
