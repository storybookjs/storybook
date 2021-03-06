export function managerEntries(entry = []) {
  return [...entry, require.resolve('./manager')];
}

export function webpack(config) {
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
              loader: require.resolve('../parser/svelte-stories-loader'),
            },
          ],
        },
      ],
    },
  };
}
