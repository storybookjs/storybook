import { vi, expect, describe, it, beforeEach } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { BuilderContext } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { getBuilderOptions, webpackFinal } from './framework-preset-angular-cli.ts';
import type { PresetOptions } from './preset-options.ts';
import { Channel } from 'storybook/internal/channels';

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
  resolvePackageDir: vi.fn(() => '/test/node_modules/pkg'),
}));

vi.mock('@storybook/builder-webpack5', () => ({
  WebpackDefinePlugin: class WebpackDefinePlugin {
    constructor(public definitions: Record<string, unknown>) {}
  },
  WebpackIgnorePlugin: class WebpackIgnorePlugin {
    constructor(public options: unknown) {}
  },
}));

vi.mock('@angular-devkit/architect', () => ({
  targetFromTargetString: vi.fn(),
}));

vi.mock('empathic/find', () => ({ up: vi.fn() }));

vi.mock('./utils/module-is-available', () => ({
  moduleIsAvailable: vi.fn(),
}));

vi.mock('./angular-cli-webpack.js', () => ({
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
const mockedFindUp = vi.mocked(await import('empathic/find')).up;
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
      mockedFindUp.mockReturnValue('/test/tsconfig.json');
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
        channel: new Channel({}),
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

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        angularBuilderOptions: storybookOptions,
        channel: new Channel({}),
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
        channel: new Channel({}),
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(result.tsConfig).toBe('/custom/tsconfig.json');
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular project with "tsConfig:../../custom/tsconfig.json"'
      );
    });

    it('should find tsconfig.json when not provided', async () => {
      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        channel: new Channel({}),
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

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        channel: new Channel({}),
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
        channel: new Channel({}),
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

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        channel: new Channel({}),
      };

      const result = await getBuilderOptions(options, mockBuilderContext);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Using angular browser target options from "test-project:build"'
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
        channel: new Channel({}),
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

      const options: PresetOptions = {
        configType: 'DEVELOPMENT',
        configDir: '/test/config',
        presets: {
          apply: vi.fn(),
        } as any,
        angularBrowserTarget: 'test-project:build',
        angularBuilderOptions: {},
        channel: new Channel({}),
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
        channel: new Channel({}),
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

describe('webpackFinal ngDevMode define', () => {
  const definesFor = async (extra: Partial<PresetOptions> & { enableProdMode?: boolean }) => {
    const { getWebpackConfig } = await import('./angular-cli-webpack.js');
    vi.mocked(getWebpackConfig).mockResolvedValue({ plugins: [] } as any);
    mockedGetProjectRoot.mockReturnValue('/test/project');
    mockedFindUp.mockReturnValue('/test/tsconfig.json');

    const config = await webpackFinal({}, {
      configDir: '/test/config',
      // Undefined here means the legacy setup, which throws instead.
      angularBrowserTarget: null,
      presets: { apply: vi.fn() } as any,
      channel: new Channel({}),
      ...extra,
    } as PresetOptions);

    const plugin = config.plugins?.find(
      (p: any) => p?.constructor?.name === 'WebpackDefinePlugin'
    ) as any;
    return plugin?.definitions ?? {};
  };

  it('defines ngDevMode as false in a production build', async () => {
    // Core always fills `build.test`, so a fixture without it would not
    // match what this preset really receives.
    const defines = await definesFor({
      configType: 'PRODUCTION',
      build: { test: {} },
      enableProdMode: true,
    });
    expect(defines.ngDevMode).toBe('false');
  });

  it('leaves ngDevMode undefined when enableProdMode is false', async () => {
    // enableProdMode false keeps Angular's dev checks on in a built Storybook,
    // so the define must not fold them away.
    const defines = await definesFor({
      configType: 'PRODUCTION',
      build: { test: {} },
      enableProdMode: false,
    });
    expect(defines).not.toHaveProperty('ngDevMode');
  });

  it('leaves ngDevMode undefined when enableProdMode is not set', async () => {
    const defines = await definesFor({ configType: 'PRODUCTION', build: { test: {} } });
    expect(defines).not.toHaveProperty('ngDevMode');
  });

  it('leaves ngDevMode undefined in a test build, which still runs Angular dev checks', async () => {
    const defines = await definesFor({
      configType: 'PRODUCTION',
      test: true,
      build: { test: { disableDocgen: true } },
      enableProdMode: true,
    });
    expect(defines).not.toHaveProperty('ngDevMode');
  });

  it('leaves ngDevMode undefined in a development build', async () => {
    const defines = await definesFor({
      configType: 'DEVELOPMENT',
      build: { test: {} },
      enableProdMode: true,
    });
    expect(defines).not.toHaveProperty('ngDevMode');
  });
});
