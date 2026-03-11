import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import * as find from 'empathic/find';

import { FrameworkDetectionService } from './FrameworkDetectionService';

vi.mock('empathic/find', () => ({
  any: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getProjectRoot: vi.fn(() => '/project/root'),
  };
});

vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    select: vi.fn(),
  },
}));

describe('FrameworkDetectionService', () => {
  let service: FrameworkDetectionService;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPackageManager = {
      getAllDependencies: vi.fn(() => ({})),
    } as unknown as JsPackageManager;
    service = new FrameworkDetectionService(mockPackageManager);
  });

  describe('detectFramework', () => {
    it('should return renderer directly if it is a valid framework', () => {
      const result = service.detectFramework(
        SupportedRenderer.REACT as SupportedRenderer,
        SupportedBuilder.VITE
      );
      expect(result).toBe(SupportedFramework.REACT_VITE);
    });

    it('should combine renderer and builder when renderer is not a framework', () => {
      const result = service.detectFramework(
        SupportedRenderer.REACT as SupportedRenderer,
        SupportedBuilder.VITE
      );
      expect(result).toBe(SupportedFramework.REACT_VITE);
    });

    it('should return react-webpack5 framework for react renderer with webpack5 builder', () => {
      const result = service.detectFramework(
        SupportedRenderer.REACT as SupportedRenderer,
        SupportedBuilder.WEBPACK5
      );
      expect(result).toBe(SupportedFramework.REACT_WEBPACK5);
    });

    it('should return react-vite framework for react renderer with vite builder', () => {
      const result = service.detectFramework(
        SupportedRenderer.REACT as SupportedRenderer,
        SupportedBuilder.VITE
      );
      expect(result).toBe(SupportedFramework.REACT_VITE);
    });

    it('should return vue3-vite framework for vue3 renderer with vite builder', () => {
      const result = service.detectFramework(
        SupportedRenderer.VUE3 as SupportedRenderer,
        SupportedBuilder.VITE
      );
      expect(result).toBe(SupportedFramework.VUE3_VITE);
    });

    it('should return react-rsbuild framework for react renderer with rsbuild builder', () => {
      const result = service.detectFramework(
        SupportedRenderer.REACT as SupportedRenderer,
        SupportedBuilder.RSBUILD
      );
      expect(result).toBe(SupportedFramework.REACT_RSBUILD);
    });

    it('should throw error for invalid renderer and builder combination', () => {
      const invalidRenderer = 'invalid-renderer' as SupportedRenderer;
      const invalidBuilder = SupportedBuilder.VITE;

      expect(() => {
        service.detectFramework(invalidRenderer, invalidBuilder);
      }).toThrow('Could not find framework for renderer: invalid-renderer and builder: vite');
    });
  });

  describe('detectBuilder', () => {
    it('should detect vite builder from config file', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        if (files.includes('vite.config.ts')) {
          return 'vite.config.ts';
        }
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.VITE);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect vite builder from dependencies', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        vite: '^5.0.0',
      });

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.VITE);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect webpack5 builder from config file', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        if (files.includes('webpack.config.js')) {
          return 'webpack.config.js';
        }
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.WEBPACK5);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect webpack5 builder from dependencies', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        webpack: '^5.0.0',
      });

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.WEBPACK5);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect rsbuild builder from config file', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        if (files.includes('rsbuild.config.ts')) {
          return 'rsbuild.config.ts';
        }
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.RSBUILD);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect rsbuild builder from dependencies', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@rsbuild/core': '^1.0.0',
      });

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.RSBUILD);
      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should detect both config file and dependency, then prompt user', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        // Check if this is the vite config files array (has vite.config.ts)
        if (files.includes('vite.config.ts')) {
          return 'vite.config.ts';
        }
        // For webpack and rsbuild config files, return undefined
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        webpack: '^5.0.0',
      });
      vi.mocked(prompt.select).mockResolvedValue(SupportedBuilder.VITE);

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.VITE);
      expect(prompt.select).toHaveBeenCalledWith({
        message: expect.stringContaining('Multiple builders were detected'),
        options: [
          { label: 'Vite', value: SupportedBuilder.VITE },
          { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
          { label: 'Rsbuild', value: SupportedBuilder.RSBUILD },
        ],
      });
    });

    it('should prompt user when multiple builders are detected', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        if (files.includes('vite.config.ts')) {
          return 'vite.config.ts';
        }
        if (files.includes('webpack.config.js')) {
          return 'webpack.config.js';
        }
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(prompt.select).mockResolvedValue(SupportedBuilder.VITE);

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.VITE);
      expect(prompt.select).toHaveBeenCalledWith({
        message: expect.stringContaining('Multiple builders were detected'),
        options: [
          { label: 'Vite', value: SupportedBuilder.VITE },
          { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
          { label: 'Rsbuild', value: SupportedBuilder.RSBUILD },
        ],
      });
    });

    it('should prompt user when no builders are detected', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(prompt.select).mockResolvedValue(SupportedBuilder.VITE);

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.VITE);
      expect(prompt.select).toHaveBeenCalledWith({
        message: expect.stringContaining('We were not able to detect the right builder'),
        options: [
          { label: 'Vite', value: SupportedBuilder.VITE },
          { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
          { label: 'Rsbuild', value: SupportedBuilder.RSBUILD },
        ],
      });
    });

    it('should detect multiple builders from dependencies', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        vite: '^5.0.0',
        webpack: '^5.0.0',
      });
      vi.mocked(prompt.select).mockResolvedValue(SupportedBuilder.WEBPACK5);

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.WEBPACK5);
      expect(prompt.select).toHaveBeenCalled();
    });

    it('should detect all three builders when all are present', async () => {
      vi.mocked(find.any).mockImplementation((files: string[]) => {
        if (files.includes('vite.config.ts')) {
          return 'vite.config.ts';
        }
        if (files.includes('webpack.config.js')) {
          return 'webpack.config.js';
        }
        if (files.includes('rsbuild.config.ts')) {
          return 'rsbuild.config.ts';
        }
        return undefined;
      });
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(prompt.select).mockResolvedValue(SupportedBuilder.RSBUILD);

      const result = await service.detectBuilder();

      expect(result).toBe(SupportedBuilder.RSBUILD);
      expect(prompt.select).toHaveBeenCalled();
    });

    it('should check all vite config file variants', async () => {
      const viteConfigs = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
      for (const config of viteConfigs) {
        vi.mocked(find.any).mockImplementation((files: string[]) => {
          if (files.includes(config)) {
            return config;
          }
          return undefined;
        });
        vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});

        const result = await service.detectBuilder();

        expect(result).toBe(SupportedBuilder.VITE);
        vi.clearAllMocks();
      }
    });

    it('should check all rsbuild config file variants', async () => {
      const rsbuildConfigs = ['rsbuild.config.ts', 'rsbuild.config.js', 'rsbuild.config.mjs'];
      for (const config of rsbuildConfigs) {
        vi.mocked(find.any).mockImplementation((files: string[]) => {
          if (files.includes(config)) {
            return config;
          }
          return undefined;
        });
        vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});

        const result = await service.detectBuilder();

        expect(result).toBe(SupportedBuilder.RSBUILD);
        vi.clearAllMocks();
      }
    });
  });
});
