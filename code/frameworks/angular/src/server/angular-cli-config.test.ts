import { vi, expect, describe, it, beforeEach } from 'vitest';

import { logger } from '@storybook/core/internal/node-logger';

import type { BuilderContext } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { getBuilderOptions } from './angular-cli-config.ts';
import type { AngularCliOptions } from './angular-cli-options.ts';

// Mock all dependencies
vi.mock('@storybook/core/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@storybook/core/internal/server-errors', () => ({
  AngularLegacyBuildOptionsError: class AngularLegacyBuildOptionsError extends Error {
    constructor() {
      super('AngularLegacyBuildOptionsError');
      this.name = 'AngularLegacyBuildOptionsError';
    }
  },
}));

vi.mock('@storybook/core/internal/common', () => ({
  getProjectRoot: vi.fn(),
}));

vi.mock('@storybook/builder-webpack5', () => ({}));

vi.mock('@angular-devkit/architect', () => ({
  targetFromTargetString: vi.fn(),
}));

vi.mock('empathic/find', () => ({ up: vi.fn() }));

vi.mock('./utils/module-is-available', () => ({
  moduleIsAvailable: vi.fn(),
}));

vi.mock('./angular-cli-webpack', () => ({
  getWebpackConfig: vi.fn(),
}));

// Mock require.resolve for @angular/animations
vi.mock('@angular/animations', () => ({}));

const mockedLogger = vi.mocked(logger);

const mockedTargetFromTargetString = vi.mocked(
  await import('@angular-devkit/architect')
).targetFromTargetString;
const mockedFindUp = vi.mocked(await import('empathic/find')).up;
const mockedGetProjectRoot = vi.mocked(
  await import('@storybook/core/internal/common')
).getProjectRoot;

describe('angular-cli-config', () => {
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
      mockedFindUp.mockReturnValue('/test/tsconfig.json');
    });

    it('should get browser target options when angularBrowserTarget is provided', async () => {
      const mockTarget = { project: 'test-project', target: 'build', configuration: 'development' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        angularBrowserTarget: 'test-project:build:development',
      };

      await getBuilderOptions(options, mockBuilderContext);

      expect(mockedTargetFromTargetString).toHaveBeenCalledWith('test-project:build:development');
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular browser target options from "test-project:build:development"'
      );
      expect(mockBuilderContext.getTargetOptions).toHaveBeenCalledWith(mockTarget);
    });

    it('should merge browser target options with storybook options', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const browserTargetOptions = { a: 1, nested: { x: 10 } };
      const storybookOptions = { b: 2, nested: { y: 20 } };

      vi.mocked(mockBuilderContext.getTargetOptions)
        .mockResolvedValueOnce(browserTargetOptions)
        .mockResolvedValueOnce(storybookOptions);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
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
      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        tsConfig: '/custom/tsconfig.json',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result.tsConfig).toBe('/custom/tsconfig.json');
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular project with "tsConfig:../../custom/tsconfig.json"'
      );
    });

    it('should find tsconfig.json when not provided', async () => {
      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedFindUp).toHaveBeenCalledWith('tsconfig.json', {
        cwd: '/test/config',
        last: '/test/project',
      });
      expect(result.tsConfig).toBe('/test/tsconfig.json');
    });

    it('should use browser target tsConfig when no other tsConfig is available', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);
      mockedFindUp.mockReturnValue(undefined);

      const browserTargetOptions = { tsConfig: '/browser/tsconfig.json' };
      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        angularBrowserTarget: 'test-project:build',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result.tsConfig).toBe('/browser/tsconfig.json');
    });

    it('should handle case when no angularBrowserTarget is provided', async () => {
      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedTargetFromTargetString).not.toHaveBeenCalled();
      expect(mockBuilderContext.getTargetOptions).toHaveBeenCalledOnce();
      expect(result).toEqual({
        tsConfig: '/test/tsconfig.json',
      });
    });

    it('should handle browser target without configuration', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        angularBrowserTarget: 'test-project:build',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular browser target options from "test-project:build"'
      );
    });

    it('should handle browser target with configuration', async () => {
      const mockTarget = { project: 'test-project', target: 'build', configuration: 'production' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        angularBrowserTarget: 'test-project:build:production',
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular browser target options from "test-project:build:production"'
      );
    });

    it('should handle empty angularBuilderOptions', async () => {
      const mockTarget = { project: 'test-project', target: 'build' };
      mockedTargetFromTargetString.mockReturnValue(mockTarget);

      const browserTargetOptions = { a: 1, b: 2 };
      vi.mocked(mockBuilderContext.getTargetOptions).mockResolvedValue(browserTargetOptions);

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
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

      const options: AngularCliOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
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
