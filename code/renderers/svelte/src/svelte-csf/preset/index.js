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

export async function viteFinal(config, options) {
  const { plugins = [] } = config;
  const svelteOptions = await options.presets.apply('svelteOptions', {}, options);
  let svelteConfig = svelteOptions;
  try {
    const { loadSvelteConfig } = await import('@sveltejs/vite-plugin-svelte');
    svelteConfig = { ...(await loadSvelteConfig()), ...svelteOptions };
  } catch (err) {
    const { log } = console;
    if (err.code === 'MODULE_NOT_FOUND') {
      log('@sveltejs/vite-plugin-svelte not found.  Unable to load config from svelte.config file');
    } else {
      throw err;
    }
  }

  const { default: svelteCsfPlugin } = await import('../plugins/vite-svelte-csf');
  plugins.push(svelteCsfPlugin(svelteConfig));

  return {
    ...config,
    plugins,
  };
}
