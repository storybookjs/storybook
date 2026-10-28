import '../hooks.ts';

import { defineBuilder } from '@storybook/core';
import { NoStatsForViteDevError } from '@storybook/core/internal/server-errors';

import type { ViteDevServer } from 'vite';

import { build } from '../build.ts';
import { createHeadlessViteChangeDetectionAdapter } from '../change-detection-adapter/headless.ts';
import { createViteChangeDetectionAdapter } from '../change-detection-adapter/index.ts';
import { getIframeHtml } from '../plugins/code-generator-plugin.ts';
import type { BuilderOptions } from '../types.ts';
import { resolveVitePublicDir, viteCorePlugins } from '../vite-config.ts';
import { createViteServer } from '../vite-server.ts';

/** Configure the preview compiler. */
export type ViteBuilderOptions = BuilderOptions;

export { viteCorePlugins };

/** Create an isolated Vite preview builder. */
export const vite = defineBuilder<ViteBuilderOptions | void>((input) => {
  // Without factory options the builder falls back to `main.ts` `core.builder.options`.
  const options = input || undefined;
  let server: ViteDevServer | undefined;

  async function bail(): Promise<void> {
    const current = server;
    server = undefined;
    await current?.close();
  }

  return {
    meta: { name: '@storybook/builder-vite' },
    hmr: 'vite',
    setup(storybook): void {
      // Builds read the factory options; `core` keeps only the options presets declared.
      storybook.hook('core:config:extend', (core) => ({
        ...core,
        builder: {
          name: import.meta.resolve('@storybook/builder-vite'),
          options: (typeof core?.builder === 'object' && core.builder.options) || {},
        },
      }));
      // In dev mode Vite serves the public dir itself, after Storybook's `staticDirs` middleware.
      storybook.hook('core:static-dirs:collect', async () => {
        const publicDir =
          storybook.mode === 'build' && (await resolveVitePublicDir(storybook, options));
        return publicDir ? [{ from: publicDir, to: '/' }] : [];
      });
    },
    async dev(storybook, { router, server: httpServer, startTime, preview }) {
      try {
        server = await createViteServer(storybook, { preview, options, server: httpServer });
      } catch (error) {
        await bail().catch(() => undefined);
        throw error;
      }
      const viteServer = server;

      router.get('/iframe.html', async (_req, res) => {
        const html = await viteServer.transformIndexHtml('/iframe.html', getIframeHtml(preview));
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.write(html);
        res.end();
      });
      router.use(viteServer.middlewares);

      return {
        bail,
        stats: {
          toJson: () => {
            throw new NoStatsForViteDevError();
          },
        },
        totalTime: process.hrtime(startTime),
      };
    },
    async build(storybook, { outDir, preview }) {
      return build(storybook, { preview, options, outDir });
    },
    changeDetectionAdapter(storybook) {
      return server
        ? createViteChangeDetectionAdapter(server)
        : createHeadlessViteChangeDetectionAdapter(storybook, options);
    },
  };
});

export default vite;
