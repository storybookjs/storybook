import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import * as addonA11y from '../addon-dependencies/addon-a11y';
import * as addonVitest from '../addon-dependencies/addon-vitest';
import { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { baseGenerator } from '../generators/baseGenerator';
import type { FrameworkDetectionResult } from './FrameworkDetectionCommand';
import { GeneratorExecutionCommand } from './GeneratorExecutionCommand';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../generators/GeneratorRegistry', { spy: true });
vi.mock('../generators/baseGenerator', () => ({
  baseGenerator: vi.fn().mockResolvedValue({
    frameworkPackage: '@storybook/react-vite',
    rendererPackage: '@storybook/react',
    builderPackage: '@storybook/builder-vite',
    configDir: '.storybook',
    success: true,
  }),
}));
vi.mock('../addon-dependencies/addon-a11y', { spy: true });
vi.mock('../addon-dependencies/addon-vitest', { spy: true });

describe('GeneratorExecutionCommand', () => {
  let command: GeneratorExecutionCommand;
  let mockPackageManager: JsPackageManager;
  let dependencyCollector: DependencyCollector;
  let mockGenerator: any;
  let mockFrameworkInfo: FrameworkDetectionResult;

  beforeEach(() => {
    command = new GeneratorExecutionCommand();
    mockPackageManager = {
      getRunCommand: vi.fn().mockReturnValue('npm run storybook'),
    } as any;
    dependencyCollector = new DependencyCollector();

    mockFrameworkInfo = {
      renderer: SupportedRenderer.REACT,
      builder: SupportedBuilder.VITE,
      framework: SupportedFramework.REACT_VITE,
    };

    // Mock new-style generator module
    mockGenerator = {
      metadata: {
        projectType: ProjectType.REACT,
        renderer: 'react',
        framework: undefined,
      },
      configure: vi.fn().mockResolvedValue({
        extraPackages: [],
        extraAddons: [],
      }),
    };

    vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
    vi.mocked(addonVitest.getAddonVitestDependencies).mockResolvedValue([
      'vitest',
      '@vitest/browser',
    ]);
    vi.mocked(addonA11y.getAddonA11yDependencies).mockReturnValue([]);
    vi.mocked(logger.warn).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute generator with all features', async () => {
      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);
      const options = { skipInstall: false } as any;

      await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        mockFrameworkInfo,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT);
      expect(mockGenerator.configure).toHaveBeenCalled();
      expect(baseGenerator).toHaveBeenCalled();
    });

    it('should remove onboarding for unsupported project types', async () => {
      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);
      const options = {} as any;

      await command.execute(
        ProjectType.SVELTE,
        mockPackageManager,
        mockFrameworkInfo,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(selectedFeatures.has('onboarding')).toBe(false);
      expect(selectedFeatures.has('docs')).toBe(true);
      expect(selectedFeatures.has('test')).toBe(true);
    });

    it('should keep onboarding for supported project types', async () => {
      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);
      const options = {} as any;

      await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        mockFrameworkInfo,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(selectedFeatures.has('onboarding')).toBe(true);
    });

    it('should throw error if generator not found', async () => {
      vi.mocked(generatorRegistry.get).mockReturnValue(undefined);
      const selectedFeatures = new Set([]);
      const options = {} as any;

      await expect(
        command.execute(
          ProjectType.UNSUPPORTED,
          mockPackageManager,
          mockFrameworkInfo,
          options,
          selectedFeatures,
          dependencyCollector
        )
      ).rejects.toThrow('No generator found for project type');
    });

    it('should pass correct options to generator', async () => {
      const selectedFeatures = new Set(['docs', 'test'] as const);
      const options = {
        skipInstall: true,
        builder: 'vite',
        linkable: true,
        usePnp: true,
        yes: true,
      } as any;

      await command.execute(
        ProjectType.VUE3,
        mockPackageManager,
        mockFrameworkInfo,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(mockGenerator.configure).toHaveBeenCalledWith(
        mockPackageManager,
        expect.objectContaining({
          framework: mockFrameworkInfo.framework,
          renderer: mockFrameworkInfo.renderer,
          builder: mockFrameworkInfo.builder,
          features: ['docs', 'test'],
        })
      );

      expect(baseGenerator).toHaveBeenCalledWith(
        mockPackageManager,
        { type: 'devDependencies', skipInstall: true },
        expect.objectContaining({
          builder: SupportedBuilder.VITE,
          linkable: true,
          pnp: true,
          yes: true,
          projectType: ProjectType.VUE3,
          features: ['docs', 'test'],
        }),
        mockFrameworkInfo.renderer,
        expect.any(Object),
        mockFrameworkInfo.framework
      );
    });
  });
});
