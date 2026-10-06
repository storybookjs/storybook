import { existsSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { Channel } from 'storybook/internal/channels';
import type { Options, Presets } from 'storybook/internal/types';

import { loadConfigFromFile } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin.ts';
import { commonConfig, resolveVitePublicDir } from './vite-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('vite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vite')>()),
  loadConfigFromFile: vi.fn(async () => ({})),
  defaultClientConditions: undefined,
}));
const loadConfigFromFileMock = vi.mocked(loadConfigFromFile);

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
      presets: {
        apply: async (key: string) =>
          ({
            framework: { name: '' },
            addons: [],
            core: {
              builder: {
                name: '@storybook/builder-vite',
                options: {
                  configLoader: 'native',
                },
              },
            },
            options: {},
          })[key],
      } as Presets,
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
  });

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
