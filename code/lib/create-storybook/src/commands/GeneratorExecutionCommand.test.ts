import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { DependencyCollector } from '../dependency-collector';
import * as addonA11y from '../addon-dependencies/addon-a11y';
import * as addonVitest from '../addon-dependencies/addon-vitest';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { GeneratorExecutionCommand } from './GeneratorExecutionCommand';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../generators/GeneratorRegistry', { spy: true });
vi.mock('../addon-dependencies/addon-a11y', { spy: true });
vi.mock('../addon-dependencies/addon-vitest', { spy: true });

describe('GeneratorExecutionCommand', () => {
  let command: GeneratorExecutionCommand;
  let mockPackageManager: JsPackageManager;
  let dependencyCollector: DependencyCollector;
  let mockGenerator: any;

  beforeEach(() => {
    command = new GeneratorExecutionCommand();
    mockPackageManager = {
      getRunCommand: vi.fn().mockReturnValue('npm run storybook'),
    } as any;
    dependencyCollector = new DependencyCollector();

    mockGenerator = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
    vi.mocked(addonVitest.getAddonVitestDependencies).mockResolvedValue(['vitest', '@vitest/browser']);
    vi.mocked(addonA11y.getAddonA11yDependencies).mockReturnValue([]);
    vi.mocked(logger.warn).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute generator with all features', async () => {
      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);
      const options = { skipInstall: false } as any;

      const result = await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(generatorRegistry.get).toHaveBeenCalledWith(ProjectType.REACT);
      expect(mockGenerator).toHaveBeenCalled();
      expect(result.storybookCommand).toBe('npm run storybook');
    });

    it('should remove onboarding for unsupported project types', async () => {
      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);
      const options = {} as any;

      await command.execute(
        ProjectType.SVELTE,
        mockPackageManager,
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
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(selectedFeatures.has('onboarding')).toBe(true);
    });

    it('should collect addon dependencies when test feature is enabled', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;
      const addDevDependenciesSpy = vi.spyOn(dependencyCollector, 'addDevDependencies');

      await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(addonVitest.getAddonVitestDependencies).toHaveBeenCalledWith(
        mockPackageManager,
        undefined
      );
      expect(addonA11y.getAddonA11yDependencies).toHaveBeenCalled();
      expect(addDevDependenciesSpy).toHaveBeenCalled();
    });

    it('should pass framework package name for Next.js projects', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;

      await command.execute(
        ProjectType.NEXTJS,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(addonVitest.getAddonVitestDependencies).toHaveBeenCalledWith(
        mockPackageManager,
        '@storybook/nextjs'
      );
    });

    it('should not collect addon dependencies when test feature is disabled', async () => {
      const selectedFeatures = new Set(['docs'] as const);
      const options = {} as any;

      await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(addonVitest.getAddonVitestDependencies).not.toHaveBeenCalled();
      expect(addonA11y.getAddonA11yDependencies).not.toHaveBeenCalled();
    });

    it('should handle addon dependency collection errors gracefully', async () => {
      const selectedFeatures = new Set(['test'] as const);
      const options = {} as any;
      vi.mocked(addonVitest.getAddonVitestDependencies).mockRejectedValue(
        new Error('Network error')
      );

      await command.execute(
        ProjectType.REACT,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to collect addon dependencies')
      );
    });

    it('should return Angular-specific command for Angular projects', async () => {
      const selectedFeatures = new Set([]);
      const options = {} as any;
      mockGenerator.mockResolvedValue({ projectName: 'my-app' });

      const result = await command.execute(
        ProjectType.ANGULAR,
        mockPackageManager,
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(result.storybookCommand).toBe('ng run my-app:storybook');
    });

    it('should throw error if generator not found', async () => {
      vi.mocked(generatorRegistry.get).mockReturnValue(undefined);
      const selectedFeatures = new Set([]);
      const options = {} as any;

      await expect(
        command.execute(
          ProjectType.UNSUPPORTED,
          mockPackageManager,
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
        options,
        selectedFeatures,
        dependencyCollector
      );

      expect(mockGenerator).toHaveBeenCalledWith(
        mockPackageManager,
        { type: 'devDependencies', skipInstall: true },
        expect.objectContaining({
          builder: 'vite',
          linkable: true,
          pnp: true,
          yes: true,
          projectType: ProjectType.VUE3,
          features: ['docs', 'test'],
          dependencyCollector,
        }),
        options
      );
    });
  });
});

