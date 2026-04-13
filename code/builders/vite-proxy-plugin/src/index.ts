import { buildDevStandalone, experimental_loadStorybook } from 'storybook/internal/core-server';
import { start } from '../../builder-vite/src';
import { Plugin } from 'vite';
import { join, resolve } from 'pathe';
import { storybookDevServer } from '../../../core/src/core-server/dev-server';
import { createProxyMiddleware } from 'http-proxy-middleware';
export type UserOptions = {
  /**
   * The directory where the Storybook configuration is located, relative to the vitest
   * configuration file. If not provided, the plugin will use '.storybook' in the current working
   * directory.
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * The URL where Storybook is hosted. This is used to provide a link to the story in the test
   * output on failures.
   *
   * @default 'http://localhost:6006'
   */
  storybookUrl?: string;
};

export async function ViteProxyPlugin(options?: UserOptions): Promise<Plugin> {
  if (process.env.__STORYBOOK_PROXY_PLUGIN__) {
    return { name: 'vite-proxy-plugin' };
  }

  process.env.__STORYBOOK_PROXY_PLUGIN__ = '1';

  const finalOptions = {
    storybookScript: undefined,
    configDir: resolve(join(process.cwd(), '.storybook')),
    storybookUrl: 'http://localhost:6006',
    ...options,
  };

  const sb = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
  });

  return {
    name: 'vite-proxy-plugin',
    async configureServer(server) {
      const { address, port, networkAddress } = await buildDevStandalone(sb);
      console.log(address, port, networkAddress);
      server.middlewares.use(
        '/__storybook',
        createProxyMiddleware({
          target: address,
          changeOrigin: true,
          pathFilter: '**',
          ws: true,
          autoRewrite: true,
        })
      );
    },
  };
}
