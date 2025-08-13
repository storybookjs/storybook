import { vi, expect, describe, it, beforeEach } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { BuilderContext } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { getBuilderOptions } from './framework-preset-angular-cli';
import type { PresetOptions } from './preset-options';

// Mock all dependencies
vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('storybook/internal/server-errors', () => ({
  AngularLegacyBuildOptionsError: class AngularLegacyBuildOptionsError extends Error {
    constructor() {
      super('AngularLegacyBuildOptionsError');
      this.name = 'AngularLegacyBuildOptionsError';
    }
  },
}));

vi.mock('storybook/internal/common', () => ({
  getProjectRoot: vi.fn(),
}));

vi.mock('@storybook/builder-webpack5', () => ({}));

vi.mock('@angular-devkit/architect', () => ({
  targetFromTargetString: vi.fn(),
}));

vi.mock('find-up', () => ({
  findUp: vi.fn(),
}));

vi.mock('./utils/module-is-available', () => ({
  moduleIsAvailable: vi.fn(),
}));

vi.mock('./angular-cli-webpack', () => ({
  getWebpackConfig: vi.fn(),
}));

vi.mock('./preset-options', () => ({
  PresetOptions: {},
}));

// Mock require.resolve for @angular/animations
vi.mock('@angular/animations', () => ({}));

const mockedLogger = vi.mocked(logger);

const mockedTargetFromTargetString = vi.mocked(
  await import('@angular-devkit/architect')
).targetFromTargetString;
const mockedFindUp = vi.mocked(await import('find-up')).findUp;
const mockedGetProjectRoot = vi.mocked(await import('storybook/internal/common')).getProjectRoot;

describe('framework-preset-angular-cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBuilderOptions', () => {
    const mockBuilderContext: BuilderContext = {
      target: { project: 'test-project', builder: 'test-builder', options: {} },
      workspaceRoot: '/test/workspace',
      getProjectMetadata: vi.fn().mockResolvedValue({}),
      getTargetOptions: vi.fn().mockResolvedValue({}),
      logger: new logging.Logger('Test'),
    } as unknown as BuilderContext;

    beforeEach(() => {
      mockedGetProjectRoot.mockReturnValue('/test/project');
      mockedFindUp.mockResolvedValue('/test/tsconfig.json');
    });

    it('should get browser target options when angularBrowserTarget is provided', async () => {
      const mockTarget = { project: 'test-project', target: 'build', configuration: 'development' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build:development',
      };

      await getBuilderOptions(options, mockBuilderContext);

      expect(mockedTargetFromTargetString).toHaveBeenCalledWith('test-project:build:development');
      expect(mockedLogger.info).toHaveBeenCalledWith(
        '=> Using angular browser target options from "test-project:build:development"'
      );
      expect(mockBuilderContext.getTargetOptions).toHaveBeenCalledWith(mockTarget);
    });

    it('should merge browser target options with storybook options', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const browserTargetOptions = { a: 1, nested: { x: 10 } };
      const storybookOptions = { b: 2, nested: { y: 20 } };

      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        angularBuilderOptions: storybookOptions,
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result).toEqual({
        a: 1,
        b: 2,
        nested: { x: 10, y: 20 },
        tsConfig: '/test/tsconfig.json',
      });
    });

    it('should use provided tsConfig when available', async () => {
      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        tsConfig: '/custom/tsconfig.json',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result.tsConfig).toBe('/custom/tsconfig.json');
      expect(mockedLogger.info).toHaveBeenCalledWith(
        '=> Using angular project with "tsConfig:/custom/tsconfig.json"'
      );
    });

    it('should find tsconfig.json when not provided', async () => {
      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedFindUp).toHaveBeenCalledWith('tsconfig.json', {
        cwd: '/test/config',
        stopAt: '/test/project',
      });
      expect(result.tsConfig).toBe('/test/tsconfig.json');
    });

    it('should use browser target tsConfig when no other tsConfig is available', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);
      mockedFindUp.mockResolvedValue(null);

      const browserTargetOptions = { tsConfig: '/browser/tsconfig.json' };
      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result.tsConfig).toBe('/browser/tsconfig.json');
    });

    it('should handle case when no angularBrowserTarget is provided', async () => {
      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedTargetFromTargetString).not.toHaveBeenCalled();
      expect(mockBuilderContext.getTargetOptions).not.toHaveBeenCalled();
      expect(result).toEqual({
        tsConfig: '/test/tsconfig.json',
      });
    });

    it('should handle browser target without configuration', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        '=> Using angular browser target options from "test-project:build"'
      );
    });

    it('should handle browser target with configuration', async () => {
      const mockTarget = { project: 'test-project', target: 'build', configuration: 'production' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build:production',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        '=> Using angular browser target options from "test-project:build:production"'
      );
    });

    it('should handle empty angularBuilderOptions', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const browserTargetOptions = { a: 1, b: 2 };
      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        angularBuilderOptions: {},
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result).toEqual({
        a: 1,
        b: 2,
        tsConfig: '/test/tsconfig.json',
      });
    });

    it('should handle undefined angularBuilderOptions', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const browserTargetOptions = { a: 1, b: 2 };
      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result).toEqual({
        a: 1,
        b: 2,
        tsConfig: '/test/tsconfig.json',
      });
    });
  });
});
