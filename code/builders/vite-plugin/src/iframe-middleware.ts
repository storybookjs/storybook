import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import type { Connect, ViteDevServer } from 'vite';

import { transformIframeHtml } from '../../builder-vite/src/transform-iframe-html';

export function createIframeMiddleware(
  options: Options,
  server: ViteDevServer,
  basePath: string
): Connect.NextHandleFunction {
  const iframePath = `${basePath}iframe.html`;

  return async (req, res, next) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== iframePath) {
      return next();
    }

    try {
      const templatePath = fileURLToPath(
        import.meta.resolve('@storybook/builder-vite/input/iframe.html')
      );
      const rawHtml = await readFile(templatePath, { encoding: 'utf8' });
      // Call transformIframeHtml directly to replace config placeholders and
      // rewrite the virtual module URL. In dev mode, the URL becomes
      // /@id/__x00__virtual:... which Vite's transform middleware can serve.
      // NOTE: We call this here instead of via a plugin transformIndexHtml hook
      // because Vite 8 does not register transformIndexHtml hooks for plugins
      // returned from config().
      const transformed = await transformIframeHtml(rawHtml, options);

      // Run Vite's transformIndexHtml pipeline to inject @vite/client and
      // run any registered plugin hooks (e.g. channel path patching).
      const finalHtml = await server.transformIndexHtml(iframePath, transformed);

      res.setHeader('Content-Type', 'text/html');
      res.statusCode = 200;
      res.write(finalHtml);
      res.end();
    } catch (error) {
      next(error);
    }
  };
}
