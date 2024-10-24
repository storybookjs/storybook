import { describe, expect, it, vi } from 'vitest';

import type { TypescriptOptions } from '@storybook/core-webpack';
import ReactDocgenTypescriptPlugin from '@storybook/react-docgen-typescript-plugin';

import type { Configuration } from 'webpack';

import * as preset from './framework-preset-react-docs';

vi.mock('./requirer', () => ({
  requirer: (resolver: any, path: string) => path,
}));

describe('framework-preset-react-docgen', () => {
  const presetsListWithDocs = [{ name: '@storybook/addon-docs', options: {}, preset: null }];

  // mock requirer

  describe('react-docgen', () => {
    it('should return the webpack config with the extra webpack loader', async () => {
      const webpackConfig: Configuration = {};

      const config = await preset.webpackFinal?.(webpackConfig, {
        presets: {
          apply: async (name: string) => {
            if (name === 'typescript') {
              return {
                check: false,
                reactDocgen: 'react-docgen',
              } as Partial<TypescriptOptions>;
            }

            if (name === 'babel') {
              return {
                plugins: [],
                presets: [],
              };
            }

            return undefined;
          },
        },
        presetsList: presetsListWithDocs,
      } as any);

      expect(config).toEqual({
        module: {
          rules: [
            {
              exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
              loader: '@storybook/preset-react-webpack/loaders/react-docgen-loader',
              options: { babelOptions: { plugins: [], presets: [] }, debug: false },
              test: /\.(cjs|mjs|tsx?|jsx?)$/,
            },
          ],
        },
      });
    });
  });

  describe('react-docgen-typescript', () => {
    it('should return the webpack config with the extra plugin', async () => {
      const webpackConfig = {
        plugins: [],
      };

      const config = await preset.webpackFinal?.(webpackConfig, {
        presets: {
          // @ts-expect-error (not strict)
          apply: async (name: string) => {
            if (name === 'typescript') {
              return {
                check: false,
                reactDocgen: 'react-docgen-typescript',
              } as Partial<TypescriptOptions>;
            }

            if (name === 'babel') {
              return {
                plugins: [],
                presets: [],
              };
            }

            return undefined;
          },
        },
        presetsList: presetsListWithDocs,
      });

      expect(config).toEqual({
        module: {
          rules: [
            {
              exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
              loader: '@storybook/preset-react-webpack/loaders/react-docgen-loader',
              options: { babelOptions: { plugins: [], presets: [] }, debug: false },
              test: /\.(cjs|mjs|jsx?)$/,
            },
          ],
        },
        plugins: [expect.any(ReactDocgenTypescriptPlugin)],
      });
    });
  });

  describe('no docgen', () => {
    it('should not add any extra plugins', async () => {
      const webpackConfig = {
        plugins: [],
      };

      const outputWebpackconfig = await preset.webpackFinal?.(webpackConfig, {
        presets: {
          // @ts-expect-error (Converted from ts-ignore)
          apply: async () =>
            ({
              check: false,
              reactDocgen: false,
            }) as Partial<TypescriptOptions>,
        },
        presetsList: presetsListWithDocs,
      });

      expect(outputWebpackconfig).toEqual({ plugins: [] });
    });
  });

  describe('no docs or controls addon used', () => {
    it('should not add any extra plugins', async () => {
      const webpackConfig = {
        plugins: [],
      };

      const outputWebpackconfig = await preset.webpackFinal?.(webpackConfig, {
        presets: {
          // @ts-expect-error (Converted from ts-ignore)
          apply: async () =>
            ({
              check: false,
              reactDocgen: 'react-docgen-typescript',
            }) as Partial<TypescriptOptions>,
        },
        presetsList: [],
      });

      expect(outputWebpackconfig).toEqual({
        plugins: [],
      });
    });
  });
});
