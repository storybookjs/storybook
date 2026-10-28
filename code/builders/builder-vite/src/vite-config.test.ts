import { existsSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { Channel } from '@storybook/core/internal/channels';
import { getProjectRoot } from '@storybook/core/internal/common';
import type { Storybook } from '@storybook/core';
import {
  VITE_PREVIEW_MODULE_IDS,
  type PreviewSources,
} from '@storybook/core/internal/preview-page';

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
vi.mock('@storybook/core/internal/common', { spy: true });

const { loggerWarnMock } = vi.hoisted(() => ({ loggerWarnMock: vi.fn() }));
vi.mock('@storybook/core/internal/node-logger', () => ({
  // `once` passes straight through to the warn mock; deduping is node-logger's own tested behavior.
  once: () => (message: string) => loggerWarnMock(message),
  logger: { warn: loggerWarnMock, error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

const PREVIEW = {
  modules: { entry: '', projectAnnotations: '', addonSetup: '' },
  virtualModuleIds: VITE_PREVIEW_MODULE_IDS,
  externals: {},
  define: () => ({}),
  previewAnnotations: [],
  previewConfigPath: undefined,
  previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
} as unknown as PreviewSources;

const fakeStorybook = (configDir = '', framework?: unknown): Storybook =>
  ({
    configDir,
    channel: new Channel({}),
    options: { configType: 'DEVELOPMENT' },
    callHook: async (name: string, value: unknown) =>
      name === 'core:framework:extend' ? framework : value,
  }) as unknown as Storybook;

const input = (options: BuilderOptions = {}) => ({ preview: PREVIEW, options });

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
    const config = await commonConfig(fakeStorybook(), input(), 'development');
    expect(config.configFile).toBe(false);
    expect(config.plugins).toBeDefined();
  });

  it('should pass configLoader option to loadConfigFromFile', async () => {
    // Inline mock: this test asserts a specific call signature, so it needs its
    // own one-shot return value distinct from the shared default mock.
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: {},
        path: '',
        dependencies: [],
      })
    );

    await commonConfig(fakeStorybook(), input({ configLoader: 'native' }), 'development');

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

describe('builder options', () => {
  it('prefers the legacy framework builder options over the factory options', async () => {
    await commonConfig(
      fakeStorybook('', { name: 'framework', options: { builder: { viteConfigPath: null } } }),
      input({ viteConfigPath: '/ignored/vite.config.ts' }),
      'development'
    );

    expect(loadConfigFromFileMock).not.toHaveBeenCalled();
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
  const storybook = fakeStorybook('/project/.storybook');
  const mockUserConfig = (config: Record<string, unknown>) =>
    loadConfigFromFileMock.mockResolvedValueOnce({ config, path: '', dependencies: [] });

  it('defaults to the public directory next to the Storybook config dir', async () => {
    await mockExistsSync('/project/public', true);
    mockUserConfig({});

    expect(await resolveVitePublicDir(storybook, {})).toBe(resolve('/project/public'));
  });

  it('resolves a custom publicDir relative to the project root', async () => {
    await mockExistsSync('/project/assets/static', true);
    mockUserConfig({ publicDir: 'assets/static' });

    expect(await resolveVitePublicDir(storybook, {})).toBe(resolve('/project/assets/static'));
  });

  it('returns undefined when publicDir is disabled', async () => {
    await mockExistsSync('/project/public', true);
    mockUserConfig({ publicDir: false });

    expect(await resolveVitePublicDir(storybook, {})).toBeUndefined();
  });

  it('returns undefined when the public directory does not exist', async () => {
    await mockExistsSync('/project/public', false);
    mockUserConfig({});

    expect(await resolveVitePublicDir(storybook, {})).toBeUndefined();
  });
});

describe('discovery miss reporting', () => {
  it('warns when configDir is nested and the Vite config sits at the project root', async () => {
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vi.mocked(find.any).mockReturnValueOnce(resolve('/project/vite.config.mjs'));
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(fakeStorybook('/project/configuration/storybook'), input(), 'development');

    expect(vi.mocked(find.any)).toHaveBeenCalledWith(expect.anything(), {
      cwd: resolve('/project/configuration'),
      last: '/project',
    });
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock.mock.calls[0][0]).toContain('/project/vite.config.mjs');
    expect(loggerWarnMock.mock.calls[0][0]).toContain(
      "core: { builder: { options: { viteConfigPath: '/project/vite.config.mjs' } } }"
    );
    expect(loggerWarnMock.mock.calls[0][0]).toContain('viteConfigPath: null');
  });

  it('stays quiet when no Vite config exists in the project at all', async () => {
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vi.mocked(find.any).mockReturnValueOnce(undefined);
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(fakeStorybook('/project/.storybook'), input(), 'development');

    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('stays quiet when discovery loads a config in the standard layout', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({ config: {}, path: '', dependencies: [] });

    await commonConfig(fakeStorybook('/project/.storybook'), input(), 'development');

    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('stays quiet when an explicit viteConfigPath resolves to nothing', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(
      fakeStorybook('/project/.storybook'),
      input({ viteConfigPath: '/custom/vite.config.ts' }),
      'development'
    );

    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('loads nothing and stays quiet when viteConfigPath is explicitly null', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(
      fakeStorybook('/project/.storybook'),
      input({ viteConfigPath: null }),
      'development'
    );

    expect(loadConfigFromFileMock).not.toHaveBeenCalled();
    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('stays quiet when the config dir sits outside the project root', async () => {
    // The search is bounded by `last: getProjectRoot()`; when the config dir's parent is not
    // inside the project root the search would run to the filesystem root, so no warning is made.
    vi.mocked(getProjectRoot).mockReturnValue('/workspace');
    loadConfigFromFileMock.mockResolvedValueOnce(null);

    await commonConfig(fakeStorybook('/project/.storybook'), input(), 'development');

    expect(vi.mocked(find.any)).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
});
