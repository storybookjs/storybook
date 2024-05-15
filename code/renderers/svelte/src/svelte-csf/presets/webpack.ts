import { fileURLToPath } from 'node:url';

// FIXME: `StorybookConfig` doesn't have a prop field for `webpack`, should we deprecate?
export const webpack = async (config: any) => {
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...config.module.rules,
        {
          test: /\.stories\.svelte$/,
          enforce: 'post',
          use: [
            {
              loader: fileURLToPath(
                new URL('../svelte/stories-loader.js', import.meta.url)
              ).replace(/\\/g, '\\\\'), // For Windows paths
            },
          ],
        },
      ],
    },
  };
};
