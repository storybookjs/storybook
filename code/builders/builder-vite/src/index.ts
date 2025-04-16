// noinspection JSUnusedGlobalSymbols
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Middleware, Options } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build';
import { transformIframeHtml } from './transform-iframe-html';
import type { ViteBuilder } from './types';
import { createViteServer } from './vite-server';

export { withoutVitePlugins } from './utils/without-vite-plugins';
export { hasVitePlugins } from './utils/has-vite-plugins';

export * from './types';

function iframeHandler(options: Options, server: ViteDevServer, content: string): Middleware {
  return async (req, res) => {
    const transformed = await server.transformIndexHtml('/iframe.html', content);
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(transformed);
    res.end();
  };
}

let server: ViteDevServer;

export async function bail(): Promise<void> {
  return server?.close();
}

export const start: ViteBuilder['start'] = async ({
  startTime,
  options,
  router,
  server: devServer,
}) => {
  const indexHtml = await readFile(require.resolve('@storybook/builder-vite/input/iframe.html'), {
    encoding: 'utf8',
  });
  const content = await transformIframeHtml(indexHtml, options);

  await writeFile(join(process.cwd(), 'storybook.html'), content.replaceAll(process.cwd(), '.'));

  server = await createViteServer(options as Options, devServer);

  router.get('/iframe.html', iframeHandler(options as Options, server, content));
  router.use(server.middlewares);

  return {
    bail,
    stats: {
      toJson: () => {
        throw new NoStatsForViteDevError();
      },
    },
    totalTime: process.hrtime(startTime),
  };
};

export const build: ViteBuilder['build'] = async ({ options }) => {
  return viteBuild(options as Options);
};
