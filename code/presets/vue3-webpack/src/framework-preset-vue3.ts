import type { StorybookConfig } from '@storybook/core-webpack';

import { VueLoaderPlugin } from 'vue-loader';
import wp from 'webpack';

export const webpack: StorybookConfig['webpack'] = (config) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new VueLoaderPlugin(),
      new wp.DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(true),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(true),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(true),
      }),
    ],
    module: {
      ...config.module,
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.vue$/,
          loader: require.resolve('vue-loader'),
          options: {},
        },
        {
          test: /\.ts$/,
          use: [
            {
              loader: require.resolve('ts-loader'),
              options: {
                transpileOnly: true,
                appendTsSuffixTo: [/\.vue$/],
              },
            },
          ],
        },
        {
          test: /\.tsx$/,
          use: [
            {
              loader: require.resolve('ts-loader'),
              options: {
                transpileOnly: true,
                // Note this is different from the `appendTsSuffixTo` above!
                appendTsxSuffixTo: [/\.vue$/],
              },
            },
          ],
        },
      ],
    },
    resolve: {
      ...config.resolve,
      extensions: [...(config.resolve?.extensions ?? []), '.vue'],
      alias: {
        ...config.resolve?.alias,
        vue$: require.resolve('vue/dist/vue.esm-bundler.js'),
      },
    },
  };
};
