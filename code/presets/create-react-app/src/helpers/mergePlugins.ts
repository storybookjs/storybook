import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import type { Configuration, WebpackPluginInstance } from 'webpack';

export const mergePlugins = (...args: WebpackPluginInstance[]): Configuration['plugins'] =>
  args?.reduce((plugins, plugin) => {
    if (
      plugins?.some(
        (includedPlugin: WebpackPluginInstance) =>
          includedPlugin?.constructor.name === plugin?.constructor.name
      ) ||
      plugin?.constructor.name === 'WebpackManifestPlugin'
    ) {
      return plugins;
    }
    let updatedPlugin = plugin;
    if (plugin?.constructor.name === 'ReactRefreshPlugin') {
      // Storybook uses webpack-hot-middleware
      // https://github.com/storybookjs/presets/issues/177

      updatedPlugin = new ReactRefreshWebpackPlugin({
        overlay: {
          sockIntegration: 'whm',
        },
      });
    }
    return [...(plugins ?? []), updatedPlugin];
  }, [] as WebpackPluginInstance[]);
