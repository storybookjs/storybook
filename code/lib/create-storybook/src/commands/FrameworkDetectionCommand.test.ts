import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreBuilder, ProjectType, detectBuilder } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { GeneratorModule } from '../generators/types';
import { FrameworkDetectionCommand } from './FrameworkDetectionCommand';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    detectBuilder: vi.fn(),
  };
});

vi.mock('../generators/GeneratorRegistry', () => ({
  generatorRegistry: {
    get: vi.fn(),
  },
}));

describe('FrameworkDetectionCommand', () => {
  let command: FrameworkDetectionCommand;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    command = new FrameworkDetectionCommand();
    mockPackageManager = {} as any;
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should detect framework and builder from generator metadata', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT,
          renderer: 'react',
          framework: undefined,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(CoreBuilder.Vite);

      const result = await command.execute(ProjectType.REACT, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: undefined,
        renderer: 'react',
        builder: CoreBuilder.Vite,
        frameworkPackage: '@storybook/react-vite',
        rendererPackage: '@storybook/react',
        builderPackage: '@storybook/builder-vite',
      });

      expect(detectBuilder).toHaveBeenCalledWith(mockPackageManager);
    });

    it('should use CLI builder option if provided', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
          framework: undefined,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.VUE3, mockPackageManager, {
        builder: CoreBuilder.Webpack5,
      } as any);

      expect(result.builder).toBe(CoreBuilder.Webpack5);
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle framework with specific framework package', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.SVELTEKIT,
          renderer: 'svelte',
          framework: 'sveltekit',
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.SVELTEKIT, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: 'sveltekit',
        renderer: 'svelte',
        builder: CoreBuilder.Vite,
        frameworkPackage: '@storybook/sveltekit',
        rendererPackage: '@storybook/svelte',
        builderPackage: '@storybook/builder-vite',
      });
    });

    it('should throw error if no generator found', async () => {
      vi.mocked(generatorRegistry.get).mockReturnValue(undefined);

      await expect(
        command.execute(ProjectType.REACT, mockPackageManager, {} as any)
      ).rejects.toThrow('No generator found for project type: REACT');
    });

    it('should handle old-style generators by returning undefined', async () => {
      // Old-style generator (function, not module)
      vi.mocked(generatorRegistry.get).mockReturnValue(vi.fn() as any);

      await expect(
        command.execute(ProjectType.REACT, mockPackageManager, {} as any)
      ).rejects.toThrow('No generator found for project type: REACT');
    });
  });

  describe('package name resolution', () => {
    it('should construct correct package names for Vite builder', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
          framework: undefined,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(CoreBuilder.Vite);

      const result = await command.execute(ProjectType.VUE3, mockPackageManager, {} as any);

      expect(result.frameworkPackage).toBe('@storybook/vue3-vite');
      expect(result.rendererPackage).toBe('@storybook/vue3');
      expect(result.builderPackage).toBe('@storybook/builder-vite');
    });

    it('should construct correct package names for Webpack5 builder', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
          framework: undefined,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(CoreBuilder.Webpack5);

      const result = await command.execute(ProjectType.VUE3, mockPackageManager, {} as any);

      expect(result.frameworkPackage).toBe('@storybook/vue3-webpack5');
      expect(result.rendererPackage).toBe('@storybook/vue3');
      expect(result.builderPackage).toBe('@storybook/builder-webpack5');
    });
  });
});
