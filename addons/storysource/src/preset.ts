/// <reference types="webpack" />

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
              loader: require.resolve('@storybook/source-loader'),
              options: loaderOptions,
            },
          ],
        },
      ],
    },
  };
}

export { webpack };
