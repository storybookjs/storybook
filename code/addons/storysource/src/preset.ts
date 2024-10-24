/// <reference types="webpack" />
import { fileURLToPath } from 'url';

function webpack(
  webpackConfig = { module: { rules: [] as Array<unknown> } },
  options = { loaderOptions: {}, rule: {} }
) {
  const { module = { rules: [] } } = webpackConfig;
  const { loaderOptions, rule = {} } = options;

  return {
    ...webpackConfig,
    module: {
      ...module,
      rules: [
        ...(module.rules || []),
        {
          test: [/\.stories\.(jsx?$|tsx?$)/],
          ...rule,
          use: [
            {
              loader: fileURLToPath(import.meta.resolve('@storybook/source-loader')),
              options: loaderOptions,
            },
          ],
        },
      ],
    },
  };
}

export { webpack };
