import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, installSkills } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { telemetry } from 'storybook/internal/telemetry';
import {
  Feature,
  SupportedBuilder,
  SupportedFramework,
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
  executeUserPreferences,
} from './commands/index.ts';
import { doInitiate } from './initiate.ts';
import { FeatureCompatibilityService } from './services/FeatureCompatibilityService.ts';

vi.mock('storybook/internal/cli', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('./commands/index.ts', { spy: true });
vi.mock('./generators/index.ts');
vi.mock('./services/FeatureCompatibilityService.ts', { spy: true });
vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  cache: { set: vi.fn().mockResolvedValue(undefined) } as never,
}));

const packageManager = {
  getPackageCommand: () => 'npx storybook skills setup',
} as Partial<JsPackageManager> as JsPackageManager;

const initiateWith = (...features: Feature[]) => {
  vi.mocked(executeUserPreferences).mockResolvedValue({
    newUser: false,
    selectedFeatures: new Set(features),
  });
  return doInitiate({ packageManager: 'npm' } as Parameters<typeof doInitiate>[0]);
};

describe('init: the skills step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(telemetry).mockResolvedValue(undefined);
    vi.mocked(executePreflightCheck).mockResolvedValue({ packageManager, isEmptyProject: false });
    vi.mocked(executeProjectDetection).mockResolvedValue({
      projectType: ProjectType.REACT,
      language: SupportedLanguage.TYPESCRIPT,
    });
    vi.mocked(executeFrameworkDetection).mockResolvedValue({
      framework: SupportedFramework.REACT_VITE,
      builder: SupportedBuilder.VITE,
      renderer: SupportedRenderer.REACT,
    });
    vi.mocked(
      FeatureCompatibilityService.prototype.validateTestFeatureCompatibility
    ).mockResolvedValue({ compatible: true });
    vi.mocked(executeGeneratorExecution).mockResolvedValue({
      configDir: '.storybook',
      storybookCommand: 'npm run storybook',
      extraAddons: [],
    } as Awaited<ReturnType<typeof executeGeneratorExecution>>);
    vi.mocked(executeDependencyInstallation).mockResolvedValue({ status: 'success' });
    vi.mocked(executeAddonConfiguration).mockResolvedValue({ status: 'success' });
    vi.mocked(executeFinalization).mockResolvedValue(undefined);
    vi.mocked(installSkills).mockResolvedValue({ result: 'installed', source: 'ai-feature' });
  });

  it('installs the skills when the AI feature is selected, and reports the result', async () => {
    await initiateWith(Feature.DOCS, Feature.AI);

    expect(installSkills).toHaveBeenCalledWith({ packageManager, source: 'ai-feature' });
    expect(telemetry).toHaveBeenCalledWith('init-step', {
      step: 'skills',
      result: 'installed',
      source: 'ai-feature',
    });
  });

  it('installs nothing without the AI feature', async () => {
    await initiateWith(Feature.DOCS, Feature.TEST);

    expect(installSkills).not.toHaveBeenCalled();
  });

  it('installs nothing on a framework without the AI features, even when AI is selected', async () => {
    vi.mocked(executeFrameworkDetection).mockResolvedValue({
      framework: SupportedFramework.NUXT,
      builder: SupportedBuilder.VITE,
      renderer: SupportedRenderer.VUE3,
    });

    await initiateWith(Feature.AI);

    expect(installSkills).not.toHaveBeenCalled();
    expect(executeFinalization).toHaveBeenCalledWith(
      expect.objectContaining({ showAiInstructions: false })
    );
  });

  it('prints the setup prompt where AI setup is supported', async () => {
    await initiateWith(Feature.AI);

    expect(executeFinalization).toHaveBeenCalledWith(
      expect.objectContaining({ showAiInstructions: true })
    );
  });

  it('installs the skills without the setup prompt where AI setup is not supported', async () => {
    vi.mocked(executeFrameworkDetection).mockResolvedValue({
      framework: SupportedFramework.NEXTJS,
      builder: SupportedBuilder.WEBPACK5,
      renderer: SupportedRenderer.REACT,
    });

    await initiateWith(Feature.AI);

    expect(installSkills).toHaveBeenCalledWith({ packageManager, source: 'ai-feature' });
    expect(executeFinalization).toHaveBeenCalledWith(
      expect.objectContaining({ showAiInstructions: false })
    );
  });
});
