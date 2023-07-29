import { fileURLToPath } from 'url';
import { svelteIndexer } from './indexer.js';

export function managerEntries(entry = []) {
  return [
    ...entry,
    fileURLToPath(new URL('./manager.js', import.meta.url))
      .replace(/\\/g, "\\\\"), // For Windows paths
  ];
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
              loader: fileURLToPath(new URL('../parser/svelte-stories-loader.js', import.meta.url))
                .replace(/\\/g, "\\\\"), // For Windows paths
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
  } catch (err: any) {
    const { log } = console;
    if (err.code === 'MODULE_NOT_FOUND') {
      log('@sveltejs/vite-plugin-svelte not found.  Unable to load config from svelte.config file');
    } else {
      throw err;
    }
  }

  const svelteCsfPlugin = (await import('../plugins/vite-svelte-csf.js')).default;
  plugins.push(svelteCsfPlugin(svelteConfig));

  return {
    ...config,
    plugins,
  };
}

export const storyIndexers = async (indexers) => {
  return [
    {
      test: /\.stories\.svelte$/,
      indexer: svelteIndexer,
    },
    ...(indexers || []),
  ];
};
