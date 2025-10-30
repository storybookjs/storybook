import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, detectBuilder } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

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

      // When no framework is specified, it's inferred from renderer + builder
      expect(result).toEqual({
        framework: SupportedFramework.REACT_VITE,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.VITE,
      });

      expect(detectBuilder).toHaveBeenCalledWith(mockPackageManager);
    });

    it('should use CLI builder option if provided', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT,
          renderer: SupportedRenderer.REACT,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.REACT, mockPackageManager, {
        builder: SupportedBuilder.WEBPACK5,
      } as any);

      expect(result.builder).toBe(SupportedBuilder.WEBPACK5);
      expect(result.framework).toBe(SupportedFramework.REACT_WEBPACK5);
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle framework with specific framework package', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.SVELTEKIT,
          renderer: SupportedRenderer.SVELTE,
          framework: SupportedFramework.SVELTEKIT,
          builderOverride: SupportedBuilder.VITE,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.SVELTEKIT, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.SVELTEKIT,
        renderer: SupportedRenderer.SVELTE,
        builder: SupportedBuilder.VITE,
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
      ).rejects.toThrow('Cannot read properties of undefined');
    });

    it('should handle dynamic framework selection based on builder (Vite)', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: (builder: SupportedBuilder) =>
            builder === SupportedBuilder.VITE
              ? SupportedFramework.NEXTJS_VITE
              : SupportedFramework.NEXTJS,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(SupportedBuilder.VITE);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS_VITE,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.VITE,
      });
      expect(detectBuilder).toHaveBeenCalledWith(mockPackageManager);
    });

    it('should handle dynamic framework selection based on builder (Webpack5)', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: (builder: SupportedBuilder) =>
            builder === SupportedBuilder.VITE
              ? SupportedFramework.NEXTJS_VITE
              : SupportedFramework.NEXTJS,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);
      vi.mocked(detectBuilder).mockResolvedValue(SupportedBuilder.WEBPACK5);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.WEBPACK5,
      });
    });

    it('should handle dynamic framework with CLI builder option', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: (builder: SupportedBuilder) =>
            builder === SupportedBuilder.VITE
              ? SupportedFramework.NEXTJS_VITE
              : SupportedFramework.NEXTJS,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {
        builder: SupportedBuilder.VITE,
      } as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS_VITE,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.VITE,
      });
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle async builderOverride function', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: SupportedFramework.NEXTJS,
          builderOverride: async () => {
            // Simulate some async detection logic
            return SupportedBuilder.WEBPACK5;
          },
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.WEBPACK5,
      });
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle sync builderOverride function', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: SupportedFramework.NEXTJS,
          builderOverride: () => SupportedBuilder.VITE,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.VITE,
      });
      expect(detectBuilder).not.toHaveBeenCalled();
    });

    it('should handle dynamic framework with async builderOverride', async () => {
      const mockGenerator: GeneratorModule = {
        metadata: {
          projectType: ProjectType.NEXTJS,
          renderer: SupportedRenderer.REACT,
          framework: (builder: SupportedBuilder) =>
            builder === SupportedBuilder.VITE
              ? SupportedFramework.NEXTJS_VITE
              : SupportedFramework.NEXTJS,
          builderOverride: async () => SupportedBuilder.VITE,
        },
        configure: vi.fn(),
      };

      vi.mocked(generatorRegistry.get).mockReturnValue(mockGenerator);

      const result = await command.execute(ProjectType.NEXTJS, mockPackageManager, {} as any);

      expect(result).toEqual({
        framework: SupportedFramework.NEXTJS_VITE,
        renderer: SupportedRenderer.REACT,
        builder: SupportedBuilder.VITE,
      });
      expect(detectBuilder).not.toHaveBeenCalled();
    });
  });
});
