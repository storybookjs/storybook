/**
 * NOTE: These tests use the VersionService from the refactored implementation. The promptNewUser
 * and promptInstallType functions are tested in:
 *
 * - Services/VersionService.test.ts (for version detection)
 * - Commands/UserPreferencesCommand.test.ts (for user prompts)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { HandledError, type JsPackageManager } from 'storybook/internal/common';
import {
  SupportedBuilder,
  SupportedLanguage,
  SupportedRenderer,
} from 'storybook/internal/types';

import {
  executeAddonConfiguration,
  executeDependencyInstallation,
  executeFinalization,
  executeFrameworkDetection,
  executeGeneratorExecution,
  executePreflightCheck,
  executeProjectDetection,
  executeTypeScriptDependency,
  executeUserPreferences,
} from './commands/index.ts';
import { registerAllGenerators } from './generators/index.ts';
import type { CommandOptions } from './generators/types.ts';
import { doInitiate } from './initiate.ts';
import { FeatureCompatibilityService } from './services/FeatureCompatibilityService.ts';
import { VersionService } from './services/VersionService.ts';

// Create a version service instance for testing
const versionService = new VersionService();
const getCliIntegrationFromAncestry =
  versionService.getCliIntegrationFromAncestry.bind(versionService);

vi.mock('storybook/internal/telemetry');

vi.mock('storybook/internal/core-server', () => ({
  getServerPort: vi.fn().mockResolvedValue(6006),
  withTelemetry: vi.fn(),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logTracker: {
    writeToFile: vi.fn().mockResolvedValue('/tmp/debug-storybook.log'),
  },
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    outro: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock('./commands/index.ts', { spy: true });
vi.mock('./generators/index.ts', { spy: true });
vi.mock('./services/FeatureCompatibilityService.ts', { spy: true });

describe('getCliIntegrationFromAncestry', () => {
  it('returns the CLI integration if nested calls', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }, { command: 'npx sv create' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv create');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv@latest add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns undefined if no CLI integration found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npm' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBeUndefined();
  });
});

describe('doInitiate', () => {
  const packageManager = {} as JsPackageManager;

  beforeEach(() => {
    vi.mocked(registerAllGenerators).mockImplementation(() => {});
    vi.mocked(executePreflightCheck).mockResolvedValue({ packageManager, isEmptyProject: false });
    vi.mocked(executeProjectDetection).mockResolvedValue({
      projectType: ProjectType.REACT,
      language: SupportedLanguage.TYPESCRIPT,
    });
    vi.mocked(executeFrameworkDetection).mockResolvedValue({
      framework: null,
      builder: SupportedBuilder.VITE,
      renderer: SupportedRenderer.REACT,
    });
    vi.mocked(
      FeatureCompatibilityService.prototype.validateTestFeatureCompatibility
    ).mockResolvedValue({ compatible: false });
    vi.mocked(executeUserPreferences).mockResolvedValue({
      newUser: false,
      selectedFeatures: new Set(),
    });
    vi.mocked(executeTypeScriptDependency).mockResolvedValue('not-needed');
    vi.mocked(executeGeneratorExecution).mockResolvedValue({
      configDir: '.storybook',
      storybookCommand: 'npm run storybook',
      shouldRunDev: true,
      extraAddons: [],
      postInstall: undefined,
    } as never);
    vi.mocked(executeAddonConfiguration).mockResolvedValue(undefined);
    vi.mocked(executeFinalization).mockResolvedValue(undefined);
  });

  it('aborts when dependency installation fails', async () => {
    vi.mocked(executeDependencyInstallation).mockResolvedValue({ status: 'failed' });

    await expect(doInitiate({} as CommandOptions)).rejects.toThrow(HandledError);

    expect(executeAddonConfiguration).not.toHaveBeenCalled();
    expect(executeFinalization).not.toHaveBeenCalled();
  });
});
