import { existsSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { Channel } from 'storybook/internal/channels';
import { getProjectRoot } from 'storybook/internal/common';
import type { Options, Presets } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { loadConfigFromFile } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin.ts';
import type { BuilderOptions } from './types.ts';
import { commonConfig, resolveVitePublicDir } from './vite-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('vite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vite')>()),
  loadConfigFromFile: vi.fn(async () => ({})),
  defaultClientConditions: undefined,
}));
const loadConfigFromFileMock = vi.mocked(loadConfigFromFile);

vi.mock('empathic/find', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const { loggerWarnMock } = vi.hoisted(() => ({ loggerWarnMock: vi.fn() }));
vi.mock('storybook/internal/node-logger', () => ({
  // `once` passes straight through to the warn mock; deduping is node-logger's own tested behavior.
  once: () => (message: string) => loggerWarnMock(message),
  logger: { warn: loggerWarnMock, error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

const dummyOptions: Options = {
  configType: 'DEVELOPMENT',
  configDir: '',
  packageJson: {},
  channel: new Channel({}),
  presets: {
    apply: async (key: string) =>
      ({
        framework: {
          name: '',
        },
        addons: [],
        core: {
          builder: {},
        },
        options: {},
      })[key],
  } as Presets,
  presetsList: [],
};

const presetsWith = (builderOptions: BuilderOptions): Presets =>
  ({
    apply: async (key: string) =>
      ({
        framework: { name: '' },
        addons: [],
        core: {
          builder: {
            name: '@storybook/builder-vite',
            options: builderOptions,
          },
        },
        options: {},
      })[key],
  }) as Presets;

const mockExistsSync = async (pathToMock: string, exists: boolean) => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');

  vi.mocked(existsSync).mockImplementation((path) => {
    if (path === resolve(pathToMock)) {
      return exists;
    }

    return actual.existsSync(path);
  });
};

afterEach(() => {
  vi.mocked(existsSync).mockReset();
  loadConfigFromFileMock.mockReset();
  loggerWarnMock.mockClear();
  vi.mocked(find.any).mockReset();
  vi.mocked(getProjectRoot).mockReset();
});

describe('commonConfig', () => {
  it('should set configFile to false and include plugins', async () => {
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: {},
        path: '',
        dependencies: [],
      })
    );
    const config = await commonConfig(dummyOptions, 'development');
    expect(config.configFile).toBe(false);
    expect(config.plugins).toBeDefined();
  });

  it('should pass configLoader option to loadConfigFromFile', async () => {
    const optionsWithConfigLoader: Options = {
      ...dummyOptions,
      presets: presetsWith({ configLoader: 'native' }),
    };

    // Inline mock: this test asserts a specific call signature, so it needs its
    // own one-shot return value distinct from the shared default mock.
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: {},
        path: '',
        dependencies: [],
      })
    );

    await commonConfig(optionsWithConfigLoader, 'development');

    // Verify loadConfigFromFile was called with configLoader as the 6th argument
    expect(loadConfigFromFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'serve' }),
      undefined,
      expect.any(String),
      undefined,
      undefined,
      'native'
    );
  });
});

describe('storybookConfigPlugin', () => {
  it('should set default envPrefix when no user envPrefix is set', async () => {
    const plugins = storybookConfigPlugin({ configDir: '/test/.storybook' });
    const configPlugin = plugins.find((p) => p.name === 'storybook:config-plugin')!;

    // The config hook receives the current Vite config and returns partial config to merge
    const result = await (configPlugin.config as Function)({}, {});
    expect(result.envPrefix).toStrictEqual(['VITE_', 'STORYBOOK_']);
  });

  it('should include storybook resolve conditions', async () => {
    const plugins = storybookConfigPlugin({ configDir: '/test/.storybook' });
    const configPlugin = plugins.find((p) => p.name === 'storybook:config-plugin')!;

    const result = await (configPlugin.config as Function)({}, {});
    expect(result.resolve.conditions).toContain('storybook');
    expect(result.resolve.conditions).toContain('stories');
    expect(result.resolve.conditions).toContain('test');
  });

  it('should not set base when not provided', async () => {
    const plugins = storybookConfigPlugin({ configDir: '/test/.storybook' });
    const configPlugin = plugins.find((p) => p.name === 'storybook:config-plugin')!;

    const result = await (configPlugin.config as Function)({}, {});
    expect(result.base).toBeUndefined();
  });

  it('should allow storybook dir when server fs allow list exists', () => {
    const plugins = storybookConfigPlugin({ configDir: '/test/.storybook' });
    const allowPlugin = plugins.find((p) => p.name === 'storybook:allow-storybook-dir')!;

    const config = { server: { fs: { allow: ['/some/path'] } } };
    (allowPlugin.config as Function)(config);
    expect(config.server.fs.allow).toContain('/test/.storybook');
  });
});

describe('resolveVitePublicDir', () => {
  const options: Options = { ...dummyOptions, configDir: '/project/.storybook' };
  const mockUserConfig = (config: Record<string, unknown>) =>
    loadConfigFromFileMock.mockResolvedValueOnce({ config, path: '', dependencies: [] });

  it('defaults to the public directory next to the Storybook config dir', async () => {
    await mockExistsSync('/project/public', true);
    mockUserConfig({});

    expect(await resolveVitePublicDir(options, 'build')).toBe(resolve('/project/public'));
  });

  it('resolves a custom publicDir relative to the project root', async () => {
    await mockExistsSync('/project/assets/static', true);
    mockUserConfig({ publicDir: 'assets/static' });

    expect(await resolveVitePublicDir(options, 'build')).toBe(resolve('/project/assets/static'));
  });

  it('returns undefined when publicDir is disabled', async () => {
    await mockExistsSync('/project/public', true);
    mockUserConfig({ publicDir: false });

    expect(await resolveVitePublicDir(options, 'build')).toBeUndefined();
  });

  it('returns undefined when the public directory does not exist', async () => {
    await mockExistsSync('/project/public', false);
    mockUserConfig({});

    expect(await resolveVitePublicDir(options, 'build')).toBeUndefined();
  });
});

describe('discovery miss reporting', () => {
  it('warns when configDir is nested and the Vite config sits at the project root', async () => {
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vi.mocked(find.any).mockReturnValueOnce(resolve('/project/vite.config.mjs'));
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(
      { ...dummyOptions, configDir: '/project/configuration/storybook' },
      'development'
    );

    expect(vi.mocked(find.any)).toHaveBeenCalledWith(expect.anything(), {
      cwd: resolve('/project/configuration'),
      last: '/project',
    });
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock.mock.calls[0][0]).toContain('/project/vite.config.mjs');
    expect(loggerWarnMock.mock.calls[0][0]).toContain(
      "core: { builder: { options: { viteConfigPath: '/project/vite.config.mjs' } } }"
    );
  });

  it('stays quiet when no Vite config exists in the project at all', async () => {
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vi.mocked(find.any).mockReturnValueOnce(undefined);
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig({ ...dummyOptions, configDir: '/project/.storybook' }, 'development');

    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('stays quiet when discovery loads a config in the standard layout', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({ config: {}, path: '', dependencies: [] });

    await commonConfig({ ...dummyOptions, configDir: '/project/.storybook' }, 'development');

    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('stays quiet when an explicit viteConfigPath resolves to nothing', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(
      {
        ...dummyOptions,
        configDir: '/project/.storybook',
        presets: presetsWith({ viteConfigPath: '/custom/vite.config.ts' }),
      },
      'development'
    );

    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
});
