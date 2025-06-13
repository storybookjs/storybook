import { describe, expect, it } from 'vitest';

import type { Configuration } from 'webpack';

import { mergeConfigs } from './merge-webpack-config';

const config: Configuration = {
  devtool: 'source-map',
  entry: {
    bundle: 'index.js',
  },
  output: {
    filename: '[name].js',
  },
  module: {
    rules: [{ use: 'r1' }, { use: 'r2' }],
  },
  // @ts-expect-errors For snapshot readability purposes `plugins` attribute doesn't match the correct type
  plugins: ['p1', 'p2'],
  resolve: {
    enforceExtension: true,
    extensions: ['.js', '.json'],
    alias: {
      A1: 'src/B1',
      A2: 'src/B2',
    },
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
    runtimeChunk: true,
  },
};

describe('mergeConfigs', () => {
  it('merges two full configs in one', () => {
    const customConfig: Configuration = {
      profile: true,
      entry: {
        bundle: 'should_not_be_merged.js',
      },
      output: {
        filename: 'should_not_be_merged.js',
      },
      module: {
        noParse: /jquery|lodash/,
        rules: [{ use: 'r3' }, { use: 'r4' }],
      },
      // @ts-expect-errors For snapshot readability purposes `plugins` attribute doesn't match the correct type
      plugins: ['p3', 'p4'],
      resolve: {
        enforceExtension: false,
        extensions: ['.ts', '.tsx'],
        alias: {
          A3: 'src/B3',
          A4: 'src/B4',
        },
      },
      optimization: {
        // @ts-expect-errors For snapshot readability purposes `minimizer` attribute doesn't match the correct type
        minimizer: ['banana'],
      },
    };

    const result = mergeConfigs(config, customConfig);

    expect(result).toMatchSnapshot();
  });

  it('merges partial custom config', () => {
    const customConfig: Configuration = {
      // @ts-expect-errors For snapshot readability purposes `plugins` attribute doesn't match the correct type
      plugins: ['p3'],
      resolve: {
        extensions: ['.ts', '.tsx'],
      },
    };

    const result = mergeConfigs(config, customConfig);

    expect(result).toMatchSnapshot();
  });

  it('merges successfully if custom config is empty', () => {
    const customConfig = {};

    const result = mergeConfigs(config, customConfig);

    expect(result).toMatchSnapshot();
  });
});
