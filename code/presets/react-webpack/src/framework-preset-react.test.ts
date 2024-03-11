import type { Configuration } from 'webpack';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import type { Options } from '@storybook/core-webpack';
import * as preset from './framework-preset-react';

const mockApply = jest.fn();
jest.mock('@pmmmwh/react-refresh-webpack-plugin', () => {
  return jest.fn().mockImplementation(() => {
    return { apply: mockApply };
  });
});

describe('framework-preset-react', () => {
  const reactRefreshPath = require.resolve('react-refresh/babel');
  const webpackConfigMock: Configuration = {
    plugins: [],
    module: {
      rules: [],
    },
  };
  const babelConfigMock = {};

  const storybookOptions: Partial<Options> = {
    configType: 'DEVELOPMENT',
    presets: {
      apply: async () => ({
        name: '@storybook/react',
        options: {
          fastRefresh: true,
        },
      }),
    },
    presetsList: [],
  };

  const storybookOptionsDisabledRefresh: Partial<Options> = {
    configType: 'DEVELOPMENT',
    presets: {
      apply: async () => ({
        name: '@storybook/react',
        options: {
          fastRefresh: false,
        },
      }),
    },
  };

  describe('babel', () => {
    it('should return a config with fast refresh plugin when fast refresh is enabled', async () => {
      const config = await preset.babel?.(babelConfigMock, storybookOptions as Options);

      expect(config?.plugins).toEqual([[reactRefreshPath, {}, 'storybook-react-refresh']]);
    });

    it('should return unchanged config without fast refresh plugin when fast refresh is disabled', async () => {
      const config = await preset.babel?.(
        babelConfigMock,
        storybookOptionsDisabledRefresh as Options
      );

      expect(config).toEqual(babelConfigMock);
    });

    it('should return unchanged config without fast refresh plugin when mode is not development', async () => {
      const config = await preset.babel?.(babelConfigMock, {
        ...storybookOptions,
        configType: 'PRODUCTION',
      } as Options);

      expect(config).toEqual(babelConfigMock);
    });
  });

  describe('webpackFinal', () => {
    it('should return a config with fast refresh plugin when fast refresh is enabled', async () => {
      const config = await preset.webpackFinal?.(webpackConfigMock, storybookOptions as Options);

      expect(config?.plugins).toEqual([new ReactRefreshWebpackPlugin()]);
    });

    it('should return unchanged config without fast refresh plugin when fast refresh is disabled', async () => {
      const config = await preset.webpackFinal?.(
        webpackConfigMock,
        storybookOptionsDisabledRefresh as Options
      );

      expect(config).toEqual(webpackConfigMock);
    });

    it('should return unchanged config without fast refresh plugin when mode is not development', async () => {
      const config = await preset.webpackFinal?.(webpackConfigMock, {
        ...storybookOptions,
        configType: 'PRODUCTION',
      } as Options);

      expect(config).toEqual(webpackConfigMock);
    });
  });
});
