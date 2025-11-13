import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  Feature,
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';

import { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { baseGenerator } from '../generators/baseGenerator';
import { AddonService } from '../services';
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
vi.mock('../services', () => ({
  AddonService: vi.fn().mockImplementation(() => ({
    getAddonsForFeatures: vi.fn(),
  })),
}));

describe('GeneratorExecutionCommand', () => {
  let command: GeneratorExecutionCommand;
  let mockPackageManager: JsPackageManager;
  let dependencyCollector: DependencyCollector;
  let mockGenerator: {
    metadata: {
      projectType: ProjectType;
      renderer: SupportedRenderer;
      framework?: SupportedFramework;
    };
    configure: ReturnType<typeof vi.fn>;
  };
  let mockFrameworkInfo: FrameworkDetectionResult;
  let mockAddonService: { getAddonsForFeatures: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dependencyCollector = new DependencyCollector();
    mockAddonService = {
      getAddonsForFeatures: vi.fn().mockReturnValue([]),
    };
    vi.mocked(AddonService).mockImplementation(
      () => mockAddonService as unknown as InstanceType<typeof AddonService>
    );
    command = new GeneratorExecutionCommand(dependencyCollector);
    mockPackageManager = {
      getRunCommand: vi.fn().mockReturnValue('npm run storybook'),
    } as unknown as JsPackageManager;

    mockFrameworkInfo = {
      renderer: SupportedRenderer.REACT,
      builder: SupportedBuilder.VITE,
      framework: SupportedFramework.REACT_VITE,
    };

    // Mock new-style generator module
    mockGenerator = {
      metadata: {
        projectType: ProjectType.REACT,
        renderer: SupportedRenderer.REACT,
        framework: undefined,
      },
      configure: vi.fn().mockResolvedValue({
        extraPackages: [],
        extraAddons: [],
      }),
    };

    vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
    vi.mocked(logger.warn).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute generator with all features', async () => {
      const selectedFeatures = new Set([Feature.DOCS, Feature.TEST, Feature.ONBOARDING]);
      mockAddonService.getAddonsForFeatures.mockReturnValue([
        '@chromatic-com/storybook',
        '@storybook/addon-vitest',
        '@storybook/addon-docs',
        '@storybook/addon-onboarding',
      ]);
      const options = {
        skipInstall: false,
        features: selectedFeatures,
        packageManager: PackageManagerName.NPM,
      };

      await command.execute({
        projectType: ProjectType.REACT,
        packageManager: mockPackageManager,
        frameworkInfo: mockFrameworkInfo,
        options,
        selectedFeatures,
      });

      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT);
      expect(mockGenerator.configure).toHaveBeenCalled();
      expect(baseGenerator).toHaveBeenCalled();
      expect(mockAddonService.getAddonsForFeatures).toHaveBeenCalledWith(selectedFeatures);
    });

    it('should throw error if generator not found', async () => {
      vi.mocked(generatorRegistry.get).mockReturnValue(undefined);
      const selectedFeatures = new Set([]);
      const options = {
        features: selectedFeatures,
        packageManager: PackageManagerName.NPM,
      };

      await expect(
        command.execute({
          projectType: ProjectType.UNSUPPORTED,
          packageManager: mockPackageManager,
          frameworkInfo: mockFrameworkInfo,
          options,
          selectedFeatures,
        })
      ).rejects.toThrow('No generator found for project type');
    });

    it('should pass correct options to generator', async () => {
      const selectedFeatures = new Set([Feature.DOCS, Feature.TEST, Feature.A11Y]);
      mockAddonService.getAddonsForFeatures.mockReturnValue([
        '@chromatic-com/storybook',
        '@storybook/addon-vitest',
        '@storybook/addon-a11y',
        '@storybook/addon-docs',
      ]);
      const options = {
        skipInstall: true,
        builder: SupportedBuilder.VITE,
        linkable: true,
        usePnp: true,
        yes: true,
        features: selectedFeatures,
        packageManager: PackageManagerName.NPM,
      };

      await command.execute({
        projectType: ProjectType.VUE3,
        packageManager: mockPackageManager,
        frameworkInfo: mockFrameworkInfo,
        options,
        selectedFeatures,
      });

      expect(mockGenerator.configure).toHaveBeenCalledWith(
        mockPackageManager,
        expect.objectContaining({
          framework: mockFrameworkInfo.framework,
          renderer: mockFrameworkInfo.renderer,
          builder: mockFrameworkInfo.builder,
          features: selectedFeatures,
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
          features: expect.any(Set),
          dependencyCollector: expect.any(Object),
        }),
        expect.objectContaining({
          extraAddons: expect.arrayContaining([
            '@chromatic-com/storybook',
            '@storybook/addon-vitest',
            '@storybook/addon-a11y',
            '@storybook/addon-docs',
          ]),
          extraPackages: [],
        })
      );
      expect(mockAddonService.getAddonsForFeatures).toHaveBeenCalledWith(selectedFeatures);
    });
  });
});
