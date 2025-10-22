import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, detectBuilder } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

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
          renderer: SupportedRenderer.REACT,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(SupportedBuilder.VITE);

      const result = await command.execute(ProjectType.REACT, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: undefined,
        renderer: 'react',
        builder: SupportedBuilder.VITE,
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
          renderer: SupportedRenderer.VUE3,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.VUE3, mockPackageManager, {
        builder: SupportedBuilder.WEBPACK5,
      } as any);

      expect(result.builder).toBe(SupportedBuilder.WEBPACK5);
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle framework with specific framework package', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.SVELTEKIT,
          renderer: SupportedRenderer.SVELTE,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.SVELTEKIT, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: 'sveltekit',
        renderer: 'svelte',
        builder: SupportedBuilder.VITE,
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
});
