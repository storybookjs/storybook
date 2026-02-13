import { describe, expect, it, vi } from 'vitest';

import type { Options, Presets } from 'storybook/internal/types';

import { loadConfigFromFile } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin';
import { commonConfig } from './vite-config';

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
